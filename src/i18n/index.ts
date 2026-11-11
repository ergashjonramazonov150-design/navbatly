/**
 * i18n setup. To add Russian later:
 *   1. create src/i18n/locales/ru/*.json with the SAME keys as uz/
 *   2. add `ru: { common: ruCommon }` to `resources` below
 * Components always use t('key') — never hard-coded text.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import type { AppLanguage } from '@/lib/datetime'
import uzCommon from './locales/uz/common.json'

export const SUPPORTED_LANGUAGES: AppLanguage[] = ['uz']
export const DEFAULT_LANGUAGE: AppLanguage = 'uz'

const STORAGE_KEY = 'navbatly.lang'

function readSavedLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null
    return saved && SUPPORTED_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE
  } catch {
    // localStorage can be blocked (private mode, in-app browsers)
    return DEFAULT_LANGUAGE
  }
}

export const resources = {
  uz: { common: uzCommon },
} as const

void i18n.use(initReactI18next).init({
  resources,
  lng: readSavedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes output
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lng
})

export default i18n
