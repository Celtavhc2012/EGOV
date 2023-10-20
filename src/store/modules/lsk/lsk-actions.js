import { FetchStatus } from '@/lib/constants'
import baseActions from '../lsk-base/lsk-base-actions'
import LskApi from '../../../lib/lisk/lisk-api'

const TX_FETCH_INTERVAL = 10 * 1000

const customActions = getApi => ({
  updateBalance: {
    root: true,
    async handler({ commit }, payload = {}) {
      if (payload.requestedByUser) {
        commit('setBalanceStatus', FetchStatus.Loading)
      }

      try {
        const api = getApi()
        const account = await api.getAccount()

        if (account) {
          commit('status', { balance: account.balance, nonce: account.nonce })
          commit('setBalanceStatus', FetchStatus.Success)
        } else {
          commit('setBalanceStatus', FetchStatus.Error)
        }
      } catch (err) {
        commit('setBalanceStatus', FetchStatus.Error)
        console.log(err)
      }
    }
  },

  updateStatus (context) {
    const api = getApi()

    if (!api) return
    api.getAccount().then(account => {
      if (account) {
        context.commit('status', { balance: account.balance, nonce: account.nonce })
        context.commit('setBalanceStatus', FetchStatus.Success)
      } else {
        context.commit('setBalanceStatus', FetchStatus.Error)
      }
    }).catch(err => {
      context.commit('setBalanceStatus', FetchStatus.Error)

      throw err
    })

    
    context.dispatch('updateHeight')
  },

  updateHeight ({ commit }) {
    const api = getApi()
    if (!api) return
    api.getHeight().then(height => {
      if (height) {
        commit('height', height)
      }
    })
  },

 
  updateTransaction ({ dispatch, getters }, payload) {
    const tx = getters.transaction(payload.hash)

    if (tx && (tx.status === 'CONFIRMED' || tx.status === 'REJECTED')) {
      
      return dispatch('updateHeight')
    } else {
      
      return dispatch('getTransaction', { ...payload, force: payload.force, updateOnly: payload.updateOnly })
    }
  }
})

export default {
  ...baseActions({
    apiCtor: LskApi,
    customActions,
    fetchRetryTimeout: TX_FETCH_INTERVAL
  })
}
