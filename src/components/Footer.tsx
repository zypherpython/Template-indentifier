import { Link } from 'react-router-dom'
import { Sparkles, Github, Twitter } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-line/60 bg-bg-panel/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-semibold">
                Template<span className="text-brand-400">AI</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/50">
              The AI-powered template editor. Upload once, reuse forever. No Photoshop, no Canva — just smart templates.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#" className="rounded-lg bg-bg-elevated p-2 text-white/60 hover:text-white transition-colors" aria-label="GitHub">
                <Github className="h-4 w-4" />
              </a>
              <a href="#" className="rounded-lg bg-bg-elevated p-2 text-white/60 hover:text-white transition-colors" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/80">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/50">
              <li><Link to="/templates" className="hover:text-white transition-colors">Browse Templates</Link></li>
              <li><Link to="/upload" className="hover:text-white transition-colors">Upload Template</Link></li>
              <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/80">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-white/50">
              <li><a href="#" className="hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-line/60 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} TemplateAI. Built with AI.
        </div>
      </div>
    </footer>
  )
}
