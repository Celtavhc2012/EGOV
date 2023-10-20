import { createI18n } from 'vue-i18n'

import de from './locales/de'
import en from './locales/en'
import ru from './locales/ru'

function loadLocaleMessages () {
  return {
    de, en, ru
  }
}

export const i18n = createI18n({
  locale: import.meta.env.VUE_APP_I18N_LOCALE || 'en',
  fallbackLocale: import.meta.env.VUE_APP_I18N_FALLBACK_LOCALE || 'en',
  messages: loadLocaleMessages(),
  fallbackRoot: true,
  pluralizationRules: {
   
    ru: function (choice, choicesLength) {
      
      if (choice === 0) {
        return 0
      }
      const teen = choice > 10 && choice < 20
      const endsWithOne = choice % 10 === 1
      if (choicesLength < 4) {
        return (!teen && endsWithOne) ? 1 : 2
      }
      if (!teen && endsWithOne) {
        return 1
      }
      if (!teen && choice % 10 >= 2 && choice % 10 <= 4) {
        return 2
      }
      return (choicesLength < 4) ? 2 : 3
    }
  },
  silentTranslationWarn: true,
  globalInjection: true,
  allowComposition: true
})
