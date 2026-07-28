import { useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Upload,
  Loader2,
  Download,
  RotateCcw,
  Save,
  X,
  Image as ImageIcon,
  Wand2,
  Check,
} from 'lucide-react'
import { supabase, EDGE_URLS, publicStorageUrl } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Template, Placeholder } from '@/types'
import { fileToDataUrl, cn, uid } from '@/lib/utils'

export function UseTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isGuest } = useAuth()
  const qc = useQueryClient()

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as Template | null
    },
    enabled: !!id,
  })

  const [images, setImages] = useState<Record<string, string>>({}) // placeholderId -> data url
  const [compositing, setCompositing] = useState(false)
  const [resultUrl, setResultUrl] = useState<string>('')
  const [savedToGallery, setSavedToGallery] = useState(false)

  async function handleFile(phId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image too large. Max 20MB.')
      return
    }
    const dataUrl = await fileToDataUrl(file)
    setImages((prev) => ({ ...prev, [phId]: dataUrl }))
    setResultUrl('')
    setSavedToGallery(false)
  }

  function removeImage(phId: string) {
    setImages((prev) => {
      const next = { ...prev }
      delete next[phId]
      return next
    })
    setResultUrl('')
    setSavedToGallery(false)
  }

  async function composite() {
    if (!template) return
    const placeholders = template.placeholders ?? []
    const missing = placeholders.filter((p) => !images[p.id])
    if (missing.length > 0) {
      toast.error(`Please upload images for all placeholders (${missing.length} missing).`)
      return
    }
    setCompositing(true)
    setResultUrl('')
    try {
      const templateUrl = publicStorageUrl('templates', template.image_path)
      const res = await fetch(EDGE_URLS.composite, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUrl,
          width: template.image_width,
          height: template.image_height,
          placeholders: placeholders.map((p) => ({
            id: p.id,
            shape: p.shape,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            rotation: p.rotation,
          })),
          images,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Compositing failed (${res.status})`)
      }
      const data = await res.json()
      setResultUrl(data.image)
      toast.success('Image generated!')

      // Increment download counter
      await supabase.from('downloads').insert({ template_id: template.id, user_id: user?.id ?? null } as any)
      await supabase.from('templates').update({ downloads: (template.downloads ?? 0) + 1 } as any).eq('id', template.id)
      qc.invalidateQueries({ queryKey: ['template', id] })
    } catch (err: any) {
      toast.error(err.message ?? 'Compositing failed')
    } finally {
      setCompositing(false)
    }
  }

  function downloadResult() {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `${template?.title?.replace(/\s+/g, '-').toLowerCase() ?? 'template'}-${uid()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function saveCopyToGallery() {
    if (!template || !resultUrl) return
    if (!user || isGuest) {
      toast.info('Sign in to save copies to your gallery.')
      return
    }
    try {
      const blob = await (await fetch(resultUrl)).blob()
      const path = `${user.id}/${uid()}.png`
      const { error: upErr } = await supabase.storage.from('generated').upload(path, blob, { cacheControl: '3600' })
      if (upErr) throw upErr
      const inputs = Object.entries(images).map(([placeholderId, url]) => ({ placeholderId, url: '' }))
      const { error } = await supabase.from('generated_images').insert({
        template_id: template.id,
        image_path: path,
        inputs,
      } as any)
      if (error) throw error
      setSavedToGallery(true)
      toast.success('Saved to your gallery!')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Template not found</h1>
        <Link to="/templates" className="btn-primary mt-6">Browse templates</Link>
      </div>
    )
  }

  const placeholders: Placeholder[] = template.placeholders ?? []
  const allUploaded = placeholders.every((p) => images[p.id])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 animate-fade-in">
      <Link to={`/templates/${template.id}`} className="btn-ghost mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to template
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Use this template</h1>
        <p className="mt-1 text-white/50">Upload your own photos for each placeholder. We'll composite them automatically.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Upload form */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-line p-3">
              <span className="text-sm font-semibold">Reference</span>
            </div>
            <div className="bg-bg-elevated/30 p-4">
              <div className="mx-auto overflow-hidden rounded-xl" style={{ aspectRatio: `${template.image_width}/${template.image_height}`, maxHeight: '300px' }}>
                <img src={publicStorageUrl('templates', template.image_path)} alt={template.title} className="h-full w-full object-contain" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {placeholders.map((ph, idx) => (
              <UploadSlot
                key={ph.id}
                placeholder={ph}
                index={idx}
                imageUrl={images[ph.id]}
                onUpload={(file) => handleFile(ph.id, file)}
                onRemove={() => removeImage(ph.id)}
              />
            ))}
          </div>

          <button
            onClick={composite}
            disabled={!allUploaded || compositing}
            className="btn-primary w-full text-base"
          >
            {compositing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
            {compositing ? 'Generating…' : 'Generate image'}
          </button>
          {!allUploaded && (
            <p className="text-center text-xs text-white/40">
              Upload all {placeholders.length} image{placeholders.length === 1 ? '' : 's'} to continue
            </p>
          )}
        </div>

        {/* Result */}
        <div>
          {resultUrl ? (
            <div className="card overflow-hidden animate-scale-in">
              <div className="border-b border-line p-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-accent-400" />
                <span className="text-sm font-semibold">Your image is ready</span>
              </div>
              <div className="bg-bg-elevated/30 p-4">
                <div className="mx-auto overflow-hidden rounded-xl" style={{ aspectRatio: `${template.image_width}/${template.image_height}`, maxHeight: '500px' }}>
                  <img src={resultUrl} alt="Generated" className="h-full w-full object-contain" />
                </div>
              </div>
              <div className="border-t border-line p-4 space-y-2">
                <button onClick={downloadResult} className="btn-primary w-full">
                  <Download className="h-4 w-4" />
                  Download PNG
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={saveCopyToGallery}
                    disabled={savedToGallery || isGuest}
                    className="btn-secondary flex-1"
                  >
                    {savedToGallery ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {savedToGallery ? 'Saved' : 'Save copy'}
                  </button>
                  <button
                    onClick={() => { setResultUrl(''); setImages({}); setSavedToGallery(false) }}
                    className="btn-secondary flex-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Create another
                  </button>
                </div>
                {isGuest && (
                  <p className="text-center text-xs text-white/40">Sign in to save copies to your gallery.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-elevated">
                <ImageIcon className="h-8 w-8 text-white/20" />
              </div>
              <h3 className="mt-4 text-lg font-medium">Your result will appear here</h3>
              <p className="mt-1 text-sm text-white/40">Upload photos and click Generate to composite them into the template.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UploadSlot({
  placeholder,
  index,
  imageUrl,
  onUpload,
  onRemove,
}: {
  placeholder: Placeholder
  index: number
  imageUrl?: string
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/20 text-xs font-semibold text-brand-300">
            {index + 1}
          </span>
          <div>
            <div className="text-sm font-medium">{placeholder.label}</div>
            <div className="text-xs text-white/40 capitalize">{placeholder.shape}</div>
          </div>
        </div>
        {imageUrl && (
          <button onClick={onRemove} className="btn-ghost text-xs">
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl bg-bg-elevated">
          <img src={imageUrl} alt={placeholder.label} className="mx-auto max-h-32 object-contain" />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-bg-base/70 text-sm font-medium opacity-0 transition-opacity hover:opacity-100"
          >
            Replace
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onUpload(f) }}
          className={cn(
            'flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
            dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-line hover:border-line-strong',
          )}
        >
          <Upload className="h-5 w-5 text-white/30" />
          <span className="mt-1 text-xs text-white/40">Click or drop image</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />
    </div>
  )
}
