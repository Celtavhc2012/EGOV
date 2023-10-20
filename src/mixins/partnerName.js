import { isAdamantChat } from '@/lib/chat/meta/utils'

export default {
  methods: {
   
    getPartnerName(address) {
      const name = this.$store.getters['partners/displayName'](address) || ''

      return isAdamantChat(address) ? this.$t(name) : name
    }
  }
}
