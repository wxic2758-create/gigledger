'use client'

import { useMemo } from 'react'
import { I18nContext } from '@/context/I18nContext'
import { type Locale } from '@/lib/i18n'

// Static imports - no dynamic loading needed
import en from '@/lib/messages/en.json'
import es from '@/lib/messages/es.json'
import zh from '@/lib/messages/zh.json'

const messages: Record<Locale, Record<string, unknown>> = { en, es, zh }

function createTranslator(msg: Record<string, unknown>): (key: string) => string {
  return (key: string): string => {
    const keys = key.split('.')
    let val: unknown = msg
    for (const k of keys) {
      val = (val as Record<string, unknown>)?.[k]
    }
    return typeof val === 'string' ? val : key
  }
}

export default function I18nProvider({
  children,
  locale,
}: {
  children: React.ReactNode
  locale: Locale
}) {
  const msg = messages[locale] ?? messages.en

  const value = useMemo(
    () => ({
      locale,
      messages: msg,
      t: createTranslator(msg),
    }),
    [locale, msg]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
