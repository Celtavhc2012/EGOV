import { Fees } from '@/lib/constants'
import { isStringEqualCI } from '@/lib/textHelpers'

const sortFunc = (a, b) => ((b && b.timestamp) || 0) - ((a && a.timestamp) || 0)

export default {
  areTransactionsLoading (state) {
    return state.areTransactionsLoading || state.areRecentLoading || state.areOlderLoading
  },
  areRecentLoading (state) {
    return state.areRecentLoading
  },
  areOlderLoading (state) {
    return state.areOlderLoading
  },

  
  sortedTransactions (state) {
    return Object.values(state.transactions).sort(sortFunc)
  },

 
  partnerTransactions: state => partner => Object.values(state.transactions).filter(tx => isStringEqualCI(tx.partner, partner)),

  fee: state => amount => Fees.ADM_TRANSFER
}
