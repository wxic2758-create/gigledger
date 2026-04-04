'use client'

import { useI18n } from '@/context/I18nContext'

export default function Footer() {
  const { locale, t } = useI18n()

  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="24" height="24" rx="6" fill="#10b981" />
                <path
                  d="M7 12h10M12 7v10"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-bold text-gray-900">GigLedger</span>
            </div>
            <p className="text-sm text-gray-500">{t('common.tagline')}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">{t('footer.quickLinks')}</h4>
            <ul className="space-y-2">
              <li>
                <a href={`/${locale}/`} className="text-sm text-gray-500 hover:text-gray-700">
                  {t('nav.home')}
                </a>
              </li>
              <li>
                <a href={`/${locale}/tracker`} className="text-sm text-gray-500 hover:text-gray-700">
                  {t('nav.tracker')}
                </a>
              </li>
              <li>
                <a href={`/${locale}/analyze`} className="text-sm text-gray-500 hover:text-gray-700">
                  {t('nav.analyze')}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-2">
              <li>
                <a href={`/${locale}/privacy`} className="text-sm text-gray-500 hover:text-gray-700">
                  {t('footer.privacy')}
                </a>
              </li>
              <li>
                <a href={`/${locale}/about`} className="text-sm text-gray-500 hover:text-gray-700">
                  {t('nav.about')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-400">
            © 2026 GigLedger. {t('footer.disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  )
}
