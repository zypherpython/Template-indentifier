import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { LayoutGrid, Upload, LayoutDashboard, LogIn, LogOut, User, Menu, X, Sparkles } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { user, profile, signOut, isGuest } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const links = [
    { to: '/templates', label: 'Templates', icon: LayoutGrid },
    { to: '/upload', label: 'Upload Template', icon: Upload },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ]

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-bg-base/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow transition-transform group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Template<span className="text-brand-400">AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-bg-elevated text-white' : 'text-white/60 hover:text-white hover:bg-bg-elevated/60',
                )
              }
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user || isGuest ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 rounded-xl bg-bg-elevated px-3 py-2 text-sm hover:bg-bg-hover transition-colors"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="max-w-[120px] truncate">
                  {isGuest ? 'Guest' : profile?.display_name ?? 'Account'}
                </span>
              </Link>
              <button onClick={handleSignOut} className="btn-ghost" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary">
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-white/70 hover:bg-bg-elevated md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line/60 bg-bg-panel px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-bg-elevated text-white' : 'text-white/70 hover:text-white',
                  )
                }
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-line/60 pt-2">
              {user || isGuest ? (
                <button onClick={handleSignOut} className="btn-secondary w-full">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : (
                <Link to="/login" onClick={() => setOpen(false)} className="btn-primary w-full">
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
