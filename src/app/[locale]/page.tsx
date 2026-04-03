'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations()

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Used by gig workers across the US
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
            Know Your <br /><span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Real Earnings</span>
          </h1>

          <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/analyze" className="btn-cta">
              {t('hero.cta')}
            </Link>
            <Link href="/tracker" className="btn-secondary !text-white !bg-slate-800 hover:!bg-slate-700 !rounded-xl !px-8 !py-4">
              {t('hero.trackerCta')}
            </Link>
          </div>

          <div className="flex justify-center gap-8 mt-12 text-sm text-slate-500">
            <span>✓ {t('common.noSignup')}</span>
            <span>✓ {t('common.free')}</span>
            <span>✓ Results in 5 seconds</span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full h-12">
            <path d="M0 60L48 55C96 50 192 40 288 35C384 30 480 30 576 32C672 34 768 38 864 42C960 46 1056 50 1152 50C1248 50 1344 46 1392 44L1440 42V60H0Z" fill="#F8FAFC"/>
          </svg>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 max-w-4xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-10">{t('howItWorks.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="text-center">
              <div className="relative inline-block mb-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-600/30">
                  {step === 1 ? '📸' : step === 2 ? '🧮' : '💰'}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 text-slate-900 rounded-full flex items-center justify-center text-xs font-bold">
                  {step}
                </div>
              </div>
              <h3 className="font-bold text-slate-800 mb-2">{t(`howItWorks.step${step}.title`)}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{t(`howItWorks.step${step}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-10">{t('features.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { key: 'screenshotOcr', icon: '📸' },
              { key: 'trueIncome', icon: '🧮' },
              { key: 'shareCards', icon: '📤' },
              { key: 'weeklyTracker', icon: '📊' },
              { key: 'taxEstimate', icon: '💸' },
              { key: 'pwa', icon: '📱' },
              { key: 'privacyFirst', icon: '🔒' },
              { key: 'fiveSeconds', icon: '⚡' },
            ].map(({ key, icon }) => (
              <div key={key} className="p-4 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="text-2xl mb-2">{icon}</div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">{t(`features.${key}.title`)}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{t(`features.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Income comparison */}
      <section className="py-16 max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Do you know your real hourly rate?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Most gig workers think they know how much they make — until they factor in gas, vehicle wear, and taxes.
            GigLedger shows you the truth.
          </p>
          <div className="grid grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Gross Earnings', example: '$450/week' },
              { label: 'Real Costs', example: '-$127/week' },
              { label: 'Net Income', example: '$323/week' },
            ].map(({ label, example }) => (
              <div key={label}>
                <p className="text-slate-400 text-sm mb-1">{label}</p>
                <p className="font-mono font-bold text-xl">{example}</p>
              </div>
            ))}
          </div>
          <Link href="/analyze" className="btn-cta">
            Calculate My Real Earnings →
          </Link>
        </div>
      </section>

      {/* Platform support */}
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Supports all major platforms</h2>
          <div className="flex justify-center gap-4 flex-wrap">
            {[
              { name: 'Uber', icon: '🚗', color: 'bg-black' },
              { name: 'DoorDash', icon: '📦', color: 'bg-red-500' },
              { name: 'Instacart', icon: '🛒', color: 'bg-green-600' },
              { name: 'Lyft', icon: '🚙', color: 'bg-pink-500' },
              { name: 'Amazon Flex', icon: '📦', color: 'bg-orange-500' },
            ].map(({ name, icon, color }) => (
              <div key={name} className={`${color} text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium`}>
                <span>{icon}</span> {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">
          Stop guessing. Know your truth.
        </h2>
        <p className="text-slate-500 mb-8">
          Join thousands of gig workers who finally know how much they really make.
        </p>
        <Link href="/analyze" className="btn-cta text-lg !px-10 !py-4">
          🚀 Start for Free
        </Link>
      </section>
    </main>
  )
}
