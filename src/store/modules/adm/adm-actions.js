import * as admApi from '@/lib/adamant-api'

export default {

  
  afterLogin: {
    root: true,
    handler (context) {
      const address = context.rootState.address
      context.commit('address', address)
    }
  },

  
  reset: {
    root: true,
    handler (context) {
      context.commit('reset')
    }
  },

  
  rehydrate: {
    root: true,
    handler (context) {
      const address = context.rootState.address
      context.commit('address', address)
    }
  },

  
  getNewTransactions (context) {
    const options = { }
    options.minAmount = 1
    
    if (Object.keys(context.state.transactions).length < context.state.transactionsCount) {
      context.state.transactionsCount = 0
      context.state.maxHeight = -1
      context.state.minHeight = Infinity
      context.commit('bottom', false)
    }
    if (context.state.maxHeight > 0) {
      options.fromHeight = context.state.maxHeight + 1
      options.orderBy = 'timestamp:asc'
    } else {
      
      options.orderBy = 'timestamp:desc'
    }

    context.commit('areRecentLoading', true)
    return admApi.getTransactions(options).then(
      response => {
        context.commit('areRecentLoading', false)
        if (response.transactions.length > 0) {
          context.commit('transactions', { transactions: response.transactions, updateTimestamps: true })
          
          if (options.fromHeight && response.transactions.length === admApi.TX_CHUNK_SIZE) {
            this.dispatch('adm/getNewTransactions')
          }
        }
      },
      error => {
        context.commit('areRecentLoading', false)
        return Promise.reject(error)
      }
    )
  },

  
  getOldTransactions (context) {
    
    if (context.state.bottomReached) return Promise.resolve()

    const options = { }
    options.minAmount = 1
    if (context.state.minHeight < Infinity) {
      options.toHeight = context.state.minHeight - 1
    }
    options.orderBy = 'timestamp:desc'

    context.commit('areOlderLoading', true)
    return admApi.getTransactions(options).then(response => {
      context.commit('areOlderLoading', false)
      const hasResult = Array.isArray(response.transactions) && response.transactions.length
      if (hasResult) {
        context.commit('transactions', { transactions: response.transactions, updateTimestamps: true })
      }
     
      if (response.success && !hasResult) {
        context.commit('bottom', true)
      }
    }, error => {
      context.commit('areOlderLoading', false)
      return Promise.reject(error)
    })
  },

  
  getTransaction (context, { hash }) {
    return admApi.getTransaction(hash).then(
      transaction => {
        context.commit('transactions', [transaction])
      }
    )
  },

 
  updateTransaction ({ dispatch }, payload) {
    return dispatch('getTransaction', payload)
  },

 
  sendTokens (context, options) {
    return admApi.sendTokens(options.address, options.amount).then(result => {
      context.commit('transactions', [{
        id: result.transactionId,
        recipientId: options.address,
        senderId: context.state.address,
        status: 'PENDING'
      }])
      return result
    })
  }
}
