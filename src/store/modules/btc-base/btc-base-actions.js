import BigNumber from '@/lib/bignumber'
import BtcBaseApi from '../../../lib/bitcoin/btc-base-api'
import { FetchStatus } from '@/lib/constants'
import { storeCryptoAddress } from '../../../lib/store-crypto-address'
import * as tf from '../../../lib/transactionsFetching'

const DEFAULT_CUSTOM_ACTIONS = () => ({})




function createActions(options) {
  const Api = options.apiCtor || BtcBaseApi
  const {
    getNewTransactions,
    getOldTransactions,
    customActions = DEFAULT_CUSTOM_ACTIONS,
    fetchRetryTimeout
  } = options

  
  let api = null

  return {
    afterLogin: {
      root: true,
      handler(context, passphrase) {
        api = new Api(passphrase)
        context.commit('address', api.address)
        context.dispatch('updateStatus')
        context.dispatch('storeAddress')
      }
    },

  
    reset: {
      root: true,
      handler(context) {
        api = null
        context.commit('reset')
      }
    },

    
    rehydrate: {
      root: true,
      handler(context) {
        const passphrase = context.rootGetters.getPassPhrase
        if (passphrase) {
          api = new Api(passphrase)
          context.commit('address', api.address)
          context.dispatch('updateStatus')
          context.dispatch('storeAddress')
        }
      }
    },

   
    updateBalance: {
      root: true,
      async handler({ commit }, payload = {}) {
        if (payload.requestedByUser) {
          commit('setBalanceStatus', FetchStatus.Loading)
        }

        try {
          const balance = await api.getBalance()

          commit('status', { balance })
          commit('setBalanceStatus', FetchStatus.Success)
        } catch (err) {
          commit('setBalanceStatus', FetchStatus.Error)

          throw err
        }
      },
    },

    storeAddress({ state }) {
      storeCryptoAddress(state.crypto, state.address)
    },

    updateStatus(context) {
      if (!api) return
      api.getBalance().then((balance) => {
        context.commit('status', { balance })
        context.commit('setBalanceStatus', FetchStatus.Success)
      }).catch(err => {
        context.commit('setBalanceStatus', FetchStatus.Error)
        throw err
      })
    },

    sendTokens(context, { amount, admAddress, address, comments, fee, replyToId }) {
      if (!api) return
      address = address.trim()

      const crypto = context.state.crypto

      return api
        .createTransaction(address, amount, fee)
        .then((tx) => {
          if (!admAddress) return tx.hex

          const msgPayload = {
            address: admAddress,
            amount: BigNumber(amount).toFixed(),
            comments,
            crypto,
            hash: tx.txid,
            replyToId
          }

         
          return context
            .dispatch('sendCryptoTransferMessage', msgPayload, { root: true })
            .then((success) => (success ? tx.hex : Promise.reject(new Error('adm_message'))))
        })
        .then((rawTx) =>
          api.sendTransaction(rawTx).then(
            (hash) => ({ hash }),
            (error) => ({ error })
          )
        )
        .then(({ hash, error }) => {
          if (error) {
            context.commit('transactions', [{ hash, status: 'REJECTED' }])
            throw error
          } else {
            console.log(`${crypto} transaction has been sent: ${hash}`)

            context.commit('transactions', [
              {
                hash,
                senderId: context.state.address,
                recipientId: address,
                amount,
                fee,
                status: 'PENDING',
                timestamp: Date.now()
              }
            ])

            context.dispatch('getTransaction', { hash, force: true })

            return hash
          }
        })
    },

   
    async getTransaction(context, payload) {
      if (!api) return
      if (!payload.hash) return

      let existing = context.state.transactions[payload.hash]
      if (existing && !payload.force) return

      if (!existing || payload.dropStatus) {
        payload.updateOnly = false
        context.commit('transactions', [
          {
            hash: payload.hash,
            timestamp: (existing && existing.timestamp) || payload.timestamp || Date.now(),
            amount: payload.amount,
            status: 'PENDING'
          }
        ])
        existing = context.state.transactions[payload.hash]
      }

      let tx = null
      try {
        tx = await api.getTransaction(payload.hash)
      } catch (e) {}

      let retry = false
      let retryTimeout = 0
      const attempt = payload.attempt || 0

      if (tx) {
        context.commit('transactions', [tx])
        
        if (tx.status === 'CONFIRMED') return
        
        retryTimeout = tf.getRegisteredTxRetryTimeout(
          tx.timestamp || existing.timestamp || payload.timestamp,
          context.state.crypto,
          fetchRetryTimeout,
          tx.instantsend
        )
        retry = true
      } else if (existing && existing.status === 'REGISTERED') {
        
        retryTimeout = tf.getRegisteredTxRetryTimeout(
          existing.timestamp || payload.timestamp,
          context.state.crypto,
          fetchRetryTimeout,
          existing.instantsend
        )
        retry = true
      } else {
        
        retry =
          attempt <
          tf.getPendingTxRetryCount(existing.timestamp || payload.timestamp, context.state.crypto)
        retryTimeout = tf.getPendingTxRetryTimeout(
          existing.timestamp || payload.timestamp,
          context.state.crypto
        )
      }

      if (!retry) {
        
        context.commit('transactions', [{ hash: payload.hash, status: 'REJECTED' }])
      } else if (!payload.updateOnly) {
        
        const newPayload = {
          ...payload,
          attempt: attempt + 1,
          force: true,
          updateOnly: false,
          dropStatus: false
        }
        setTimeout(() => context.dispatch('getTransaction', newPayload), retryTimeout)
      }
    },

    
    updateTransaction({ dispatch }, payload) {
      return dispatch('getTransaction', {
        ...payload,
        force: payload.force,
        updateOnly: payload.updateOnly
      })
    },

    getNewTransactions(context) {
      if (api && typeof getNewTransactions === 'function') {
        return getNewTransactions(api, context)
      }
      return Promise.resolve()
    },

    getOldTransactions(context) {
      if (api && typeof getOldTransactions === 'function') {
        return getOldTransactions(api, context)
      }
      return Promise.resolve()
    },

    ...customActions(() => api)
  }
}

export default createActions
