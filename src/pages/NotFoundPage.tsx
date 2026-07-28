import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-7xl font-bold text-white/10">404</div>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-white/50">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn-primary mt-6">
        <Home className="h-4 w-4" />
        Back home
      </Link>
    </div>
  )
}
