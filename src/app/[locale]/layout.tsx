import type { Metadata } from 'next'
import { locales, isValidLocale, type Locale } from '@/lib/i18n'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import I18nProvider from '@/components/I18nProvider'
import { Analytics } from '@vercel/analytics/react'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = isValidLocale(localeParam) ? localeParam : 'en'
  return {
    title: {
      default: 'GigLedger',
      template: '%s | GigLedger',
    },
    description: 'Know Your Real Earnings as a Gig Worker',
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: localeParam } = await params
  const locale = isValidLocale(localeParam) ? localeParam : 'en'

  return (
    <I18nProvider locale={locale}>
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </div>
    </I18nProvider>
  )
}
