import { resetState } from '../../../lib/reset-state'
import initialState from './state'

import baseMutations from '../eth-base/eth-base-mutations'

export default {
  ...baseMutations,

 
  reset (state) {
    resetState(state, initialState())
  },

  
  gasPrice (state, payload) {
    state.gasPrice = payload.gasPrice
    state.fee = payload.fee
  },

  
  blockNumber (state, number) {
    state.blockNumber = number
  },

 
  isPublished (state) {
    state.isPublished = true
  }
}
