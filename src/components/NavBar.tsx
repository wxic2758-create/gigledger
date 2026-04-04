'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { locales } from '@/lib/i18n'
import { useI18n } from '@/context/I18nContext'

export default function NavBar() {
  const { locale, t } = useI18n()
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <svg
              width="24"
              height="24"
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
            <span className="font-bold text-gray-900 text-lg">GigLedger</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href={`/${locale}`}
              className={`text-sm font-medium ${
                pathname === `/${locale}` ? 'text-emerald-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('nav.home')}
            </Link>
            <Link
              href={`/${locale}/tracker`}
              className={`text-sm font-medium ${
                pathname.startsWith(`/${locale}/tracker`)
                  ? 'text-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('nav.tracker')}
            </Link>
            <Link
              href={`/${locale}/analyze`}
              className={`text-sm font-medium ${
                pathname.startsWith(`/${locale}/analyze`)
                  ? 'text-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('nav.analyze')}
            </Link>
            <Link
              href={`/${locale}/about`}
              className={`text-sm font-medium ${
                pathname === `/${locale}/about`
                  ? 'text-emerald-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t('nav.about')}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => {
                const newLocale = e.target.value
                const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
                window.location.href = newPath
              }}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {locales.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </nav>
  )
}
