import { Cryptos, TransactionStatus as TS, TransactionAdditionalStatus as TAS } from '@/lib/constants'
import { verifyTransactionDetails } from '@/lib/txVerify'

export default {
  methods: {
   
    fetchTransactionStatus (admSpecialMessage, partnerId) {
      if (!admSpecialMessage || !partnerId) return

      const { type, hash, senderId, recipientId } = admSpecialMessage
      if (type in Cryptos) {
        
        if (type !== Cryptos.ADM) this.fetchCryptoAddresses(type, recipientId, senderId)
        
        this.fetchTransaction(type, hash, admSpecialMessage.timestamp)
      }
    },

   
    fetchTransaction (type, hash, timestamp) {
      const cryptoModule = type.toLowerCase()
      return this.$store.dispatch(`${cryptoModule}/getTransaction`, { hash, timestamp })
    },

    
    getTransaction (type, hash) {
      let transaction
      if (type === 'ADM') {
        transaction = this.$store.state.adm.transactions[hash] || { }
      } else if (!Cryptos[type]) {
        transaction = {}
      } else {
        transaction = this.$store.getters[`${type.toLowerCase()}/transaction`](hash) || {}
      }
      return transaction
    },

    
    fetchCryptoAddresses (type, recipientId, senderId) {
      const recipientCryptoAddress = this.$store.dispatch('partners/fetchAddress', {
        crypto: type,
        partner: recipientId
      })
      const senderCryptoAddress = this.$store.dispatch('partners/fetchAddress', {
        crypto: type,
        partner: senderId
      })

      return Promise.all([recipientCryptoAddress, senderCryptoAddress])
    },

    getTransactionStatus (admSpecialMessage, coinTx) {
      const status = {
        status: TS.PENDING,
        virtualStatus: TS.PENDING,
        inconsistentReason: '',
        addStatus: TAS.NONE,
        addDescription: ''
      }

      
      admSpecialMessage = admSpecialMessage && (admSpecialMessage.hash || admSpecialMessage.id) ? admSpecialMessage : undefined

      if (!admSpecialMessage && !coinTx) return status
      status.status = admSpecialMessage ? admSpecialMessage.status : coinTx.status
      status.virtualStatus = status.status

      
      if (admSpecialMessage) {
        const { type, senderId, recipientId } = admSpecialMessage
        const hash = admSpecialMessage.hash || admSpecialMessage.id

        
        if (type === Cryptos.ADM || type === 0 || type === 8 || type === 'message') {
          if (admSpecialMessage.status === TS.REGISTERED) {
            
            if (type === 'message') {
              status.virtualStatus = TS.CONFIRMED
              status.addStatus = TAS.ADM_REGISTERED
              status.addDescription = this.$t('transaction.statuses_add.adm_registered')
            } else {
         
              const transfer = this.$store.state.adm.transactions[hash]
              if (transfer && (transfer.height || transfer.confirmations > 0)) {
                status.status = TS.CONFIRMED
                status.virtualStatus = status.status
              } else {
                this.fetchTransaction('ADM', hash, admSpecialMessage.timestamp)
              }
            }
          }
          return status
        } else if (!Cryptos[type]) {
          
          status.status = TS.UNKNOWN
          status.virtualStatus = status.status
          return status
        }

        const getterName = type.toLowerCase() + '/transaction'
        const getter = this.$store.getters[getterName]
        if (!getter) return status

        coinTx = getter(hash)
        status.status = (coinTx && coinTx.status) || TS.PENDING
        status.virtualStatus = status.status

        const recipientCryptoAddress = this.$store.getters['partners/cryptoAddress'](recipientId, type)
        const senderCryptoAddress = this.$store.getters['partners/cryptoAddress'](senderId, type)

       
        if (!recipientCryptoAddress || !senderCryptoAddress || !coinTx) {
          status.status = TS.PENDING
          status.virtualStatus = status.status
          return status
        }

        if (status.status === TS.CONFIRMED) {
          const txVerify = verifyTransactionDetails(coinTx, admSpecialMessage, { recipientCryptoAddress, senderCryptoAddress })
          if (!txVerify.isTxConsistent) {
            status.status = TS.INVALID
            status.virtualStatus = status.status
            status.inconsistentReason = txVerify.txInconsistentReason
            return status
          }
        }
      }

      if (status.status === TS.REGISTERED) {
        
        if (coinTx.instantsend) {
          status.virtualStatus = TS.CONFIRMED
          status.addStatus = TAS.INSTANT_SEND
          status.addDescription = this.$t('transaction.statuses_add.instant_send')
        }
      }

      return status
    }
  }
}
