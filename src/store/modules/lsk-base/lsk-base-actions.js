import BigNumber from '@/lib/bignumber'
import LskBaseApi from '../../../lib/lisk/lsk-base-api'
import { storeCryptoAddress } from '../../../lib/store-crypto-address'
import * as tf from '../../../lib/transactionsFetching'

const DEFAULT_CUSTOM_ACTIONS = () => ({})

function createActions(options) {
  const Api = options.apiCtor || LskBaseApi
  const { customActions = DEFAULT_CUSTOM_ACTIONS, fetchRetryTimeout } = options

  
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

    storeAddress({ state }) {
      storeCryptoAddress(state.crypto, state.address)
    },

    updateStatus(context) {
      if (!api) return
      api.getBalance().then((balance) => context.commit('status', { balance }))
    },

    sendTokens(
      context,
      { amount, admAddress, address, comments, fee, increaseFee, textData, replyToId }
    ) {
      if (!api) return
      address = address.trim()

      const crypto = context.state.crypto

      return api
        .createTransaction(address, amount, fee, context.state.nonce, textData)
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
                timestamp: Date.now(),
                data: textData
              }
            ])

            context.dispatch('getTransaction', { hash, force: true })

            return hash
          }
        })
    },

    
    calculateFee(context, payload) {
      if (!api) return
      return api.getFee(payload.address, payload.amount, payload.nonce, payload.data)
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

        
        retryTimeout = fetchRetryTimeout
        retry = true
      } else if (existing && existing.status === 'REGISTERED') {
        
        retryTimeout = fetchRetryTimeout
        retry = true
      } else {
        
        retry =
          attempt <
          tf.getPendingTxRetryCount(
            payload.timestamp || (existing && existing.timestamp),
            context.state.crypto
          )
        retryTimeout = tf.getPendingTxRetryTimeout(
          payload.timestamp || (existing && existing.timestamp),
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

    
    async getNewTransactions(context) {
      if (!api) return
      const options = {}
      
      if (Object.keys(context.state.transactions).length < context.state.transactionsCount) {
        context.state.transactionsCount = 0
        context.state.maxTimestamp = -1
        context.state.minTimestamp = Infinity
        context.commit('bottom', false)
      }
      if (context.state.maxTimestamp > 0) {
        options.fromTimestamp = context.state.maxTimestamp
        options.sort = 'timestamp:asc'
      } else {
        
        options.sort = 'timestamp:desc'
      }

      context.commit('areRecentLoading', true)
      return api.getTransactions(options).then(
        (transactions) => {
          context.commit('areRecentLoading', false)
          if (transactions && transactions.length > 0) {
            context.commit('transactions', { transactions, updateTimestamps: true })
            
            if (options.fromTimestamp && transactions.length === api.TX_CHUNK_SIZE) {
              this.dispatch(`${context.state.crypto.toLowerCase()}/getNewTransactions`)
            }
          }
        },
        (error) => {
          context.commit('areRecentLoading', false)
          return Promise.reject(error)
        }
      )
    },

    
    async getOldTransactions(context) {
      if (!api) return
      
      if (context.state.bottomReached) return Promise.resolve()

      const options = {}
      if (context.state.minTimestamp < Infinity) {
        options.toTimestamp = context.state.minTimestamp
      }
      options.sort = 'timestamp:desc'

      context.commit('areOlderLoading', true)

      return api.getTransactions(options).then(
        (transactions) => {
          context.commit('areOlderLoading', false)

          if (transactions && transactions.length > 0) {
            context.commit('transactions', { transactions, updateTimestamps: true })
          }

          
          if (transactions && transactions.length === 0) {
            context.commit('bottom', true)
          }
        },
        (error) => {
          context.commit('areOlderLoading', false)
          return Promise.reject(error)
        }
      )
    },

    ...customActions(() => api)
  }
}

export default createActions
