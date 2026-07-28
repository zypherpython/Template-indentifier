// Edge function: composite-template
// Server-side image compositing using pure-JS pngjs (no native deps, works in Deno).
// Takes a template image + user replacement images, composites each image into its
// placeholder using COVER fit (preserve aspect ratio, crop overflow), returns final PNG as base64.
//
// Request JSON:
//   {
//     "templateUrl": "https://...supabase.co/storage/v1/object/public/templates/...",
//     "width": 1080, "height": 1080,
//     "placeholders": [{ id, shape, x, y, width, height, rotation }],
//     "images": { "<placeholderId>": "<base64 data url or remote url>" }
//   }
// Response JSON:
//   { "image": "<base64 png data url>", "width": ..., "height": ... }

import { PNG } from "npm:pngjs@7.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let s = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

interface Placeholder {
  id: string;
  shape: "rectangle" | "circle" | "rounded";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface RGBA { r: number; g: number; b: number; a: number; }

async function loadPng(src: string): Promise<PNG> {
  let bytes: Uint8Array;
  if (src.startsWith("data:")) {
    const base64 = src.split(",")[1] ?? "";
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } else {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  return new Promise<PNG>((resolve, reject) => {
    new PNG().parse(bytes as any, (err, png) => {
      if (err) reject(err);
      else resolve(png);
    });
  });
}

function getPx(png: PNG, x: number, y: number): RGBA {
  const idx = (png.width * y + x) << 2;
  return { r: png.data[idx], g: png.data[idx + 1], b: png.data[idx + 2], a: png.data[idx + 3] };
}

function setPx(png: PNG, x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = c.r;
  png.data[idx + 1] = c.g;
  png.data[idx + 2] = c.b;
  png.data[idx + 3] = c.a;
}

// Cover-fit: scale source so it covers the target box, center-crop overflow.
// Returns a new PNG of exactly (boxW x boxH).
function coverCrop(src: PNG, boxW: number, boxH: number): PNG {
  const scale = Math.max(boxW / src.width, boxH / src.height);
  const scaledW = Math.round(src.width * scale);
  const scaledH = Math.round(src.height * scale);
  const out = new PNG({ width: boxW, height: boxH });
  const offX = Math.max(0, Math.floor((scaledW - boxW) / 2));
  const offY = Math.max(0, Math.floor((scaledH - boxH) / 2));

  for (let y = 0; y < boxH; y++) {
    for (let x = 0; x < boxW; x++) {
      // Map output pixel to source pixel via nearest-neighbor
      const sx = Math.floor((x + offX) / scale);
      const sy = Math.floor((y + offY) / scale);
      const px = getPx(src, Math.min(src.width - 1, Math.max(0, sx)), Math.min(src.height - 1, Math.max(0, sy)));
      setPx(out, x, y, px);
    }
  }
  return out;
}

function applyShapeMask(png: PNG, shape: Placeholder["shape"]): void {
  if (shape === "rectangle") return;
  const w = png.width;
  const h = png.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = false;
      if (shape === "circle") {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(cx, cy);
        inside = (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= r * r;
      } else if (shape === "rounded") {
        const r = Math.round(Math.min(w, h) * 0.12);
        inside = isInsideRoundedRect(x, y, w, h, r);
      }
      if (!inside) {
        const idx = (w * y + x) << 2;
        png.data[idx + 3] = 0;
      }
    }
  }
}

function isInsideRoundedRect(x: number, y: number, w: number, h: number, r: number): boolean {
  if (x >= r && x <= w - r - 1) return true;
  if (y >= r && y <= h - r - 1) return true;
  const cx = x < r ? r : w - r - 1;
  const cy = y < r ? r : h - r - 1;
  return (x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= r * r;
}

// Alpha-composite a layer onto base at (boxX, boxY)
function compositeLayer(base: PNG, layer: PNG, boxX: number, boxY: number): void {
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const tx = boxX + x;
      const ty = boxY + y;
      if (tx < 0 || ty < 0 || tx >= base.width || ty >= base.height) continue;
      const src = getPx(layer, x, y);
      if (src.a === 0) continue;
      const dst = getPx(base, tx, ty);
      const sa = src.a / 255;
      const da = dst.a / 255;
      const outA = sa + da * (1 - sa);
      if (outA === 0) {
        setPx(base, tx, ty, { r: 0, g: 0, b: 0, a: 0 });
        continue;
      }
      const r = (src.r * sa + dst.r * da * (1 - sa)) / outA;
      const g = (src.g * sa + dst.g * da * (1 - sa)) / outA;
      const b = (src.b * sa + dst.b * da * (1 - sa)) / outA;
      setPx(base, tx, ty, { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: Math.round(outA * 255) });
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  try {
    const body = await req.json();
    const templateUrl: string = body.templateUrl;
    const width: number = body.width;
    const height: number = body.height;
    const placeholders: Placeholder[] = body.placeholders ?? [];
    const images: Record<string, string> = body.images ?? {};

    if (!templateUrl || !width || !height) {
      return jsonResponse({ error: "Missing templateUrl, width, or height" }, 400);
    }
    if (!placeholders.length) {
      return jsonResponse({ error: "No placeholders to composite" }, 400);
    }

    const base = await loadPng(templateUrl);
    // Ensure base matches declared dimensions
    if (base.width !== width || base.height !== height) {
      // Resize by cover-cropping to target
      const resized = coverCrop(base, width, height);
      // Copy resized data into a new base-sized PNG
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          setPx(base, x, y, getPx(resized, x, y));
        }
      }
    }

    for (const ph of placeholders) {
      const src = images[ph.id];
      if (!src) continue;
      try {
        const layerSrc = await loadPng(src);
        const boxX = Math.round(ph.x * width);
        const boxY = Math.round(ph.y * height);
        const boxW = Math.max(1, Math.round(ph.width * width));
        const boxH = Math.max(1, Math.round(ph.height * height));
        const layer = coverCrop(layerSrc, boxW, boxH);
        applyShapeMask(layer, ph.shape);
        compositeLayer(base, layer, boxX, boxY);
      } catch (err) {
        console.error(`Failed to composite placeholder ${ph.id}:`, err.message);
      }
    }

    const buffer = PNG.sync.write(base);
    const dataUrl = `data:image/png;base64,${uint8ToBase64(buffer)}`;
    return jsonResponse({ image: dataUrl, width, height });
  } catch (err) {
    return jsonResponse({ error: err.message || "Compositing failed" }, 500);
  }
});
