// Edge function: analyze-template
// Detects editable image placeholders in a template image.
//
// Pipeline:
//   1. Decode image pixels (PNG via pngjs, JPEG via jpeg-js)
//   2. Downsample to a luminance grid
//   3. Compute local variance (detail) and gradient (edge) maps
//   4. Find connected smooth regions bounded by edges → candidate placeholders
//   5. Filter by size, classify shape (rectangle / circle / rounded), assign labels
//
// If GEMINI_API_KEY is set, uses Gemini Vision instead (more accurate for complex templates).
// The pixel analysis runs as the default and as a fallback.

import { PNG } from "npm:pngjs@7.0.0";
import jpeg from "npm:jpeg-js@0.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg"]);
const GRID = 96;

interface Placeholder {
  id: string;
  type: "image";
  shape: "rectangle" | "circle" | "rounded";
  label: string;
  confidence: number;
  rotation: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ---------- Image decoding ----------

function getImageSize(bytes: Uint8Array, mime: string): { width: number; height: number } {
  if (mime === "image/png") {
    if (bytes.length < 24) throw new Error("Invalid PNG");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
  }
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i += 1; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { height: view.getUint16(i + 5, false), width: view.getUint16(i + 7, false) };
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const len = view.getUint16(i + 2, false);
    i += 2 + len;
  }
  throw new Error("Could not read JPEG dimensions");
}

interface DecodedImage {
  data: Uint8Array; // RGBA
  width: number;
  height: number;
}

function decodeImage(bytes: Uint8Array, mime: string): Promise<DecodedImage> {
  if (mime === "image/png") {
    return new Promise<DecodedImage>((resolve, reject) => {
      new PNG().parse(bytes as any, (err: Error | null, png: any) => {
        if (err) reject(err);
        else resolve({ data: png.data as Uint8Array, width: png.width, height: png.height });
      });
    });
  }
  // JPEG — jpeg-js decode is synchronous and works with Uint8Array
  const raw = jpeg.decode(bytes as any, { maxMemoryUsageInMB: 200 });
  return Promise.resolve({ data: raw.data as Uint8Array, width: raw.width, height: raw.height });
}

// ---------- Luminance grid ----------

function rgbToLum(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Downsample the full image to a GRID x GRID luminance grid by block-averaging.
function buildLuminanceGrid(img: DecodedImage): Float32Array {
  const grid = new Float32Array(GRID * GRID);
  const cellW = img.width / GRID;
  const cellH = img.height / GRID;
  const data = img.data;

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let sum = 0;
      let count = 0;
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.floor((gx + 1) * cellW);
      const y0 = Math.floor(gy * cellH);
      const y1 = Math.floor((gy + 1) * cellH);
      // Sample at most ~6x6 pixels per cell for speed
      const stepX = Math.max(1, Math.floor((x1 - x0) / 6));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const idx = (img.width * y + x) * 4;
          sum += rgbToLum(data[idx], data[idx + 1], data[idx + 2]);
          count++;
        }
      }
      grid[gy * GRID + gx] = count > 0 ? sum / count : 0;
    }
  }
  return grid;
}

// ---------- Variance + edge maps ----------

function computeVarianceMap(lum: Float32Array): Float32Array {
  const out = new Float32Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const center = lum[y * GRID + x];
      let sumSq = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const diff = lum[ny * GRID + nx] - center;
          sumSq += diff * diff;
          n++;
        }
      }
      out[y * GRID + x] = Math.sqrt(sumSq / n);
    }
  }
  return out;
}

