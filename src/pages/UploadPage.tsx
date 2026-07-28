import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Upload,
  X,
  Plus,
  Trash2,
  Loader2,
  Wand2,
  Save,
  ArrowRight,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Maximize2,
  Move,
} from 'lucide-react'
import { supabase, EDGE_URLS, publicStorageUrl } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { fileToDataUrl, dataUrlToBlob, uid, cn } from '@/lib/utils'
import type { Placeholder, PlaceholderShape, TemplateVisibility, TemplateStatus } from '@/types'
import { CATEGORIES } from '@/types'
import { PlaceholderEditor } from '@/components/PlaceholderEditor'

type Step = 'upload' | 'analyzing' | 'review' | 'metadata' | 'saving'

const MAX_BYTES = 20 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg']

export function UploadPage() {
  const { user, isGuest } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([])
  const [originalPrediction, setOriginalPrediction] = useState<Placeholder[]>([])
  const [dims, setDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [analysisSource, setAnalysisSource] = useState<'gemini' | 'vision' | 'fallback' | ''>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Metadata state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('General')
  const [tagsRaw, setTagsRaw] = useState('')
  const [visibility, setVisibility] = useState<TemplateVisibility>('public')
  const [saveDraft, setSaveDraft] = useState(false)

  const handleFile = useCallback((f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      toast.error('Please upload a PNG or JPG image.')
      return
    }
    if (f.size > MAX_BYTES) {
      toast.error('File too large. Maximum 20MB.')
      return
    }
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setStep('upload')
  }, [])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  async function analyze() {
    if (!file) return
    setStep('analyzing')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(EDGE_URLS.analyze, { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Analysis failed (${res.status})`)
      }
      const data = await res.json()
      const ph: Placeholder[] = (data.placeholders ?? []).map((p: Placeholder) => ({ ...p, id: String(p.id) }))
      setPlaceholders(ph)
      setOriginalPrediction(ph)
      setDims({ width: data.width, height: data.height })
      setAnalysisSource(data.source)
      setStep('review')
      toast.success(`AI detected ${ph.length} placeholder${ph.length === 1 ? '' : 's'}.`)
    } catch (err: any) {
      toast.error(err.message ?? 'Analysis failed')
      setStep('upload')
    }
  }

  function reset() {
    setFile(null)
    setPreviewUrl('')
    setPlaceholders([])
    setOriginalPrediction([])
    setStep('upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function saveTemplate(status: TemplateStatus) {
    if (!user || isGuest) {
      toast.error('Sign in to save templates.')
      navigate('/login')
      return
    }
    if (!file) return
    setStep('saving')
    try {
      const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      const ownerId = user.id
      const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'png'
      const objectPath = `${ownerId}/${uid()}.${fileExt}`
      const thumbPath = `${ownerId}/${uid()}-thumb.jpg`

      // Upload original image
      const { error: upErr } = await supabase.storage.from('templates').upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr

      // Generate a thumbnail (just reuse the original as thumbnail for now — the card uses object-cover)
      const { error: thumbErr } = await supabase.storage.from('templates').upload(thumbPath, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (thumbErr) throw thumbErr

      const { data, error } = await supabase
        .from('templates')
        .insert({
          owner_id: ownerId,
          title: title || file.name.replace(/\.[^.]+$/, ''),
          description: description || null,
          category,
          tags,
          visibility,
          status,
          image_path: objectPath,
          thumbnail_path: thumbPath,
          image_width: dims.width,
          image_height: dims.height,
          placeholders,
        } as any)
        .select('*')
        .single()

      if (error) throw error

      // Save correction data if user edited placeholders
      const changed = JSON.stringify(placeholders) !== JSON.stringify(originalPrediction)
      if (changed && data) {
        await supabase.from('template_corrections').insert({
          template_id: (data as any).id,
          original_prediction: originalPrediction,
          corrected_placeholders: placeholders,
          confidence: placeholders.length ? placeholders.reduce((a, p) => a + p.confidence, 0) / placeholders.length : 0,
        } as any)
      }

      toast.success(status === 'draft' ? 'Draft saved.' : 'Template published!')
      navigate(`/templates/${(data as any).id}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save template')
      setStep('metadata')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Upload a template</h1>
        <p className="mt-1 text-white/50">Drop an image, let AI detect placeholders, then save it to the library.</p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        {[
          { key: 'upload', label: 'Upload', icon: Upload },
          { key: 'review', label: 'Review', icon: Wand2 },
          { key: 'metadata', label: 'Details', icon: ImageIcon },
        ].map((s, i) => {
          const active = step === s.key || (step === 'analyzing' && s.key === 'upload') || (step === 'saving' && s.key === 'metadata')
          const done = (step === 'review' && s.key === 'upload') || (step === 'metadata' && s.key !== 'metadata') || (step === 'saving' && s.key !== 'metadata')
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors',
                active ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30' : done ? 'text-white/60' : 'text-white/30',
              )}>
                {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                {s.label}
              </div>
              {i < 2 && <div className="h-px w-6 bg-line" />}
            </div>
          )
        })}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="animate-fade-in">
          {!file ? (
            <div
              className={cn(
                'relative flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
                dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-line bg-bg-card/50',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-medium">Drag and drop your template</h3>
              <p className="mt-1 text-sm text-white/50">PNG or JPG, up to 20MB</p>
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary mt-5">
                Choose file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line p-4">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-brand-400" />
                  <span className="text-sm font-medium truncate max-w-[300px]">{file.name}</span>
                  <span className="chip-default">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <button onClick={reset} className="btn-ghost">
                  <X className="h-4 w-4" />
                  Remove
                </button>
              </div>
              <div className="p-4">
                <div className="overflow-hidden rounded-xl bg-bg-elevated">
                  <img src={previewUrl} alt="Preview" className="mx-auto max-h-[400px] object-contain" />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-line p-4">
                <button onClick={reset} className="btn-secondary">Cancel</button>
                <button onClick={analyze} className="btn-primary">
                  <Wand2 className="h-4 w-4" />
                  Analyze with AI
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step: Analyzing */}
      {step === 'analyzing' && (
        <div className="flex min-h-[320px] flex-col items-center justify-center animate-fade-in">
          <div className="relative">
            <div className="h-16 w-16 animate-spin-slow rounded-full border-2 border-line border-t-brand-500" />
            <Wand2 className="absolute inset-0 m-auto h-6 w-6 text-brand-400" />
          </div>
          <h3 className="mt-6 text-lg font-medium">Analyzing template…</h3>
          <p className="mt-1 text-sm text-white/50">Detecting editable photo placeholders with AI.</p>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Review placeholders</h2>
              <p className="mt-1 text-sm text-white/50">
                Drag to move, resize handles to adjust.{' '}
                {analysisSource === 'gemini'
                  ? 'Detected by Gemini AI.'
                  : analysisSource === 'vision'
                    ? 'Detected by built-in computer vision.'
                    : 'Smart estimate — refine as needed.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('upload')} className="btn-secondary">
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button onClick={() => setStep('metadata')} className="btn-primary">
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <PlaceholderEditor
            imageUrl={previewUrl}
            placeholders={placeholders}
            onChange={setPlaceholders}
            width={dims.width}
            height={dims.height}
          />
        </div>
      )}

      {/* Step: Metadata */}
      {step === 'metadata' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Template details</h2>
              <p className="mt-1 text-sm text-white/50">Add metadata so others can find your template.</p>
            </div>
            <button onClick={() => setStep('review')} className="btn-secondary">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-line p-3 text-xs font-medium text-white/50">Preview</div>
              <div className="p-4">
                <div className="overflow-hidden rounded-xl bg-bg-elevated">
                  <img src={previewUrl} alt="Preview" className="mx-auto max-h-[300px] object-contain" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {placeholders.map((p) => (
                    <span key={p.id} className="chip-default">
                      <span className={cn('h-1.5 w-1.5 rounded-full', p.shape === 'circle' ? 'rounded-full' : 'rounded', 'bg-brand-400')} />
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Birthday Collage Template"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A vibrant birthday template with a main photo and profile circle."
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input
                  className="input"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="birthday, collage, photo"
                />
              </div>
              <div>
                <label className="label">Visibility</label>
                <div className="flex gap-2">
                  {(['public', 'private'] as TemplateVisibility[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className={cn(
                        'flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors',
                        visibility === v ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-line text-white/60 hover:text-white',
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/60">
                <input
                  type="checkbox"
                  checked={saveDraft}
                  onChange={(e) => setSaveDraft(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-brand-500"
                />
                Save as draft (won't appear in the library)
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setStep('review')} className="btn-secondary">Back</button>
            <button
              onClick={() => saveTemplate(saveDraft ? 'draft' : 'published')}
              className="btn-primary"
            >
              <Save className="h-4 w-4" />
              {saveDraft ? 'Save draft' : 'Publish template'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Saving */}
      {step === 'saving' && (
        <div className="flex min-h-[320px] flex-col items-center justify-center animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-brand-400" />
          <h3 className="mt-4 text-lg font-medium">Saving template…</h3>
          <p className="mt-1 text-sm text-white/50">Uploading image and storing metadata.</p>
        </div>
      )}
    </div>
  )
}
