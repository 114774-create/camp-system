import { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react'
import { Locale } from '../types'
import { I18nKey, t as translate } from './i18n'

const KEY = 'camp_locale'

type Ctx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: I18nKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const v = localStorage.getItem(KEY)
      return v === 'en' ? 'en' : 'zh-TW'
    } catch {
      return 'zh-TW'
    }
  })

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
    document.documentElement.lang = l === 'en' ? 'en' : 'zh-TW'
  }

  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-TW'
  }, [locale])

  const value = useMemo<Ctx>(() => ({
    locale,
    setLocale,
    t: (key, vars) => translate(key, locale, vars),
  }), [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