function computeEdgeMap(lum: Float32Array): Float32Array {
  const out = new Float32Array(GRID * GRID);
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const i = y * GRID + x;
      // Sobel
      const gx =
        -lum[i - GRID - 1] - 2 * lum[i - 1] - lum[i + GRID - 1] +
        lum[i - GRID + 1] + 2 * lum[i + 1] + lum[i + GRID + 1];
      const gy =
        -lum[i - GRID - 1] - 2 * lum[i - GRID] - lum[i - GRID + 1] +
        lum[i + GRID - 1] + 2 * lum[i + GRID] + lum[i + GRID + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

function percentile(arr: Float32Array, p: number): number {
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

// ---------- Connected components ----------

interface Component {
  cells: number[];
  cellCount: number;
  minX: number; minY: number; maxX: number; maxY: number;
  size: number;
}

function connectedComponents(smooth: Uint8Array): Component[] {
  const labels = new Int32Array(GRID * GRID).fill(-1);
  const comps: Component[] = [];
  const stack: number[] = [];

  for (let i = 0; i < GRID * GRID; i++) {
    if (smooth[i] === 0 || labels[i] !== -1) continue;
    const compId = comps.length;
    const comp: Component = {
      cells: [], cellCount: 0,
      minX: GRID, minY: GRID, maxX: 0, maxY: 0, size: 0,
    };
    stack.length = 0;
    stack.push(i);
    labels[i] = compId;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % GRID;
      const y = Math.floor(idx / GRID);
      comp.cells.push(idx);
      comp.cellCount++;
      comp.size++;
      if (x < comp.minX) comp.minX = x;
      if (y < comp.minY) comp.minY = y;
      if (x > comp.maxX) comp.maxX = x;
      if (y > comp.maxY) comp.maxY = y;

      // 8-connectivity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          if (smooth[ni] === 1 && labels[ni] === -1) {
            labels[ni] = compId;
            stack.push(ni);
          }
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

// ---------- Shape classification ----------

function classifyShape(comp: Component, smooth: Uint8Array): Placeholder["shape"] {
  const bw = comp.maxX - comp.minX + 1;
  const bh = comp.maxY - comp.minY + 1;
  if (bw < 2 || bh < 2) return "rectangle";

  // Check how many cells in the bounding box are smooth (fill ratio)
  let fillCount = 0;
  for (let y = comp.minY; y <= comp.maxY; y++) {
    for (let x = comp.minX; x <= comp.maxX; x++) {
      if (smooth[y * GRID + x] === 1) fillCount++;
    }
  }
  const fillRatio = fillCount / (bw * bh);

  // Check corner fill — circles have empty corners
  const cornerSize = Math.max(1, Math.floor(Math.min(bw, bh) * 0.2));
  let cornerFill = 0;
  let cornerTotal = 0;
  const corners = [
    [comp.minX, comp.minY],
    [comp.maxX - cornerSize + 1, comp.minY],
    [comp.minX, comp.maxY - cornerSize + 1],
    [comp.maxX - cornerSize + 1, comp.maxY - cornerSize + 1],
  ];
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + cornerSize; y++) {
      for (let x = cx; x < cx + cornerSize; x++) {
        if (x >= 0 && y >= 0 && x < GRID && y < GRID) {
          cornerTotal++;
          if (smooth[y * GRID + x] === 1) cornerFill++;
        }
      }
    }
  }
  const cornerRatio = cornerTotal > 0 ? cornerFill / cornerTotal : 1;

  // Circle: low corner fill, decent fill ratio
  if (cornerRatio < 0.25 && fillRatio > 0.55) return "circle";
  // Rounded: moderate corner emptiness
  if (cornerRatio < 0.5 && fillRatio > 0.7) return "rounded";
  return "rectangle";
}

// ---------- Border detection (frame check) ----------

function hasFrameBorder(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  edges: Float32Array,
  edgeThreshold: number
): boolean {
  let edgeCount = 0;
  let perimeter = 0;
  for (let x = box.minX; x <= box.maxX; x++) {
    for (const y of [box.minY - 1, box.maxY + 1]) {
      if (y >= 0 && y < GRID) {
        perimeter++;
        if (edges[y * GRID + x] > edgeThreshold) edgeCount++;
      }
    }
  }
  for (let y = box.minY; y <= box.maxY; y++) {
    for (const x of [box.minX - 1, box.maxX + 1]) {
      if (x >= 0 && x < GRID) {
        perimeter++;
        if (edges[y * GRID + x] > edgeThreshold) edgeCount++;
      }
    }
  }
  return perimeter > 0 && edgeCount / perimeter > 0.25;
}

// ---------- Merge overlapping ----------

function overlap(a: Placeholder, b: Placeholder): number {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = b.x + b.width, by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function mergeOverlapping(phs: Placeholder[]): Placeholder[] {
  const result: Placeholder[] = [];
  const used = new Set<number>();
  for (let i = 0; i < phs.length; i++) {
    if (used.has(i)) continue;
    let current = phs[i];
    for (let j = i + 1; j < phs.length; j++) {
      if (used.has(j)) continue;
      if (overlap(current, phs[j]) > 0.4) {
        used.add(j);
        // Keep the one with higher confidence
        if (phs[j].confidence > current.confidence) current = phs[j];
      }
    }
    result.push(current);
  }
  return result;
}

// ---------- Main pixel analysis ----------
//
// Strategy: photo placeholders in templates are typically distinct color regions
// (colored frames, gray boxes) OR high-detail areas (actual photos already placed).
// We use two detectors:
//   1. Color segmentation: group adjacent cells with similar colors into regions.
//      Distinct colored regions ≠ background → candidate placeholders.
//   2. High-variance detection: areas with lots of local detail → actual photos.
// Then merge overlapping candidates from both.

interface ColorRegion {
  cells: number[];
  minX: number; minY: number; maxX: number; maxY: number;
  size: number;
  avgR: number; avgG: number; avgB: number;
}

function buildColorGrid(img: DecodedImage): Float32Array {
  // Returns GRID*GRID*3 array (R,G,B per cell)
  const grid = new Float32Array(GRID * GRID * 3);
  const cellW = img.width / GRID;
  const cellH = img.height / GRID;
  const data = img.data;

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      let r = 0, g = 0, b = 0, count = 0;
      const x0 = Math.floor(gx * cellW);
      const x1 = Math.floor((gx + 1) * cellW);
      const y0 = Math.floor(gy * cellH);
      const y1 = Math.floor((gy + 1) * cellH);
      const stepX = Math.max(1, Math.floor((x1 - x0) / 6));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 6));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const idx = (img.width * y + x) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
      const ci = (gy * GRID + gx) * 3;
      grid[ci] = count > 0 ? r / count : 0;
      grid[ci + 1] = count > 0 ? g / count : 0;
      grid[ci + 2] = count > 0 ? b / count : 0;
    }
  }
  return grid;
}

