// Makes t('...') keys type-checked: a typo in a translation key becomes a TypeScript error.
import 'i18next'
import type { resources } from './index'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: (typeof resources)['uz']
  }
}
