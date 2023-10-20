import { resetState } from '../../../lib/reset-state'
import getInitialState from './adm-state'
import { isStringEqualCI } from '@/lib/textHelpers'

export default {
  
  reset (state) {
    resetState(state, getInitialState())
  },

  
  address (state, address) {
    state.address = address
  },

  
  bottom (state, value) {
    state.bottomReached = value
  },

  
  transactions (state, transactions) {
    const updateTimestamps = transactions.updateTimestamps
    if (updateTimestamps) {
      transactions = transactions.transactions
    }
    let minHeight = Infinity
    let maxHeight = -1

    const address = state.address
    transactions.forEach(tx => {
      if (!tx) return

      state.transactions[tx.id] = {
        ...tx,
        direction: isStringEqualCI(tx.recipientId, address) ? 'to' : 'from',
        partner: isStringEqualCI(tx.recipientId, address) ? tx.senderId : tx.recipientId,
        status: tx.height || tx.confirmations > 0
          ? 'CONFIRMED'
          : tx.status
            ? tx.status
            : 'REGISTERED'
      }

      if (tx.height && updateTimestamps) {
        minHeight = Math.min(minHeight, tx.height)
        maxHeight = Math.max(maxHeight, tx.height)
      }
    })

    
    const txCount = Object.keys(state.transactions).length
    if (state.transactionsCount < txCount) { 
      state.transactionsCount = txCount
    }

    if (minHeight < state.minHeight) {
      state.minHeight = minHeight
    }
    if (maxHeight > state.maxHeight) {
      state.maxHeight = maxHeight
    }
  },

  
  areOlderLoading (state, areLoading) {
    state.areOlderLoading = areLoading
  },
  areRecentLoading (state, areLoading) {
    state.areRecentLoading = areLoading
  },
  areTransactionsLoading (state, areLoading) {
    state.areTransactionsLoading = areLoading
  }
}
