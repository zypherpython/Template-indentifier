import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Download,
  Heart,
  Eye,
  Sparkles,
  Wand2,
  Loader2,
  User,
  Tag,
} from 'lucide-react'
import { supabase, publicStorageUrl } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Template } from '@/types'
import { formatCount, timeAgo, cn } from '@/lib/utils'

export function TemplateDetailPage() {
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

  const { data: owner } = useQuery({
    queryKey: ['profile', template?.owner_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', template!.owner_id)
        .maybeSingle()
      return data as any
    },
    enabled: !!template?.owner_id,
  })

  const { data: liked } = useQuery({
    queryKey: ['liked', id, user?.id],
    queryFn: async () => {
      if (!user) return false
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('template_id', id!)
        .eq('user_id', user.id)
        .maybeSingle()
      return !!data
    },
    enabled: !!user && !!id,
  })

  const { data: favorited } = useQuery({
    queryKey: ['favorited', id, user?.id],
    queryFn: async () => {
      if (!user) return false
      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('template_id', id!)
        .eq('user_id', user.id)
        .maybeSingle()
      return !!data
    },
    enabled: !!user && !!id,
  })

  // Increment view count once per mount.
  useEffect(() => {
    if (!id || !template) return
    supabase
      .from('templates')
      .update({ views: (template.views ?? 0) + 1 } as any)
      .eq('id', id)
      .then(() => qc.invalidateQueries({ queryKey: ['template', id] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function toggleLike() {
    if (!user || isGuest) {
      toast.info('Sign in to like templates.')
      navigate('/login')
      return
    }
    if (!template) return
    try {
      if (liked) {
        await supabase.from('likes').delete().eq('template_id', template.id).eq('user_id', user.id)
        await supabase.from('templates').update({ likes: Math.max(0, template.likes - 1) } as any).eq('id', template.id)
      } else {
        await supabase.from('likes').insert({ template_id: template.id, user_id: user.id } as any)
        await supabase.from('templates').update({ likes: template.likes + 1 } as any).eq('id', template.id)
      }
      qc.invalidateQueries({ queryKey: ['liked', id, user.id] })
      qc.invalidateQueries({ queryKey: ['template', id] })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function toggleFavorite() {
    if (!user || isGuest) {
      toast.info('Sign in to favorite templates.')
      navigate('/login')
      return
    }
    if (!template) return
    try {
      if (favorited) {
        await supabase.from('favorites').delete().eq('template_id', template.id).eq('user_id', user.id)
        toast.success('Removed from favorites')
      } else {
        await supabase.from('favorites').insert({ template_id: template.id, user_id: user.id } as any)
        toast.success('Added to favorites')
      }
      qc.invalidateQueries({ queryKey: ['favorited', id, user.id] })
    } catch (err: any) {
      toast.error(err.message)
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
        <p className="mt-2 text-white/50">It may have been deleted or made private.</p>
        <Link to="/templates" className="btn-primary mt-6">Browse templates</Link>
      </div>
    )
  }

  const imgUrl = publicStorageUrl('templates', template.image_path)
  const isOwner = user?.id === template.owner_id

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 animate-fade-in">
      <Link to="/templates" className="btn-ghost mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to library
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Preview */}
        <div className="card overflow-hidden">
          <div className="bg-bg-elevated/30 p-4">
            <div className="mx-auto overflow-hidden rounded-xl" style={{ aspectRatio: `${template.image_width}/${template.image_height}`, maxHeight: '70vh' }}>
              <img src={imgUrl} alt={template.title} className="h-full w-full object-contain" />
            </div>
          </div>
          {/* Placeholder overlay legend */}
          <div className="border-t border-line p-4">
            <h3 className="text-sm font-semibold mb-2">Detected placeholders</h3>
            <div className="flex flex-wrap gap-2">
              {template.placeholders?.map((p) => (
                <span key={p.id} className="chip-default">
                  <span className={cn('h-2 w-2 rounded-full', p.shape === 'circle' ? 'rounded-full' : 'rounded', 'bg-brand-400')} />
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="chip-brand">{template.category}</span>
              {template.status === 'draft' && <span className="chip-default">Draft</span>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{template.title}</h1>
            {template.description && <p className="mt-2 text-white/60">{template.description}</p>}
          </div>

          {/* Creator */}
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">{owner?.display_name ?? 'Creator'}</div>
              <div className="text-xs text-white/40">Uploaded {timeAgo(template.created_at)}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Eye} label="Views" value={template.views} />
            <Stat icon={Download} label="Downloads" value={template.downloads} />
            <Stat icon={Heart} label="Likes" value={template.likes} />
          </div>

          {/* Tags */}
          {template.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((t) => (
                <span key={t} className="chip-default">
                  <Tag className="h-3 w-3" />
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/templates/${template.id}/use`)}
              className="btn-primary flex-1 text-base"
            >
              <Wand2 className="h-5 w-5" />
              Use this template
            </button>
            <button
              onClick={toggleLike}
              className={cn('btn-secondary', liked && 'border-danger-500/40 text-danger-400')}
            >
              <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
              {liked ? 'Liked' : 'Like'}
            </button>
            <button
              onClick={toggleFavorite}
              className={cn('btn-secondary', favorited && 'border-brand-500/40 text-brand-300')}
            >
              <Sparkles className="h-4 w-4" />
              {favorited ? 'Saved' : 'Save'}
            </button>
          </div>

          {isOwner && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-2">Owner tools</h3>
              <p className="text-xs text-white/40">This is your template. You can edit it from your dashboard.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-white/40" />
      <div className="mt-1 text-lg font-semibold">{formatCount(value)}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  )
}
