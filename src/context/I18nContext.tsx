'use client'

import { createContext, useContext } from 'react'

export type SharedMessages = {
  locale: string
  messages: Record<string, unknown>
  t: (key: string) => string
}

export const I18nContext = createContext<SharedMessages>({
  locale: 'en',
  messages: {},
  t: (key: string) => key,
})

export function useI18n() {
  return useContext(I18nContext)
}
