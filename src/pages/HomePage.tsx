import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles,
  Upload,
  Wand2,
  Image as ImageIcon,
  Download,
  ArrowRight,
  Layers,
  Users,
  Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Template } from '@/types'
import { TemplateCard, TemplateCardSkeleton } from '@/components/TemplateCard'
import { CATEGORIES } from '@/types'

export function HomePage() {
  const trending = useQuery({
    queryKey: ['templates', 'trending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('visibility', 'public')
        .eq('status', 'published')
        .order('likes', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })

  const newest = useQuery({
    queryKey: ['templates', 'newest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('visibility', 'public')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
          <div className="absolute right-0 top-40 h-[300px] w-[400px] rounded-full bg-accent-500/10 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-bg-card/60 px-4 py-1.5 text-sm text-white/70 backdrop-blur-md animate-fade-in">
              <Sparkles className="h-4 w-4 text-brand-400" />
              AI-powered template detection
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              Templates that <span className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">understand themselves</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
              Upload an image template once. Our AI detects every editable photo placeholder.
              Anyone can reuse it with their own photos — no Photoshop, no manual editing.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/upload" className="btn-primary text-base">
                <Upload className="h-5 w-5" />
                Upload a Template
              </Link>
              <Link to="/templates" className="btn-secondary text-base">
                Browse Library
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4">
            {[
              { icon: Layers, label: 'Smart Detection', value: 'AI' },
              { icon: Zap, label: 'Instant Compositing', value: 'Fast' },
              { icon: Users, label: 'Community Library', value: 'Open' },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <s.icon className="mx-auto h-5 w-5 text-brand-400" />
                <div className="mt-2 text-lg font-semibold">{s.value}</div>
                <div className="text-xs text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="text-xl font-semibold">Find a template</h2>
              <p className="mt-1 text-sm text-white/50">Search the community library and jump straight in.</p>
            </div>
            <Link to="/templates" className="btn-secondary">
              Open full library
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link key={c} to={`/templates?category=${encodeURIComponent(c)}`} className="chip-default hover:bg-brand-500/15 hover:text-brand-300 hover:border-brand-500/30 transition-colors">
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold">
              <span className="text-brand-400">Trending</span> templates
            </h2>
            <p className="mt-1 text-sm text-white/50">Most loved by the community this week.</p>
          </div>
          <Link to="/templates?sort=popular" className="btn-ghost">
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {trending.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <TemplateCardSkeleton key={i} />)
            : trending.data?.length
              ? trending.data.map((t) => <TemplateCard key={t.id} template={t} />)
              : <EmptyState label="No trending templates yet" />}
        </div>
      </section>

      {/* Newest */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Newest templates</h2>
            <p className="mt-1 text-sm text-white/50">Fresh from the community.</p>
          </div>
          <Link to="/templates?sort=newest" className="btn-ghost">
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {newest.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <TemplateCardSkeleton key={i} />)
            : newest.data?.length
              ? newest.data.map((t) => <TemplateCard key={t.id} template={t} />)
              : <EmptyState label="No templates yet — be the first to upload!" />}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold">How it works</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/50">Three steps from upload to finished image.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Upload, step: '01', title: 'Upload a template', desc: 'Drop any PNG or JPG. The AI analyzes it and detects every editable photo region.' },
            { icon: Wand2, step: '02', title: 'Review placeholders', desc: 'Tweak bounding boxes, rename labels, or add new ones. Save it to the library.' },
            { icon: Download, step: '03', title: 'Reuse & download', desc: 'Anyone picks a template, uploads their photos, and gets a finished PNG instantly.' },
          ].map((s) => (
            <div key={s.step} className="card relative overflow-hidden p-6">
              <div className="absolute right-4 top-4 text-5xl font-bold text-white/5">{s.step}</div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/60">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="card relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-500/10 to-accent-500/10" />
          <ImageIcon className="mx-auto h-10 w-10 text-brand-400" />
          <h2 className="mt-4 text-3xl font-semibold">Got a template to share?</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/60">
            Upload it once. Let the AI do the heavy lifting. The community gets a reusable, smart template.
          </p>
          <Link to="/upload" className="btn-primary mt-6 text-base">
            <Upload className="h-5 w-5" />
            Upload your first template
          </Link>
        </div>
      </section>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-full card p-12 text-center">
      <ImageIcon className="mx-auto h-10 w-10 text-white/20" />
      <p className="mt-3 text-sm text-white/40">{label}</p>
    </div>
  )
}
