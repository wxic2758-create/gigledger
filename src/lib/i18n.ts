export const locales = ['en', 'es', 'zh'] as const
export const defaultLocale = 'en' as const

export type Locale = (typeof locales)[number]

export function getLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/')
  const first = segments[1]
  if (locales.includes(first as Locale)) return first as Locale
  return defaultLocale
}

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale)
}