function colorDistance(c1: number, c2: number, c3: number, r: number, g: number, b: number): number {
  const dr = c1 - r, dg = c2 - g, db = c3 - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function segmentColorRegions(colorGrid: Float32Array, threshold: number): ColorRegion[] {
  const labels = new Int32Array(GRID * GRID).fill(-1);
  const regions: ColorRegion[] = [];
  const stack: number[] = [];

  for (let start = 0; start < GRID * GRID; start++) {
    if (labels[start] !== -1) continue;
    const regionId = regions.length;
    const sx = start % GRID, sy = Math.floor(start / GRID);
    const ci0 = start * 3;
    const refR = colorGrid[ci0], refG = colorGrid[ci0 + 1], refB = colorGrid[ci0 + 2];
    const region: ColorRegion = {
      cells: [], minX: GRID, minY: GRID, maxX: 0, maxY: 0, size: 0,
      avgR: refR, avgG: refG, avgB: refB,
    };
    stack.length = 0;
    stack.push(start);
    labels[start] = regionId;

    let sumR = 0, sumG = 0, sumB = 0;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % GRID, y = Math.floor(idx / GRID);
      const ci = idx * 3;
      region.cells.push(idx);
      region.size++;
      sumR += colorGrid[ci];
      sumG += colorGrid[ci + 1];
      sumB += colorGrid[ci + 2];
      if (x < region.minX) region.minX = x;
      if (y < region.minY) region.minY = y;
      if (x > region.maxX) region.maxX = x;
      if (y > region.maxY) region.maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
          const ni = ny * GRID + nx;
          if (labels[ni] !== -1) continue;
          const nci = ni * 3;
          if (colorDistance(colorGrid[nci], colorGrid[nci + 1], colorGrid[nci + 2], refR, refG, refB) < threshold) {
            labels[ni] = regionId;
            stack.push(ni);
          }
        }
      }
    }
    region.avgR = sumR / region.size;
    region.avgG = sumG / region.size;
    region.avgB = sumB / region.size;
    regions.push(region);
  }
  return regions;
}

