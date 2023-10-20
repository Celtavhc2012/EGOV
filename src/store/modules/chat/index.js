import validateAddress from '@/lib/validateAddress'
import * as admApi from '@/lib/adamant-api'
import {
  createChat,
  getChats,
  queueMessage,
  createMessage,
  createTransaction,
  createReaction,
  normalizeMessage
} from '@/lib/chat/helpers'
import { isNumeric } from '@/lib/numericHelpers'
import { Cryptos, TransactionStatus as TS, MessageType } from '@/lib/constants'
import { isStringEqualCI } from '@/lib/textHelpers'
import { replyMessageAsset } from '@/lib/adamant-api/asset'

import { generateAdamantChats } from './utils/generateAdamantChats'

export let interval

const SOCKET_ENABLED_TIMEOUT = 10000
const SOCKET_DISABLED_TIMEOUT = 3000


 
const state = () => ({
  chats: {},
  lastMessageHeight: 0, 
  isFulfilled: false, 
  offset: 0 
})

const getters = {
  
  partners: (state) => Object.keys(state.chats),

  
  messages: (state) => (senderId) => {
    const chat = state.chats[senderId]

    if (chat) {
      return chat.messages.sort((left, right) => left.timestamp - right.timestamp)
    }

    return []
  },

  reactions: (state, getters) => (transactionId, partnerId) => {
    const messages = getters.messages(partnerId)

    return messages.filter(
      (message) => message.type === 'reaction' && message.asset.reactto_id === transactionId
    )
  },

  reactionsBySenderId: (state, getters) => (transactionId, partnerId, senderId) => {
    const reactions = getters.reactions(transactionId, partnerId)

    return reactions.filter((reaction) => reaction.senderId === senderId)
  },

  lastReaction: (state, getters) => (transactionId, partnerId, senderId) => {
    const reactions = getters.reactionsBySenderId(transactionId, partnerId, senderId)

    if (reactions.length === 0) return null

    return reactions[reactions.length - 1]
  },

  
  messageById: (state, getters) => (id) => {
    const partnerIds = getters.partners
    let message

    partnerIds.forEach((senderId) => {
      const found = getters.messages(senderId).find((message) => message.id === id)

      if (found) {
        message = found
      }
    })

    return message
  },

  
  indexOfMessage: (state, getters) => (partnerId, messageId) => {
    const messages = getters.messages(partnerId).filter((message) => message.type !== 'reaction')
    const message = messages.find((message) => message.id === messageId)

    if (!message) {
      return -1
    }

    const index = messages.indexOf(message)

    if (index === -1) {
      return -1
    }

    return messages.length - 1 - index 
  },

  
  partnerMessageById: (state, getters) => (partnerId, messageId) => {
    const messages = getters.messages(partnerId)

    return messages.find((message) => message.id === messageId)
  },

  
  lastMessage: (state, getters) => (senderId) => {
    const senderIds = getters.partners

    if (senderIds.includes(senderId)) {
      const chat = state.chats[senderId]
      const messages = chat.messages
      const length = messages.length

      if (length > 0) {
        return messages[length - 1]
      }
    }

    return null
  },

  
  lastMessageText: (state, getters) => (senderId) => {
    const message = getters.lastMessage(senderId) || {}

    return (message && message.message) || ''
  },

  
  lastMessageTimestamp: (state, getters) => (senderId) => {
    const abstract = getters.lastMessage(senderId)

    if (abstract && isNumeric(abstract.timestamp)) {
      return abstract.timestamp
    }

    return ''
  },

  isPartnerInChatList: (state, getters) => (senderId) => {
    return getters.partners.includes(senderId)
  },

  
  numOfNewMessages: (state) => (senderId) => {
    const chat = state.chats[senderId]

    if (chat) {
      return chat.numOfNewMessages
    }

    return 0
  },

  
  totalNumOfNewMessages: (state) => {
    const senderIds = Object.keys(state.chats)

    return senderIds.reduce((acc, senderId) => state.chats[senderId].numOfNewMessages + acc, 0)
  },

  unreadMessages: (state, getters) => {
    let messages = []

    getters.partners.forEach((partnerId) => {
      const numOfNewMessages = getters.numOfNewMessages(partnerId)

      
      const partnerMessages = getters.messages(partnerId)
      const lastPartnerMessages = partnerMessages.slice(partnerMessages.length - numOfNewMessages)

      messages = [...messages, ...lastPartnerMessages]
    })

    return messages
  },

 
  lastUnreadMessage: (state, getters) => {
    const length = getters.unreadMessages.length

    return getters.unreadMessages[length - 1] || null
  },

  lastMessages: (state, getters) => {
    const partners = getters.partners

    return partners
      .map((partnerId) => {
        const message = getters.lastMessage(partnerId)

        return {
          timestamp: Date.now(), 
          ...message,
          contactId: partnerId
        }
      })
      .sort((left, right) => right.timestamp - left.timestamp)
  },

  scrollPosition: (state) => (contactId) => {
    const chat = state.chats[contactId]

    if (chat && chat.scrollPosition !== undefined) {
      return chat.scrollPosition
    }

    return false
  },


  chatOffset: (state) => (contactId) => {
    const chat = state.chats[contactId]

    return (chat && chat.offset) || 0
  },

  
  chatPage: (state) => (contactId) => {
    const chat = state.chats[contactId]

    return (chat && chat.page) || 0
  },

  
  chatListOffset: (state) => {
    return state.offset
  }
}

