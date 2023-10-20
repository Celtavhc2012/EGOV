import { resetState } from '../../../lib/reset-state'

export default (initialState) => ({
 
  reset (state) {
    resetState(state, initialState())
  },

  address (state, address) {
    state.address = address
  },

  status (state, { balance }) {
    state.balance = balance
    state.lastStatusUpdate = Date.now()
  },

  
  setBalanceStatus(state, status) {
    state.balanceStatus = status
  },

  
  bottom (state, value) {
    state.bottomReached = value
  },

  transactions (state, transactions) {
    transactions.forEach(tx => {
      if (!tx) return

      Object.keys(tx).forEach(key => tx[key] === undefined && delete tx[key])

      const newTx = Object.assign(
        { },
        state.transactions[tx.hash],
        tx
      )

      state.transactions[tx.hash] = newTx
    })
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