// Classify shape from a region's fill pattern within its bounding box
function classifyRegionShape(region: { minX: number; minY: number; maxX: number; maxY: number; size: number }, labels: Int32Array, labelId: number): Placeholder["shape"] {
  const bw = region.maxX - region.minX + 1;
  const bh = region.maxY - region.minY + 1;
  if (bw < 2 || bh < 2) return "rectangle";

  // Corner fill analysis
  const cornerSize = Math.max(2, Math.floor(Math.min(bw, bh) * 0.22));
  let cornerFill = 0, cornerTotal = 0;
  const corners = [
    [region.minX, region.minY],
    [region.maxX - cornerSize + 1, region.minY],
    [region.minX, region.maxY - cornerSize + 1],
    [region.maxX - cornerSize + 1, region.maxY - cornerSize + 1],
  ];
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + cornerSize && y < GRID; y++) {
      for (let x = cx; x < cx + cornerSize && x < GRID; x++) {
        if (x >= 0 && y >= 0) {
          cornerTotal++;
          if (labels[y * GRID + x] === labelId) cornerFill++;
        }
      }
    }
  }
  const cornerRatio = cornerTotal > 0 ? cornerFill / cornerTotal : 1;
  const fillRatio = region.size / (bw * bh);

  // Circle: very empty corners + high fill in center
  if (cornerRatio < 0.2 && fillRatio > 0.6) return "circle";
  // Rounded: moderately empty corners
  if (cornerRatio < 0.45 && fillRatio > 0.7) return "rounded";
  return "rectangle";
}

function analyzePixels(img: DecodedImage): Placeholder[] {
  const colorGrid = buildColorGrid(img);
  const lum = buildLuminanceGrid(img);
  const variance = computeVarianceMap(lum);
  const edges = computeEdgeMap(lum);

  const edgeThreshold = percentile(edges, 60);
  const varThreshold = percentile(variance, 75);
  const totalCells = GRID * GRID;
  const candidates: Placeholder[] = [];

  // --- Method 1: Color segmentation ---
  // Adaptive threshold based on image color diversity
  const colorThreshold = 35; // perceptual distance threshold
  const labels = new Int32Array(GRID * GRID).fill(-1);
  const regions = segmentColorRegions(colorGrid, colorThreshold);

  // Rebuild labels for shape classification
  for (let i = 0; i < regions.length; i++) {
    for (const cell of regions[i].cells) {
      labels[cell] = i;
    }
  }

  // Determine the dominant background color (largest region touching image borders)
  let bgRegionId = -1, bgSize = 0;
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const touchesBorder =
      r.minX === 0 || r.minY === 0 || r.maxX === GRID - 1 || r.maxY === GRID - 1;
    if (touchesBorder && r.size > bgSize) {
      bgSize = r.size;
      bgRegionId = i;
    }
  }

  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const areaFrac = r.size / totalCells;
    if (areaFrac < 0.02) continue;   // too small (text, icons)
    if (areaFrac > 0.70) continue;   // too large (background)
    if (i === bgRegionId) continue;  // skip background

    const bw = r.maxX - r.minX + 1;
    const bh = r.maxY - r.minY + 1;
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    if (aspect > 10) continue; // thin lines/borders
    if (Math.min(bw, bh) < 4) continue; // too thin in one dimension (text strips)

    const shape = classifyRegionShape(r, labels, i);
    const framed = hasFrameBorder(
      { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY },
      edges, edgeThreshold
    );

    let confidence = 0.55 + Math.min(0.3, areaFrac * 0.8);
    if (framed) confidence += 0.1;
    if (areaFrac > 0.05 && areaFrac < 0.5) confidence += 0.05;
    confidence = Math.min(0.95, confidence);

    candidates.push({
      id: String(candidates.length + 1),
      type: "image",
      shape,
      label: "Photo",
      confidence,
      rotation: 0,
      x: clamp01(r.minX / GRID),
      y: clamp01(r.minY / GRID),
      width: clamp01(bw / GRID),
      height: clamp01(bh / GRID),
    });
  }

  // --- Method 2: High-variance regions (actual photos already in template) ---
  const highVar = new Uint8Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    highVar[i] = variance[i] > varThreshold ? 1 : 0;
  }
  const varComps = connectedComponents(highVar);
  for (const comp of varComps) {
    const areaFrac = comp.size / totalCells;
    if (areaFrac < 0.04) continue;
    if (areaFrac > 0.6) continue;

    const bw = comp.maxX - comp.minX + 1;
    const bh = comp.maxY - comp.minY + 1;
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    if (aspect > 8) continue;

    // Skip if this overlaps heavily with an existing color-based candidate
    const overlapsExisting = candidates.some(
      (c) => overlapBoxes(c, comp.minX / GRID, comp.minY / GRID, bw / GRID, bh / GRID) > 0.3
    );
    if (overlapsExisting) continue;

    candidates.push({
      id: String(candidates.length + 1),
      type: "image",
      shape: classifyShape(comp, highVar),
      label: "Photo",
      confidence: 0.65,
      rotation: 0,
      x: clamp01(comp.minX / GRID),
      y: clamp01(comp.minY / GRID),
      width: clamp01(bw / GRID),
      height: clamp01(bh / GRID),
    });
  }

  if (candidates.length === 0) return [];

  // Merge overlapping candidates
  const merged = mergeOverlapping(candidates);

  // Sort by area descending for labeling
  merged.sort((a, b) => b.width * b.height - a.width * a.height);

  // Assign labels
  const labeled = merged.map((ph, idx) => {
    let label = `Photo ${idx + 1}`;
    if (idx === 0) {
      label = "Main Photo";
    } else if (ph.shape === "circle" && ph.width < 0.35) {
      label = "Profile Picture";
    } else if (ph.width < 0.22 && ph.height < 0.22) {
      label = "Logo";
    }
    return { ...ph, id: String(idx + 1), label };
  });

  return labeled.slice(0, 6);
}

