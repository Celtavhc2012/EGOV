import { resetState } from '../../../lib/reset-state'
import initialState from './partners-state'

export default {
  
  reset (state) {
    resetState(state, initialState())
  },

  
  displayName (state, { partner, displayName }) {
    if (Object.prototype.hasOwnProperty.call(state.list, partner)) {
      state.list[partner].displayName = displayName
    } else {
      
      state.list[partner] = { displayName }
    }
    state.lastChange = Date.now()
  },

  
  address (state, payload) {
    state.list[payload.partner] = Object.assign({ }, state.list[payload.partner],
      { [payload.crypto]: payload.address })
    state.list[payload.partner] = Object.assign({ }, state.list[payload.partner],
      { [payload.crypto + '_verifyTimestamp']: Date.now() })
  },

  
  addresses_inconsistency (state, payload) {
    state.list[payload.partner] = Object.assign({ }, state.list[payload.partner],
      { [payload.crypto + '_inconsistency']: payload.addresses })
  },

  
  contactList (state, contacts) {
    if (contacts) {
      Object.keys(contacts).forEach(uid => {
        state.list[uid] = Object.assign({}, state.list[uid], contacts[uid])
      })
    }
    state.lastUpdate = Date.now()
  }
}
