'use client'

import { useI18n } from '@/context/I18nContext'
import Footer from '@/components/Footer'

const PLATFORMS = [
  { id: 'uber', name: 'Uber', color: 'bg-black' },
  { id: 'doordash', name: 'DoorDash', color: 'bg-red-600' },
  { id: 'instacart', name: 'Instacart', color: 'bg-green-600' },
]

export default function HomePage() {
  const { t, locale } = useI18n()

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('hero.title')}</h1>
          <p className="text-xl md:text-2xl opacity-90 mb-8">{t('hero.subtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`/${locale}/tracker`}
              className="px-8 py-4 bg-white text-emerald-700 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
            >
              {t('hero.cta.start')}
            </a>
            <a
              href={`/${locale}/analyze`}
              className="px-8 py-4 border-2 border-white text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              {t('hero.cta.analyze')}
            </a>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">{t('howItWorks.title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {([1, 2, 3] as const).map((step) => (
              <div key={step} className="text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-emerald-600">{step}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t(`howItWorks.step${step}.title`)}
                </h3>
                <p className="text-gray-500 text-sm">{t(`howItWorks.step${step}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            {t('platforms.title')}
          </h2>
          <p className="text-gray-500 text-center mb-12">{t('platforms.subtitle')}</p>
          <div className="grid md:grid-cols-3 gap-6">
            {PLATFORMS.map((p) => (
              <div
                key={p.id}
                className="border border-gray-200 rounded-2xl p-6 hover:shadow-md transition-shadow"
              >
                <div className={`w-12 h-12 ${p.color} rounded-xl flex items-center justify-center mb-4`}>
                  <span className="text-white font-bold text-lg">{p.name[0]}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{p.name}</h3>
                <p className="text-gray-500 text-sm">{t(`platforms.${p.id}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t('cta.title')}</h2>
          <p className="text-gray-500 mb-8">{t('cta.subtitle')}</p>
          <a
            href={`/${locale}/tracker`}
            className="inline-block px-8 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg"
          >
            {t('cta.button')}
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
