import { Link, NavLink, Routes, Route } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Upload,
  Image as ImageIcon,
  Heart,
  FileEdit,
  Settings,
  Loader2,
  Download,
  Eye,
  Trash2,
} from 'lucide-react'
import { supabase, publicStorageUrl } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Template, GeneratedImage } from '@/types'
import { TemplateCard } from '@/components/TemplateCard'
import { cn, formatCount, timeAgo } from '@/lib/utils'
import { useState } from 'react'
import { toast } from 'sonner'

export function DashboardPage() {
  const { user, profile, isGuest, refreshProfile } = useAuth()

  const tabs = [
    { to: '/dashboard', label: 'Uploaded', icon: ImageIcon, end: true },
    { to: '/dashboard/generated', label: 'Generated', icon: Download },
    { to: '/dashboard/drafts', label: 'Drafts', icon: FileEdit },
    { to: '/dashboard/favorites', label: 'Favorites', icon: Heart },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-white/50">
          {isGuest ? 'Browsing as guest — sign up to save your work.' : `Welcome back, ${profile?.display_name ?? 'Creator'}.`}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        {/* Sidebar */}
        <aside className="card p-3 h-fit sticky top-20">
          <nav className="flex flex-col gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-500/15 text-brand-300' : 'text-white/60 hover:text-white hover:bg-bg-elevated',
                  )
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div>
          <Routes>
            <Route index element={<UploadedTemplates />} />
            <Route path="generated" element={<GeneratedImages />} />
            <Route path="drafts" element={<DraftTemplates />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="settings" element={<SettingsTab onSaved={refreshProfile} />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function UploadedTemplates() {
  const { user, isGuest } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'uploaded', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Template[]
    },
    enabled: !!user && !isGuest,
  })

  if (isGuest) return <GuestNotice />
  if (isLoading) return <Loading />
  if (!data?.length) return <Empty icon={Upload} title="No templates yet" desc="Upload your first template to see it here." cta />

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((t) => <TemplateCard key={t.id} template={t} />)}
    </div>
  )
}

function DraftTemplates() {
  const { user, isGuest } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'drafts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('owner_id', user!.id)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Template[]
    },
    enabled: !!user && !isGuest,
  })

  if (isGuest) return <GuestNotice />
  if (isLoading) return <Loading />
  if (!data?.length) return <Empty icon={FileEdit} title="No drafts" desc="Save a template as draft to find it here." />

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((t) => <TemplateCard key={t.id} template={t} />)}
    </div>
  )
}

function GeneratedImages() {
  const { user, isGuest } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'generated', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_images')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as GeneratedImage[]
    },
    enabled: !!user && !isGuest,
  })

  if (isGuest) return <GuestNotice />
  if (isLoading) return <Loading />
  if (!data?.length) return <Empty icon={Download} title="No generated images" desc="Use a template to create your first image." />

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((img) => (
        <div key={img.id} className="card overflow-hidden group">
          <div className="aspect-square overflow-hidden bg-bg-elevated">
            <img src={publicStorageUrl('generated', img.image_path)} alt="Generated" className="h-full w-full object-cover" loading="lazy" />
          </div>
          <div className="p-3">
            <div className="text-xs text-white/40">{timeAgo(img.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Favorites() {
  const { user, isGuest } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'favorites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('template_id, templates(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r: any) => r.templates as Template).filter(Boolean)
    },
    enabled: !!user && !isGuest,
  })

  if (isGuest) return <GuestNotice />
  if (isLoading) return <Loading />
  if (!data?.length) return <Empty icon={Heart} title="No favorites yet" desc="Save templates you love to find them here." />

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((t) => <TemplateCard key={t.id} template={t} />)}
    </div>
  )
}

function SettingsTab({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user, profile, isGuest } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!user || isGuest) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: name || 'Creator', bio: bio || null } as any)
        .eq('id', user.id)
      if (error) throw error
      await onSaved()
      toast.success('Settings saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (isGuest) return <GuestNotice />

  return (
    <div className="card p-6 max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">Profile settings</h2>
      <div>
        <label className="label">Display name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label className="label">Bio</label>
        <textarea className="input min-h-[80px] resize-none" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the community about yourself" />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input opacity-60" value={user?.email ?? ''} disabled />
      </div>
      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save changes
      </button>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
    </div>
  )
}

function Empty({ icon: Icon, title, desc, cta }: { icon: any; title: string; desc: string; cta?: boolean }) {
  return (
    <div className="card p-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-white/20" />
      <h3 className="mt-3 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-white/40">{desc}</p>
      {cta && <Link to="/upload" className="btn-primary mt-5"><Upload className="h-4 w-4" />Upload a template</Link>}
    </div>
  )
}

function GuestNotice() {
  return (
    <div className="card p-12 text-center">
      <LayoutDashboard className="mx-auto h-10 w-10 text-white/20" />
      <h3 className="mt-3 text-lg font-medium">Sign in to access your dashboard</h3>
      <p className="mt-1 text-sm text-white/40">Guest mode is for browsing only. Create an account to save templates and images.</p>
      <Link to="/login" className="btn-primary mt-5">Sign in or sign up</Link>
    </div>
  )
}
