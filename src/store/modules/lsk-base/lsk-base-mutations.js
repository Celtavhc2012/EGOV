import { resetState } from '../../../lib/reset-state'

export default (initialState) => ({
  
  reset (state) {
    resetState(state, initialState())
  },

  address (state, address) {
    state.address = address
  },

  status (state, { balance, nonce }) {
    if (balance) {
      state.balance = balance
      state.lastStatusUpdate = Date.now()
    }
    if (nonce) {
      state.nonce = nonce
      state.lastStatusUpdate = Date.now()
    }
  },

 
  setBalanceStatus(state, status) {
    state.balanceStatus = status
  },

  
  bottom (state, value) {
    state.bottomReached = value
  },

  
  transactions (state, transactions) {
    const updateTimestamps = transactions.updateTimestamps
    if (updateTimestamps) {
      transactions = transactions.transactions
    }

    let minTimestamp = Infinity
    let maxTimestamp = -1

    transactions.forEach(tx => {
      if (!tx) return

      Object.keys(tx).forEach(key => tx[key] === undefined && delete tx[key])

      const newTx = Object.assign(
        { },
        state.transactions[tx.hash],
        tx
      )

      state.transactions[tx.hash] = newTx

      if (tx.timestamp && updateTimestamps) {
        minTimestamp = Math.min(minTimestamp, tx.timestamp)
        maxTimestamp = Math.max(maxTimestamp, tx.timestamp)
      }
    })

    
    const txCount = Object.keys(state.transactions).length
    if (state.transactionsCount < txCount) { 
      state.transactionsCount = txCount
    }

    if (minTimestamp < state.minTimestamp) {
      state.minTimestamp = minTimestamp
    }
    if (maxTimestamp > state.maxTimestamp) {
      state.maxTimestamp = maxTimestamp
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
})
