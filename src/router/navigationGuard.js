import { Cryptos } from '@/lib/constants'
import { parseURIasAIP } from '@/lib/uri'
import validateAddress from '@/lib/validateAddress'
import { i18n } from '@/i18n'
import { router } from '@/router'
import store from '@/store'


export function navigateByURI (next) {
  const contact = parseURIasAIP()

  if (contact.address) {
    _navigateByContact(
      contact.params.message,
      contact.address,
      contact.params.label
    )
  } else {
    if (next) {
      next({ name: 'Chats' })
    } else {
      router.push({ name: 'Chats' })
    }
  }
}

export default {
  chats: (to, from, next) => {
    const chat = store.state.chat.chats[to.params.partnerId]

    
    if (
      validateAddress('ADM', to.params.partnerId) ||
      (chat && chat.readOnly)
    ) {
      return next()
    }

    next('/chats')
  },
  transactions: (to, from, next) => {
    if (to.meta.previousRoute) {
      to.meta.previousRoute = from
      if (to.meta.previousPreviousRoute && from.meta.previousRoute) {
        to.meta.previousPreviousRoute = from.meta.previousRoute
      }
    }
    const crypto = (to.params.crypto || '').toUpperCase()
    if (crypto in Cryptos) {
      next()
    } else next('/home')
  }
}


function _navigateByContact (messageText, partnerId, partnerName) {
  if (validateAddress(Cryptos.ADM, partnerId)) {
    store.dispatch('chat/createChat', { partnerId, partnerName })
      .then(key => router.push({
        name: 'Chat',
        params: { messageText, partnerId }
      }))
      .catch(x => {
        router.push({
          name: 'Chats',
          params: { partnerId, showNewContact: true }
        })
        store.dispatch('snackbar/show', {
          message: x.message
        })
      })
  } else {
    router.push({
      name: 'Chats',
      params: { partnerId, showNewContact: false }
    })
    store.dispatch('snackbar/show', {
      message: i18n.$t('chats.incorrect_address', { crypto: Cryptos.ADM })
    })
  }
}
