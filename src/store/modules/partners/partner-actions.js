import * as admApi from '../../../lib/adamant-api'
import { isErc20, Cryptos } from '../../../lib/constants'
import { parseCryptoAddressesKVStxs } from '../../../lib/store-crypto-address'

const CONTACT_LIST_KEY = 'contact_list'
const UPDATE_TIMEOUT = 3 * 60 * 1000 
const SAVE_TIMEOUT = 30 * 1000 
const MAXIMUM_ADDRESSES = 20 
const ADDRESS_VALID_TIMEOUT = 3 * 60 * 60 * 1000

let bgTimer = null

export default {
 
  reset: {
    root: true,
    handler (context) {
      context.dispatch('saveContactsList')
      context.commit('reset')
      clearInterval(bgTimer)
    }
  },


  afterLogin: {
    root: true,
    handler (context) {
      context.dispatch('startSync')
    }
  },

  rehydrate: {
    root: true,
    handler (context) {
      const passphrase = context.rootGetters.getPassPhrase
      if (passphrase) {
        context.dispatch('startSync')
      }
    }
  },

  
  fetchAddress (context, payload) {
    if (!payload.records) payload.records = 1
    const crypto = isErc20(payload.crypto) ? Cryptos.ETH : payload.crypto

    const existingPartner = context.state.list[payload.partner]
    const existingAddress = existingPartner && existingPartner[crypto]
    const addressVerifyTimestamp = existingPartner && existingPartner[crypto + '_verifyTimestamp']

 
    if (existingAddress && addressVerifyTimestamp && Date.now() - addressVerifyTimestamp < ADDRESS_VALID_TIMEOUT) {
      if (payload.records > 1) {
        if (existingPartner[crypto + '_inconsistency']) {
          return Promise.resolve(existingPartner[crypto + '_inconsistency'])
        } else {
          return Promise.resolve([existingAddress])
        }
      } else {
        return Promise.resolve(existingAddress)
      }
    }

    const key = `${crypto}:address`.toLowerCase()
    return admApi.getStored(key, payload.partner, MAXIMUM_ADDRESSES).then(
      txs => {
        if (txs.length > 0) {
          const addresses = parseCryptoAddressesKVStxs(txs, crypto)
          if (addresses && !addresses.onlyLegacyLiskAddress) {
            
            context.commit('address', { ...payload, crypto, address: addresses.mainAddress })
            if (addresses.addressesCount > 1) {
              context.commit('addresses_inconsistency', { ...payload, crypto, addresses: addresses.storedAddresses })
            }
            if (payload.records > 1) {
              return addresses.storedAddresses
            } else {
              return addresses.mainAddress
            }
          } else {
            if (payload.moreInfo) {
              return addresses
            } else {
              return false
            }
          }
        } else {
          return false 
        }
      },
      error => {
        console.error(`Failed to fetch ${crypto} address from KVS. Nothing saved in state.list[payload.partner]`, payload, error)
        return false
      }
    )
  },

  
  fetchContactsList (context) {
    const lastUpdate = context.state.lastUpdate

    
    if ((Date.now() - lastUpdate) < UPDATE_TIMEOUT) return

    return admApi.getStored(CONTACT_LIST_KEY)
      .then(cl => context.commit('contactList', cl))
      .catch(err => console.warn('Failed to fetch contact list', err))
  },


  saveContactsList (context) {
    const lastChange = context.state.lastChange

    
    if (!lastChange || (Date.now() - lastChange) < SAVE_TIMEOUT) return
    
    context.state.lastChange = 0

    const contacts = Object.keys(context.state.list).reduce((map, uid) => {
      const item = context.state.list[uid]
      map[uid] = { ...item }
      return map
    }, { })

    return admApi.storeValue(CONTACT_LIST_KEY, contacts, true)
      .then(response => {
        if (!response.success) {
          console.warn('Contacts list save was rejected')
        }
      })
      .catch(err => {
        console.warn('Failed to save contact list', err)
       
        context.state.lastChange = lastChange
      })
  },

 
  startSync (context) {
    context.dispatch('fetchContactsList')

    clearInterval(bgTimer)
    bgTimer = setInterval(() => {
      context.dispatch('saveContactsList')
      context.dispatch('fetchContactsList')
    }, 1000)
  }
}
