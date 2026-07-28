import { useRef, useState, useCallback } from 'react'
import { Plus, Trash2, Copy, Upload, X, Image as ImageIcon } from 'lucide-react'
import type { Placeholder, PlaceholderShape } from '@/types'
import { cn, uid, fileToDataUrl } from '@/lib/utils'

interface Props {
  imageUrl: string
  placeholders: Placeholder[]
  onChange: (phs: Placeholder[]) => void
  width: number
  height: number
}

type DragMode =
  | { kind: 'move'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: 'resize'; id: string; handle: string; startX: number; startY: number; orig: Placeholder }
  | null

const SHAPE_COLORS: Record<PlaceholderShape, string> = {
  rectangle: '#1f9bff',
  circle: '#10c997',
  rounded: '#ffb547',
}

export function PlaceholderEditor({ imageUrl, placeholders, onChange, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragMode>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({}) // placeholderId -> data url
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const getRelative = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    }
  }, [])

  function onPointerDownMove(e: React.PointerEvent, ph: Placeholder) {
    e.stopPropagation()
    setSelectedId(ph.id)
    setDrag({
      kind: 'move',
      id: ph.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: ph.x,
      origY: ph.y,
    })
  }

  function onPointerDownResize(e: React.PointerEvent, ph: Placeholder, handle: string) {
    e.stopPropagation()
    setDrag({
      kind: 'resize',
      id: ph.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...ph },
    })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return
    const dx = (e.clientX - drag.startX) / (containerRef.current?.getBoundingClientRect().width ?? 1)
    const dy = (e.clientY - drag.startY) / (containerRef.current?.getBoundingClientRect().height ?? 1)

    if (drag.kind === 'move') {
      onChange(
        placeholders.map((p) =>
          p.id === drag.id
            ? { ...p, x: clamp01(drag.origX + dx), y: clamp01(drag.origY + dy) }
            : p,
        ),
      )
    } else if (drag.kind === 'resize') {
      const o = drag.orig
      onChange(
        placeholders.map((p) => {
          if (p.id !== drag.id) return p
          let { x, y, width: w, height: h } = o
          if (drag.handle.includes('e')) w = Math.max(0.04, o.width + dx)
          if (drag.handle.includes('s')) h = Math.max(0.04, o.height + dy)
          if (drag.handle.includes('w')) { w = Math.max(0.04, o.width - dx); x = clamp01(o.x + dx) }
          if (drag.handle.includes('n')) { h = Math.max(0.04, o.height - dy); y = clamp01(o.y + dy) }
          return { ...p, x, y, width: w, height: h }
        }),
      )
    }
  }

  function onPointerUp() {
    setDrag(null)
  }

  function addPlaceholder() {
    const id = uid()
    onChange([
      ...placeholders,
      {
        id,
        type: 'image',
        shape: 'rectangle',
        label: `Photo ${placeholders.length + 1}`,
        confidence: 1,
        rotation: 0,
        x: 0.3,
        y: 0.3,
        width: 0.3,
        height: 0.3,
      },
    ])
    setSelectedId(id)
  }

  function deletePlaceholder(id: string) {
    onChange(placeholders.filter((p) => p.id !== id))
    setSelectedId(null)
  }

  function duplicatePlaceholder(id: string) {
    const ph = placeholders.find((p) => p.id === id)
    if (!ph) return
    const newId = uid()
    onChange([...placeholders, { ...ph, id: newId, x: clamp01(ph.x + 0.05), y: clamp01(ph.y + 0.05) }])
    setSelectedId(newId)
  }

  function updateField(id: string, field: keyof Placeholder, value: any) {
    onChange(placeholders.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  async function handlePreviewUpload(phId: string, file: File) {
    if (!file.type.startsWith('image/')) return
    if (file.size > 20 * 1024 * 1024) return
    const dataUrl = await fileToDataUrl(file)
    setPreviewImages((prev) => ({ ...prev, [phId]: dataUrl }))
  }

  function removePreviewImage(phId: string) {
    setPreviewImages((prev) => {
      const next = { ...prev }
      delete next[phId]
      return next
    })
  }

  const aspect = width && height ? width / height : 1

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Canvas */}
      <div className="card overflow-hidden">
        <div className="border-b border-line p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-white/50">
            {placeholders.length} placeholder{placeholders.length === 1 ? '' : 's'} · {width}×{height}
          </span>
          <button onClick={addPlaceholder} className="btn-ghost text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add placeholder
          </button>
        </div>
        <div className="p-4 bg-bg-elevated/30">
          <div
            ref={containerRef}
            className="relative mx-auto overflow-hidden rounded-xl select-none touch-none"
            style={{ aspectRatio: `${aspect}`, maxWidth: '100%', maxHeight: '60vh' }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerDown={() => setSelectedId(null)}
          >
            <img src={imageUrl} alt="Template" className="absolute inset-0 h-full w-full object-contain pointer-events-none" draggable={false} />
            {placeholders.map((ph) => {
              const color = SHAPE_COLORS[ph.shape]
              const selected = selectedId === ph.id
              const preview = previewImages[ph.id]
              return (
                <div
                  key={ph.id}
                  className={cn(
                    'absolute cursor-move transition-shadow group',
                    selected ? 'shadow-glow z-20' : 'z-10',
                    dragOverId === ph.id && 'ring-2 ring-brand-400',
                  )}
                  style={{
                    left: `${ph.x * 100}%`,
                    top: `${ph.y * 100}%`,
                    width: `${ph.width * 100}%`,
                    height: `${ph.height * 100}%`,
                    border: `2px solid ${color}`,
                    borderRadius: ph.shape === 'circle' ? '50%' : ph.shape === 'rounded' ? '12px' : '0',
                    background: `${color}15`,
                    overflow: 'hidden',
                  }}
                  onPointerDown={(e) => onPointerDownMove(e, ph)}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(ph.id) }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(ph.id) }}
                  onDragLeave={() => setDragOverId((id) => (id === ph.id ? null : id))}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation(); setDragOverId(null)
                    const f = e.dataTransfer.files?.[0]
                    if (f) handlePreviewUpload(ph.id, f)
                  }}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt={ph.label}
                      className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                      draggable={false}
                    />
                  ) : selected ? (
                    <PlaceholderUploadZone
                      color={color}
                      onUpload={(file) => handlePreviewUpload(ph.id, file)}
                    />
                  ) : null}
                  <span
                    className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap z-10"
                    style={{ background: color }}
                  >
                    {ph.label}
                  </span>
                  {preview && selected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removePreviewImage(ph.id) }}
                      className="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-black/80 transition-colors"
                      title="Remove preview image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {selected && (
                    <>
                      {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                        <div
                          key={h}
                          className="absolute h-3 w-3 rounded-sm border-2 bg-bg-base z-20"
                          style={{
                            borderColor: color,
                            cursor: `${h}-resize`,
                            left: h.includes('w') ? '-6px' : 'auto',
                            right: h.includes('e') ? '-6px' : 'auto',
                            top: h.includes('n') ? '-6px' : 'auto',
                            bottom: h.includes('s') ? '-6px' : 'auto',
                          }}
                          onPointerDown={(e) => onPointerDownResize(e, ph, h)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className="card p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Placeholders</h3>
          <button onClick={addPlaceholder} className="btn-ghost text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        {placeholders.length === 0 && (
          <p className="text-xs text-white/40 py-4 text-center">No placeholders. Add one to start.</p>
        )}
        {placeholders.map((ph) => {
          const color = SHAPE_COLORS[ph.shape]
          const selected = selectedId === ph.id
          return (
            <div
              key={ph.id}
              className={cn(
                'rounded-xl border p-3 transition-colors cursor-pointer',
                selected ? 'border-brand-500/40 bg-brand-500/5' : 'border-line bg-bg-elevated/40',
              )}
              onClick={() => setSelectedId(ph.id)}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded" style={{ background: color }} />
                <input
                  className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
                  value={ph.label}
                  onChange={(e) => updateField(ph.id, 'label', e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button onClick={(e) => { e.stopPropagation(); duplicatePlaceholder(ph.id) }} className="text-white/40 hover:text-white" title="Duplicate">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deletePlaceholder(ph.id) }} className="text-white/40 hover:text-danger-400" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {selected && (
                <div className="mt-3 space-y-2 animate-fade-in-fast">
                  {previewImages[ph.id] ? (
                    <div className="flex items-center gap-2 rounded-lg bg-bg-elevated p-2">
                      <ImageIcon className="h-4 w-4 text-brand-400 shrink-0" />
                      <span className="flex-1 truncate text-xs text-white/60">Preview image</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removePreviewImage(ph.id) }}
                        className="text-white/40 hover:text-danger-400 transition-colors"
                        title="Remove preview"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <SideUploadButton onUpload={(file) => handlePreviewUpload(ph.id, file)} />
                  )}
                  <div>
                    <label className="text-xs text-white/50">Shape</label>
                    <div className="mt-1 flex gap-1">
                      {(['rectangle', 'circle', 'rounded'] as PlaceholderShape[]).map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); updateField(ph.id, 'shape', s) }}
                          className={cn(
                            'flex-1 rounded-lg px-2 py-1 text-xs capitalize transition-colors',
                            ph.shape === s ? 'bg-brand-500/20 text-brand-300' : 'bg-bg-elevated text-white/50 hover:text-white',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <NumField label="X" value={ph.x} onChange={(v) => updateField(ph.id, 'x', v)} />
                    <NumField label="Y" value={ph.y} onChange={(v) => updateField(ph.id, 'y', v)} />
                    <NumField label="W" value={ph.width} onChange={(v) => updateField(ph.id, 'width', v)} />
                    <NumField label="H" value={ph.height} onChange={(v) => updateField(ph.id, 'height', v)} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-white/50">{label}</label>
      <input
        type="number"
        step="0.01"
        min="0"
        max="1"
        value={Number(value).toFixed(3)}
        onChange={(e) => onChange(clamp01(parseFloat(e.target.value) || 0))}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-lg bg-bg-elevated border border-line px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
      />
    </div>
  )
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function PlaceholderUploadZone({ color, onUpload }: { color: string; onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
      onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
    >
      <Upload className="h-4 w-4" style={{ color }} />
      <span className="text-[10px] font-medium" style={{ color }}>Add photo</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { e.stopPropagation(); const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = '' }}
      />
    </div>
  )
}

function SideUploadButton({ onUpload }: { onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line py-2 text-xs text-white/50 hover:border-brand-500 hover:text-brand-300 transition-colors"
    >
      <Upload className="h-3.5 w-3.5" />
      Add preview photo
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { e.stopPropagation(); const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = '' }}
      />
    </button>
  )
}
