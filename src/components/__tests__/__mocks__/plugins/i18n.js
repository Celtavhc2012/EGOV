import { createI18n } from 'vue-i18n'

import en from '@/locales/en'
import ru from '@/locales/ru'


export default function mockupI18n () {
  return createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    
    silentTranslationWarn: true, 
    messages: {
      en,
      ru
    }
  })
}
