import { Cryptos, Rates } from '@/lib/constants'

const state = () => ({
  stayLoggedIn: false, 
  sendMessageOnEnter: true,
  allowSoundNotifications: true,
  allowTabNotifications: true,
  allowPushNotifications: false,
  darkTheme: true,
  formatMessages: true,
  useFullDate: false,
  currentWallet: Cryptos.ADM, 
  useSocketConnection: true,
  suppressWarningOnAddressesNotification: false,
  currentRate: Rates.USD
})

const getters = {
  isLoginViaPassword: state => state.stayLoggedIn
}

const mutations = {
  updateOption (state, { key, value }) {
    if (key in state) {
      state[key] = value
    }
  }
}

export default {
  state,
  getters,
  mutations,
  namespaced: true
}
