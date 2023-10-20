import Web3Eth from 'web3-eth'

import getEndpointUrl from '../../../lib/getEndpointUrl'
import * as utils from '../../../lib/eth-utils'
import { getTransactions } from '../../../lib/eth-index'
import * as tf from '../../../lib/transactionsFetching'
import { isStringEqualCI } from '@/lib/textHelpers'


const RETRY_TIMEOUT = 20 * 1000
const CHUNK_SIZE = 25

export default function createActions(config) {
  const endpoint = getEndpointUrl('ETH')
  const api = new Web3Eth(endpoint)
  const queue = new utils.BatchQueue(() => new api.BatchRequest())

  const { onInit = () => {}, initTransaction, parseTransaction, createSpecificActions } = config

  return {
    ...createSpecificActions(api, queue),

    
    afterLogin: {
      root: true,
      handler(context, passphrase) {
        const account = utils.getAccountFromPassphrase(passphrase, api)
        context.commit('account', account)
        context.dispatch('updateStatus')
        queue.start()

        onInit(context)
      }
    },

   
    reset: {
      root: true,
      handler(context) {
        queue.stop()
        context.commit('reset')
      }
    },

   
    rehydrate: {
      root: true,
      handler(context) {
        const passphrase = context.rootGetters.getPassPhrase
        const address = context.state.address

        if (!address && passphrase) {
          const account = utils.getAccountFromPassphrase(passphrase, api)
          context.commit('account', account)
          onInit(context)
        }

        context.dispatch('updateStatus')

        queue.start()
      }
    },

    sendTokens(context, { amount, admAddress, address, comments, increaseFee, replyToId }) {
      address = address.trim()
      const crypto = context.state.crypto

      return initTransaction(api, context, address, amount, increaseFee)
        .then((ethTx) => {
          return api.accounts.signTransaction(ethTx, context.state.privateKey).then((signedTx) => {
            const txInfo = {
              signedTx,
              ethTx
            }

            if (!admAddress) {
              return txInfo
            }
            const msgPayload = {
              address: admAddress,
              amount,
              comments,
              crypto,
              hash: signedTx.transactionHash,
              replyToId
            }
            
            return context
              .dispatch('sendCryptoTransferMessage', msgPayload, { root: true })
              .then((success) => (success ? txInfo : Promise.reject(new Error('adm_message'))))
          })
        })
        .then((txInfo) => {
          return api.sendSignedTransaction(txInfo.signedTx.rawTransaction).then(
            (hash) => ({ txInfo, hash }),
            (error) => {
              
              if (!error.toString().includes('Failed to check for transaction receipt')) {
                return { txInfo, error }
              } else {
                return { txInfo, hash: txInfo.signedTx.transactionHash }
              }
            }
          )
        })
        .then((sentTxInfo) => {
          
          if (typeof sentTxInfo.hash === 'object') {
            
            sentTxInfo.txInfo.ethTx.gasPrice = sentTxInfo.hash.effectiveGasPrice
            sentTxInfo.hash = sentTxInfo.hash.transactionHash
          }

          if (sentTxInfo.error) {
            console.error(`Failed to send ${crypto} transaction`, sentTxInfo.error)
            context.commit('transactions', [
              { hash: sentTxInfo.txInfo.signedTx.transactionHash, status: 'REJECTED' }
            ])
            throw sentTxInfo.error
          } else {
            if (!isStringEqualCI(sentTxInfo.hash, sentTxInfo.txInfo.signedTx.transactionHash)) {
              console.warn(
                `Something wrong with sent ETH tx, computed hash and sent tx differs: ${sentTxInfo.txInfo.signedTx.transactionHash} and ${sentTxInfo.hash}`
              )
            }

            context.commit('transactions', [
              {
                hash: sentTxInfo.hash,
                senderId: sentTxInfo.txInfo.ethTx.from,
                recipientId: address,
                amount,
                fee: utils.calculateFee(
                  sentTxInfo.txInfo.ethTx.gas,
                  sentTxInfo.txInfo.ethTx.gasPrice
                ),
                status: 'PENDING',
                timestamp: Date.now(),
                gasPrice: sentTxInfo.txInfo.ethTx.gasPrice
              }
            ])
            context.dispatch('getTransaction', {
              hash: sentTxInfo.hash,
              isNew: true,
              direction: 'from',
              force: true
            })

            return sentTxInfo.hash
          }
        })
    },

    
    getBlock(context, payload) {
      const transaction = context.state.transactions[payload.hash]
      if (!transaction) return

      const supplier = () =>
        api.getBlock.request(payload.blockNumber, (err, block) => {
          if (!err && block) {
            context.commit('transactions', [
              {
                hash: transaction.hash,
                timestamp: block.timestamp * 1000
              }
            ])
          }
        })

      queue.enqueue('block:' + payload.blockNumber, supplier)
    },

    
    getTransaction(context, payload) {
      const existing = context.state.transactions[payload.hash]
      if (existing && !payload.force) return

      if (!existing || payload.dropStatus) {
        payload.updateOnly = false
        context.commit('transactions', [
          {
            hash: payload.hash,
            timestamp: (existing && existing.timestamp) || payload.timestamp || Date.now(),
            amount: payload.amount,
            status: 'PENDING',
            direction: payload.direction
          }
        ])
      }

      const key = 'transaction:' + payload.hash
      const supplier = () =>
        api.getTransaction.request(payload.hash, (err, tx) => {
          if (!err && tx && tx.input) {
            const transaction = parseTransaction(context, tx)
            const status = existing ? existing.status : 'REGISTERED'
            if (transaction) {
              context.commit('transactions', [
                {
                  ...transaction,
                  status
                }
              ])
              
              const { attempt, ...receiptPayload } = payload
              context.dispatch('getTransactionReceipt', receiptPayload)
              
              return
            }
          }

          const attempt = payload.attempt || 0
          const retryCount = tf.getPendingTxRetryCount(
            payload.timestamp || (existing && existing.timestamp),
            context.state.crypto
          )
          const retry = attempt < retryCount
          const retryTimeout = tf.getPendingTxRetryTimeout(
            payload.timestamp || (existing && existing.timestamp),
            context.state.crypto
          )

          if (!retry) {
           
            context.commit('transactions', [{ hash: payload.hash, status: 'REJECTED' }])
          } else if (!payload.updateOnly) {
            
            const newPayload = tx
              ? payload
              : {
                  ...payload,
                  attempt: attempt + 1,
                  force: true,
                  updateOnly: false,
                  dropStatus: false
                }

            setTimeout(() => context.dispatch('getTransaction', newPayload), retryTimeout)
          }
        })

      queue.enqueue(key, supplier)
    },

    
    getTransactionReceipt(context, payload) {
      const transaction = context.state.transactions[payload.hash]
      if (!transaction) return

      const gasPrice = transaction.gasPrice

      const supplier = () =>
        api.getTransactionReceipt.request(payload.hash, (err, tx) => {
          let replay = true

          if (!err && tx) {
            const update = {
              hash: payload.hash,
              fee: utils.calculateFee(tx.gasUsed, gasPrice)
            }

            if (Number(tx.status) === 0) {
              
              update.status = 'REJECTED'
            } else if (tx.blockNumber) {
              
              update.status = 'CONFIRMED'
              update.blockNumber = tx.blockNumber
            }

            context.commit('transactions', [update])

            if (tx.blockNumber) {
              context.dispatch('getBlock', {
                ...payload,
                blockNumber: tx.blockNumber
              })
            }

            
            replay = !update.status
          }

          if (replay) {
            
            const newPayload = { ...payload, attempt: 1 + (payload.attempt || 0) }
            setTimeout(() => context.dispatch('getTransactionReceipt', newPayload), RETRY_TIMEOUT)
          }
        })

      queue.enqueue('transactionReceipt:' + payload.hash, supplier)
    },

    
    updateTransaction({ dispatch }, payload) {
      return dispatch('getTransaction', {
        ...payload,
        force: payload.force,
        updateOnly: payload.updateOnly
      })
    },

    getNewTransactions(context, payload) {
      
      if (Object.keys(context.state.transactions).length < context.state.transactionsCount) {
        context.state.transactionsCount = 0
        context.state.maxHeight = -1
        context.state.minHeight = Infinity
        context.commit('bottom', false)
      }
      const { address, maxHeight, contractAddress, decimals } = context.state
      const from = maxHeight > 0 ? maxHeight + 1 : 0
      const limit = from ? undefined : CHUNK_SIZE

      const options = {
        address,
        contract: contractAddress,
        from,
        limit,
        decimals
      }

      context.commit('areRecentLoading', true)

      return getTransactions(options).then(
        (result) => {
          context.commit('areRecentLoading', false)
          context.commit('transactions', { transactions: result.items, updateTimestamps: true })
        },
        (error) => {
          context.commit('areRecentLoading', false)
          return Promise.reject(error)
        }
      )
    },

    getOldTransactions(context) {
      
      if (context.state.bottomReached) return Promise.resolve()

      const { address, contractAddress: contract, minHeight, decimals } = context.state

      const options = {
        limit: CHUNK_SIZE,
        address,
        contract,
        decimals
      }
      if (minHeight > 1) {
        options.to = minHeight - 1
      }

      context.commit('areOlderLoading', true)

      return getTransactions(options).then(
        (result) => {
          context.commit('areOlderLoading', false)
          context.commit('transactions', { transactions: result.items, updateTimestamps: true })

          if (!result.items.length) {
            context.commit('bottom', true)
          }
        },
        (error) => {
          context.commit('areOlderLoading', false)
          return Promise.reject(error)
        }
      )
    }
  }
}
