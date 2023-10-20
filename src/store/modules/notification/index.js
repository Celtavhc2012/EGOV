const actions = {}

const getters = {}

const mutations = {
 
  increaseDesktopActivateClickCount (state) {
    state.desktopActivateClickCount++
  }
}

const state = {
  desktopActivateClickCount: 0
}

export default {
  actions,
  getters,
  mutations,
  namespaced: true,
  state
}
