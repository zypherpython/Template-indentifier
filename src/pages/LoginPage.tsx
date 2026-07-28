import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Sparkles, Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle, enterGuestMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/dashboard'
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', displayName: '' },
  })

  async function onSubmit(values: FormValues) {
    setBusy(true)
    try {
      if (mode === 'login') {
        await signInEmail(values.email, values.password)
        toast.success('Welcome back!')
      } else {
        await signUpEmail(values.email, values.password, values.displayName)
        toast.success('Account created!')
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      toast.error(err.message ?? 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setBusy(true)
    try {
      await signInGoogle()
    } catch (err: any) {
      toast.error(err.message ?? 'Google sign-in failed')
      setBusy(false)
    }
  }

  function handleGuest() {
    enterGuestMode()
    toast.info('Browsing as guest. Upload and save are limited.')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[100px]" />
      </div>
      <div className="w-full max-w-md animate-scale-in">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-semibold">Template<span className="text-brand-400">AI</span></span>
        </Link>

        <div className="card p-8">
          <h1 className="text-2xl font-semibold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-white/50">
            {mode === 'login' ? 'Sign in to upload, save, and reuse templates.' : 'Join the community of template creators.'}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Display name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input {...register('displayName')} className="input pl-10" placeholder="Your name" />
                </div>
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input {...register('email')} type="email" className="input pl-10" placeholder="you@example.com" />
              </div>
              {errors.email && <p className="mt-1 text-xs text-danger-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger-400">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-white/30">
            <div className="h-px flex-1 bg-line" />
            OR
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="space-y-2">
            <button onClick={handleGoogle} disabled={busy} className="btn-secondary w-full">
              <GoogleIcon />
              Continue with Google
            </button>
            <button onClick={handleGuest} disabled={busy} className="btn-ghost w-full">
              Continue as guest
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-white/50">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-brand-400 hover:text-brand-300 font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
