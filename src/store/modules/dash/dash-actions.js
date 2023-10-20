import baseActions from '../btc-base/btc-base-actions'
import DashApi from '../../../lib/bitcoin/dash-api'

const TX_FETCH_INTERVAL = 30 * 1000


const getNewTransactions = (api, context) => {
  const excludes = Object.keys(context.state.transactions)

  context.commit('areRecentLoading', true)
  return api.getTransactions({ excludes }).then(
    result => {
      context.commit('areRecentLoading', false)
      context.commit('transactions', result.items)
      context.commit('bottom', true)
    },
    error => {
      context.commit('areRecentLoading', false)
      return Promise.reject(error)
    }
  )
}

const getOldTransactions = (api, context) => {
  
  if (context.state.bottomReached) return Promise.resolve()

  const excludes = Object.keys(context.state.transactions)

  context.commit('areOlderLoading', true)
  return api.getTransactions({ excludes }).then(
    result => {
      context.commit('areOlderLoading', false)
      context.commit('transactions', result.items)
      context.commit('bottom', true)
    },
    error => {
      context.commit('areOlderLoading', false)
      return Promise.reject(error)
    }
  )
}

export default {
  ...baseActions({
    apiCtor: DashApi,
    getOldTransactions,
    getNewTransactions,
    fetchRetryTimeout: TX_FETCH_INTERVAL
  })
}