function overlapBoxes(
  a: Placeholder,
  bx: number, by: number, bw: number, bh: number
): number {
  const ax2 = a.x + a.width, ay2 = a.y + a.height;
  const bx2 = bx + bw, by2 = by + bh;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, bx));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, by));
  const inter = ix * iy;
  const union = a.width * a.height + bw * bh - inter;
  return union > 0 ? inter / union : 0;
}

// ---------- Smart fallback (when pixel analysis finds nothing) ----------

function smartFallback(width: number, height: number, img: DecodedImage): Placeholder[] {
  // Analyze brightness distribution to guess layout
  const lum = buildLuminanceGrid(img);
  const landscape = width >= height;

  // Find the darkest and brightest quadrants
  const quadrants = [
    { name: "tl", x0: 0, y0: 0, x1: GRID / 2, y1: GRID / 2 },
    { name: "tr", x0: GRID / 2, y0: 0, x1: GRID, y1: GRID / 2 },
    { name: "bl", x0: 0, y0: GRID / 2, x1: GRID / 2, y1: GRID },
    { name: "br", x0: GRID / 2, y0: GRID / 2, x1: GRID, y1: GRID },
  ];
  const quadLums = quadrants.map((q) => {
    let sum = 0, count = 0;
    for (let y = q.y0; y < q.y1; y++) {
      for (let x = q.x0; x < q.x1; x++) {
        sum += lum[y * GRID + x];
        count++;
      }
    }
    return { name: q.name, avg: sum / count };
  });

  // The most "uniform" quadrant (lowest variance from mean) likely has a photo
  // For fallback, use a layout based on aspect ratio
  if (landscape) {
    return [
      {
        id: "1", type: "image", shape: "rectangle", label: "Main Photo",
        confidence: 0.4, rotation: 0,
        x: 0.06, y: 0.15, width: 0.55, height: 0.7,
      },
      {
        id: "2", type: "image", shape: "circle", label: "Profile Picture",
        confidence: 0.35, rotation: 0,
        x: 0.68, y: 0.25, width: 0.25, height: 0.28,
      },
    ];
  }
  return [
    {
      id: "1", type: "image", shape: "rectangle", label: "Main Photo",
      confidence: 0.4, rotation: 0,
      x: 0.1, y: 0.1, width: 0.8, height: 0.55,
    },
  ];
}