const mutations = {
  
  setHeight(state, height) {
    state.lastMessageHeight = height
  },

  setChatOffset(state, { contactId, offset }) {
    const chat = state.chats[contactId]

    if (chat) {
      chat.offset = offset
    }
  },

  setChatPage(state, { contactId, page }) {
    const chat = state.chats[contactId]

    if (chat) {
      chat.page = page
    }
  },

  setOffset(state, offset) {
    state.offset = offset
  },

  
  setFulfilled(state, value) {
    state.isFulfilled = value
  },

 
  createEmptyChat(state, partnerId) {
    const chat = state.chats[partnerId]

    
    if (chat) {
      return
    }

    state.chats[partnerId] = createChat()
  },

 
  pushMessage(state, { message, userId, unshift = false }) {
    const partnerId = isStringEqualCI(message.senderId, userId)
      ? message.recipientId
      : message.senderId

    
    if (!state.chats[partnerId]) {
      state.chats[partnerId] = createChat()
    }

    const chat = state.chats[partnerId]

    
    const localMessage = chat.messages.find((localMessage) => localMessage.id === message.id)
    if (localMessage) {
   
      localMessage.status = message.status
      localMessage.height = message.height
      return
    }

    
    if (
      message.type &&
      message.type !== 'message' &&
      message.type !== 'reaction' &&
      message.type !== Cryptos.ADM
    ) {
      const localTransaction = chat.messages.find(
        (localTransaction) => localTransaction.hash === message.hash
      )
      if (localTransaction) return
    }

   
    if (unshift) {
      chat.messages.unshift(message)
    } else {
      chat.messages.push(message)
    }

    
    if (
      (message.height === undefined || 
        (message.height > state.lastMessageHeight && state.lastMessageHeight > 0)) &&
      !isStringEqualCI(userId, message.senderId) 
    ) {
      chat.numOfNewMessages += 1
    }
  },

  
  markAsRead(state, partnerId) {
    const chat = state.chats[partnerId]

    if (chat) {
      chat.numOfNewMessages = 0
    }
  },

 
  markAllAsRead(state) {
    const senderIds = Object.keys(state.chats)

    senderIds.forEach((senderId) => {
      state.chats[senderId].numOfNewMessages = 0
    })
  },

  
  updateMessage(state, { partnerId, id, realId, status }) {
    const chat = state.chats[partnerId]

    if (chat) {
      const message = chat.messages.find((message) => message.id === id)

      if (message) {
        if (realId) {
          message.id = realId
        }
        if (status) {
          message.status = status
        }
      }
    }
  },

  
  createAdamantChats(state) {
    const chats = generateAdamantChats()

    Object.entries(chats).forEach(([senderId, chat]) => {
      state.chats[senderId] = chat
    })
  },

  updateScrollPosition(state, { contactId, scrollPosition }) {
    const chat = state.chats[contactId]

    if (chat) {
      chat.scrollPosition = scrollPosition
    }
  },

  reset(state) {
    state.chats = {}
    state.lastMessageHeight = 0
    state.isFulfilled = false
  }
}

