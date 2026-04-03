import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'GigLedger - Uber Earnings Calculator & Gig Worker Pay Tracker',
  description: 'Upload your Uber earnings screenshot. See your true net income after gas and vehicle costs. Free, 5 seconds.',
  keywords: 'uber earnings calculator, gig worker earnings, doordash earnings calculator, how much do uber drivers make',
  openGraph: {
    title: 'GigLedger - Know Your Real Earnings',
    description: 'Upload your Uber earnings screenshot. See your true net income after costs. Free, 5 seconds.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GigLedger - Know Your Real Earnings',
    description: 'Upload your Uber earnings. See your true net income.',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#2563EB" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GigLedger" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className="min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">G</div>
                <span className="font-bold text-slate-800 text-lg">GigLedger</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-6">
                <Link href="/analyze" className="text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors">Calculate</Link>
                <Link href="/tracker" className="text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors">Tracker</Link>
                <Link href="/about" className="text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors">About</Link>
              </nav>
              <Link href="/analyze" className="btn-primary !py-2 !px-4 text-sm">
                Get Started →
              </Link>
            </div>
          </div>
        </header>

        {children}

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 mt-16">
          <div className="max-w-5xl mx-auto px-4 py-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">G</div>
                <span className="font-bold text-white">GigLedger</span>
              </div>
              <div className="flex gap-6 text-sm">
                <Link href="/about" className="hover:text-white transition-colors">About</Link>
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                <Link href="/analyze" className="hover:text-white transition-colors">Calculate</Link>
              </div>
            </div>
            <div className="border-t border-slate-800 mt-6 pt-6 text-center text-xs">
              <p>© {new Date().getFullYear()} GigLedger. Not affiliated with Uber, DoorDash, or any gig platform.</p>
              <p className="mt-1 text-slate-600">For informational purposes only. Consult a tax professional for tax advice.</p>
            </div>
          </div>
        </footer>

        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(() => {})
            }
          `
        }} />
      </body>
    </html>
  )
}