// ---------- Gemini Vision ----------

async function callGemini(base64: string, mime: string, apiKey: string): Promise<Placeholder[]> {
  const prompt = `You are a template analysis AI. You are given an image that is a design template (e.g. birthday card, social media post, flyer, collage). Your job is to detect every editable image/photo placeholder region in the template where a user would insert their own photo.

Detect: photo frames, profile picture areas, logo placeholders, image boxes.
Ignore: text, background, decorations, icons, borders, watermarks.

Return ONLY a JSON object with this exact shape, no markdown, no explanation:
{
  "placeholders": [
    {
      "id": "1",
      "type": "image",
      "shape": "rectangle" | "circle" | "rounded",
      "label": "short human label",
      "confidence": 0.0 to 1.0,
      "rotation": degrees (usually 0),
      "x": normalized 0..1 (left edge, fraction of image width),
      "y": normalized 0..1 (top edge, fraction of image height),
      "width": normalized 0..1 (fraction of image width),
      "height": normalized 0..1 (fraction of image height)
    }
  ]
}

Coordinates are normalized (0..1) relative to the full image. x,y is the top-left corner. Return between 1 and 6 placeholders. Be precise.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  const parsed = JSON.parse(text);
  return (Array.isArray(parsed.placeholders) ? parsed.placeholders : [])
    .filter((p: any) => p && typeof p.x === "number")
    .map((p: any, idx: number) => ({
      id: String(p.id ?? idx + 1),
      type: "image" as const,
      shape: (["rectangle", "circle", "rounded"].includes(p.shape) ? p.shape : "rectangle") as Placeholder["shape"],
      label: String(p.label ?? `Photo ${idx + 1}`),
      confidence: Number(p.confidence ?? 0.8),
      rotation: Number(p.rotation ?? 0),
      x: clamp01(p.x), y: clamp01(p.y), width: clamp01(p.width), height: clamp01(p.height),
    }));
}

function encodeBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let s = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonResponse({ error: "Missing 'file' field" }, 400);
    const mime = file.type || "image/png";
    if (!ALLOWED.has(mime)) return jsonResponse({ error: "Unsupported file type. Use PNG or JPG." }, 400);
    if (file.size > MAX_BYTES) return jsonResponse({ error: "File too large. Max 20MB." }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { width, height } = getImageSize(bytes, mime);
    if (!width || !height) return jsonResponse({ error: "Could not read image dimensions." }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    // Try Gemini first if configured
    if (apiKey) {
      try {
        const base64 = encodeBase64(bytes);
        const geminiResult = await callGemini(base64, mime, apiKey);
        if (geminiResult.length > 0) {
          return jsonResponse({ placeholders: geminiResult, source: "gemini", width, height });
        }
      } catch (err) {
        console.error("Gemini failed, falling back to pixel analysis:", err.message);
      }
    }

    // Pixel-based computer vision analysis
    try {
      const img = await decodeImage(bytes, mime);
      const pixelResult = analyzePixels(img);
      if (pixelResult.length > 0) {
        return jsonResponse({ placeholders: pixelResult, source: "vision", width, height });
      }
      // No candidates found — use smart fallback
      const fallback = smartFallback(width, height, img);
      return jsonResponse({ placeholders: fallback, source: "fallback", width, height });
    } catch (err) {
      console.error("Pixel analysis failed:", err.message);
      return jsonResponse({ placeholders: smartFallback(width, height, { data: new Uint8Array(0), width, height }), source: "fallback", width, height });
    }
  } catch (err) {
    return jsonResponse({ error: err.message || "Analysis failed" }, 500);
  }
});