const actions = {
  
  loadChats({ commit, dispatch, rootState }, { perPage = 25 } = {}) {
    commit('setFulfilled', false)

    return admApi.getChatRooms(rootState.address).then((result) => {
      const { messages, lastMessageHeight } = result

      dispatch('pushMessages', messages)

      if (lastMessageHeight > 0) {
        commit('setHeight', lastMessageHeight)
        commit('setOffset', perPage)
      }

      commit('setFulfilled', true)
    })
  },

  loadChatsPaged({ commit, dispatch, rootState, state }, { perPage = 25 } = {}) {
    const offset = state.offset

    if (offset === -1) {
      return Promise.reject(new Error('No more chats'))
    }

    return admApi
      .getChatRooms(rootState.address, { offset, limit: perPage })
      .then(({ messages }) => {
        dispatch('pushMessages', messages)

        if (messages.length <= 0) {
          commit('setOffset', -1)
        } else {
          commit('setOffset', offset + perPage)
        }
      })
  },

  
  getChatRoomMessages({ rootState, dispatch, commit, getters }, { contactId, perPage = 25 } = {}) {
    let offset = getters.chatOffset(contactId)
    let page = getters.chatPage(contactId)

    if (offset === -1) {
      return Promise.reject(new Error('No more messages'))
    }

    return admApi
      .getChatRoomMessages(rootState.address, contactId, { offset, limit: perPage }, true)
      .then(({ messages, lastOffset }) => {
        dispatch('unshiftMessages', messages)

        if (messages.length <= 0) {
          commit('setChatOffset', { contactId, offset: -1 }) // no more messages
        } else {
          offset = lastOffset

          commit('setChatOffset', { contactId, offset })
          commit('setChatPage', { contactId, page: ++page })
        }
      })
  },

  
  pushMessages({ commit, rootState }, messages) {
    messages.forEach((message) => {
      commit('pushMessage', {
        message: normalizeMessage(message),
        userId: rootState.address
      })
    })
  },

  unshiftMessages({ commit, rootState }, messages) {
    messages.forEach((message) => {
      commit('pushMessage', {
        message: normalizeMessage(message),
        userId: rootState.address,

        unshift: true
      })
    })
  },


  getNewMessages({ state, commit, dispatch }) {
    if (!state.isFulfilled) {
      return Promise.reject(new Error('Chat is not fulfilled'))
    }

    return getChats(state.lastMessageHeight).then((result) => {
      const { messages, lastMessageHeight } = result

      dispatch('pushMessages', messages)

      if (lastMessageHeight > 0) {
        commit('setHeight', lastMessageHeight)
      }
    })
  },

  
  createChat({ commit }, { partnerId, partnerName = '' }) {
    if (!validateAddress('ADM', partnerId)) {
      return Promise.reject(new Error('Invalid user address'))
    }

    return admApi
      .getPublicKey(partnerId)
      .then((key) => {
        
        if (!key) {
          throw new Error('Account not found')
        }

        return key
      })
      .then((key) => {
        
        if (partnerName) {
          commit(
            'partners/displayName',
            {
              partner: partnerId,
              displayName: partnerName
            },
            { root: true }
          )
        }

        commit('createEmptyChat', partnerId)

        return key
      })
  },

 
  sendMessage({ commit, rootState }, { message, recipientId, replyToId }) {
    const messageObject = createMessage({
      message,
      recipientId,
      senderId: rootState.address,
      replyToId
    })

    commit('pushMessage', {
      message: messageObject,
      userId: rootState.address
    })

    const type = replyToId ? MessageType.RICH_CONTENT_MESSAGE : MessageType.BASIC_ENCRYPTED_MESSAGE
    const messageAsset = replyToId
      ? replyMessageAsset({
          replyToId,
          replyMessage: message
        })
      : message

    return queueMessage(messageAsset, recipientId, type)
      .then((res) => {
        
        if (!res.success) {
          throw new Error('Message rejected')
        }

        
        commit('updateMessage', {
          id: messageObject.id,
          realId: res.transactionId,
          status: TS.REGISTERED, 
          partnerId: recipientId
        })

        return res
      })
      .catch((err) => {
        
        commit('updateMessage', {
          id: messageObject.id,
          status: TS.REJECTED,
          partnerId: recipientId
        })

        throw err 
      })
  },

  
  resendMessage({ getters, commit }, { recipientId, messageId }) {
    const message = getters.partnerMessageById(recipientId, messageId)

 
    commit('updateMessage', {
      id: messageId,
      status: TS.PENDING,
      partnerId: recipientId
    })

    if (message) {
      const type = message.isReply
        ? MessageType.RICH_CONTENT_MESSAGE
        : MessageType.BASIC_ENCRYPTED_MESSAGE
      const messageAsset = message.isReply
        ? {
            replyto_id: message.asset.replyto_id,
            reply_message: message.message
          }
        : message.message

      return queueMessage(messageAsset, recipientId, type)
        .then((res) => {
          if (!res.success) {
            throw new Error('Message rejected')
          }

          commit('updateMessage', {
            id: messageId,
            realId: res.transactionId,
            status: TS.REGISTERED,
            partnerId: recipientId
          })

          return res
        })
        .catch((err) => {
          commit('updateMessage', {
            id: messageId,
            status: TS.REJECTED,
            partnerId: recipientId
          })

          throw err
        })
    }

    return Promise.reject(new Error('Message not found in history'))
  },

  
  sendReaction({ commit, rootState }, { recipientId, reactToId, reactMessage }) {
    const messageObject = createReaction({
      recipientId,
      senderId: rootState.address,
      reactToId,
      reactMessage
    })

    commit('pushMessage', {
      message: messageObject,
      userId: rootState.address
    })

    const type = MessageType.RICH_CONTENT_MESSAGE
    return queueMessage(messageObject.asset, recipientId, type)
      .then((res) => {
        
        if (!res.success) {
          throw new Error('Message rejected')
        }

        
        commit('updateMessage', {
          id: messageObject.id,
          realId: res.transactionId,
          status: TS.REGISTERED, 
          partnerId: recipientId
        })

        return res
      })
      .catch((err) => {
       
        commit('updateMessage', {
          id: messageObject.id,
          status: TS.REJECTED,
          partnerId: recipientId
        })

        throw err 
      })
  },

  
  pushTransaction({ commit, rootState }, payload) {
    const {
      transactionId,
      recipientId,
      type,
      status,
      amount,
      hash,
      comment = '',
      replyToId
    } = payload

    const transactionObject = createTransaction({
      transactionId,
      recipientId,
      type,
      status,
      amount,
      hash,
      comment,
      senderId: rootState.address,
      replyToId
    })

    commit('pushMessage', {
      message: transactionObject,
      userId: rootState.address
    })


    commit('updateScrollPosition', {
      contactId: recipientId,
      scrollPosition: undefined
    })

    return transactionObject.id
  },

  startInterval: {
    root: true,
    handler({ dispatch, rootState }) {
      function repeat() {
        dispatch('getNewMessages')
          .catch((err) => console.error(err))
          .then(() => {
            const timeout = rootState.options.useSocketConnection
              ? SOCKET_ENABLED_TIMEOUT
              : SOCKET_DISABLED_TIMEOUT
            interval = setTimeout(repeat, timeout)
          })
      }

      repeat()
    }
  },

  stopInterval: {
    root: true,
    handler() {
      clearTimeout(interval)
    }
  },


  reset: {
    root: true,
    handler({ commit }) {
      commit('reset')
    }
  }
}

export default {
  state,
  getters,
  mutations,
  actions,
  namespaced: true
}
