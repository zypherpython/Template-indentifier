import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Template, SortOption } from '@/types'
import { CATEGORIES, SORT_OPTIONS } from '@/types'
import { TemplateCard, TemplateCardSkeleton } from '@/components/TemplateCard'
import { cn } from '@/lib/utils'

export function TemplatesPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [showFilters, setShowFilters] = useState(false)

  const category = params.get('category') ?? ''
  const sort = (params.get('sort') ?? 'newest') as SortOption

  useEffect(() => {
    setSearch(params.get('q') ?? '')
  }, [params])

  const { data, isLoading } = useQuery({
    queryKey: ['templates', 'list', { search, category, sort }],
    queryFn: async () => {
      let q = supabase
        .from('templates')
        .select('*')
        .eq('visibility', 'public')
        .eq('status', 'published')

      if (category) q = q.eq('category', category)

      if (search.trim()) {
        q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
      }

      switch (sort) {
        case 'popular': q = q.order('likes', { ascending: false }); break
        case 'downloads': q = q.order('downloads', { ascending: false }); break
        case 'recent': q = q.order('created_at', { ascending: false }); break
        default: q = q.order('created_at', { ascending: false })
      }

      const { data, error } = await q.limit(48)
      if (error) throw error
      return (data ?? []) as Template[]
    },
  })

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateParam('q', search)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Template Library</h1>
        <p className="mt-1 text-white/50">Browse community templates and reuse them with your own photos.</p>
      </div>

      {/* Search + sort */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={onSearchSubmit} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="input pl-10"
          />
          {search && (
            <button type="button" onClick={() => { setSearch(''); updateParam('q', '') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <div className="flex gap-2">
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="input w-auto"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn('btn-secondary', showFilters && 'border-brand-500 text-brand-300')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Category filters */}
      {showFilters && (
        <div className="mb-6 card p-4 animate-fade-in-fast">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateParam('category', '')}
              className={cn('chip', !category ? 'chip-brand' : 'chip-default')}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => updateParam('category', c === category ? '' : c)}
                className={cn('chip', category === c ? 'chip-brand' : 'chip-default')}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <TemplateCardSkeleton key={i} />)}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((t) => <TemplateCard key={t.id} template={t} />)}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <Search className="mx-auto h-10 w-10 text-white/20" />
          <h3 className="mt-3 text-lg font-medium">No templates found</h3>
          <p className="mt-1 text-sm text-white/40">Try a different search or category.</p>
        </div>
      )}
    </div>
  )
}
