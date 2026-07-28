import { Link } from 'react-router-dom'
import { Download, Heart, Eye } from 'lucide-react'
import type { Template } from '@/types'
import { publicStorageUrl } from '@/lib/supabase'
import { formatCount } from '@/lib/utils'

export function TemplateCard({ template }: { template: Template }) {
  const thumb = publicStorageUrl('templates', template.thumbnail_path)

  return (
    <Link
      to={`/templates/${template.id}`}
      className="card group overflow-hidden transition-all duration-300 hover:border-line-strong hover:shadow-glow hover:-translate-y-0.5"
    >
      <div className="relative aspect-square overflow-hidden bg-bg-elevated">
        <img
          src={thumb}
          alt={template.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute left-3 top-3 chip-default backdrop-blur-md">
          {template.category}
        </span>
      </div>
      <div className="p-4">
        <h3 className="truncate font-medium text-white group-hover:text-brand-300 transition-colors">
          {template.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-white/40">
          {template.placeholders?.length ?? 0} placeholder{(template.placeholders?.length ?? 0) === 1 ? '' : 's'}
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            {formatCount(template.downloads)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {formatCount(template.likes)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {formatCount(template.views)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function TemplateCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-square" />
      <div className="p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton mt-2 h-3 w-1/3 rounded" />
        <div className="skeleton mt-3 h-3 w-1/2 rounded" />
      </div>
    </div>
  )
}
