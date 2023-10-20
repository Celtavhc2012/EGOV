<template>
  <div class="a-chat">
    <div class="a-chat__content">
      <slot name="header" />

      <v-divider />

      <div class="a-chat__body">
        <div class="text-center py-2">
          <v-progress-circular
            v-show="loading"
            indeterminate
            color="primary"
            size="24"
            style="z-index: 100"
          />
        </div>

        <div
          ref="messages"
          class="a-chat__body-messages"
        >
          <template v-for="message in messages" :key="message.id">
            <slot
              name="message"
              :message="message"
              :sender="getSenderMeta(message.senderId)"
              :user-id="userId"
              :locale="locale"
            />
          </template>
        </div>

        <div class="a-chat__fab">
          <slot name="fab" />
        </div>
      </div>

      <slot name="form" />
    </div>

    <div v-if="$slots.overlay" class="a-chat__overlay">
      <slot name="overlay" />
    </div>
  </div>
</template>

<script>
import throttle from 'lodash/throttle'
import scrollIntoView from 'scroll-into-view-if-needed'
import Styler from 'stylefire'
import { animate } from 'popmotion'

import { SCROLL_TO_REPLIED_MESSAGE_ANIMATION_DURATION } from '@/lib/constants'
import { isStringEqualCI } from '@/lib/textHelpers'

const emitScroll = throttle(function () {
  this.$emit('scroll', this.currentScrollTop, this.isScrolledToBottom())
}, 200)

export default {
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    partners: {
      type: Array,
      default: () => []
    },
    userId: {
      type: String
    },
    loading: {
      type: Boolean,
      default: false
    },
    locale: {
      type: String,
      default: 'en'
    }
  },
  emits: ['scroll', 'scroll:bottom', 'scroll:top'],
  data: () => ({
    currentScrollHeight: 0,
    currentScrollTop: 0,
    currentClientHeight: 0
  }),
  mounted () {
    this.attachScrollListener()

    this.currentClientHeight = this.$refs.messages.clientHeight
    const resizeHandler = () => {
      const clientHeightDelta = this.currentClientHeight - this.$refs.messages.clientHeight

      const nonVisibleClientHeight =
        this.$refs.messages.scrollHeight -
        this.$refs.messages.clientHeight -
        Math.ceil(this.$refs.messages.scrollTop)
      const scrolledToBottom = nonVisibleClientHeight === 0

      if (scrolledToBottom) {
        
      } else {
        this.$refs.messages.scrollTop += clientHeightDelta
      }

      this.currentClientHeight = this.$refs.messages.clientHeight
    }

    this.resizeObserver = new ResizeObserver(resizeHandler)
    this.resizeObserver.observe(this.$refs.messages)
  },
  beforeUnmount () {
    this.destroyScrollListener()
    this.resizeObserver?.unobserve(this.$refs.messages)
  },
  methods: {
    attachScrollListener () {
      this.$refs.messages.addEventListener('scroll', this.onScroll)
    },

    destroyScrollListener () {
      this.$refs.messages.removeEventListener('scroll', this.onScroll)
    },

    onScroll () {
      const scrollHeight = this.$refs.messages.scrollHeight
      const scrollTop = Math.ceil(this.$refs.messages.scrollTop)
      const clientHeight = this.$refs.messages.clientHeight

      
      if (scrollHeight - scrollTop === clientHeight) {
        this.$emit('scroll:bottom')
      } else if (scrollTop === 0) { 
        
        this.currentScrollHeight = scrollHeight
        this.$emit('scroll:top')
      }

      
      this.currentScrollTop = scrollTop
      this.currentScrollHeight = scrollHeight

      emitScroll.call(this)
    },

   
    maintainScrollPosition () {
      this.$refs.messages.scrollTop =
        this.$refs.messages.scrollHeight - this.currentScrollHeight + this.currentScrollTop
    },

    
    scrollToBottom () {
      this.$refs.messages.scrollTop = this.$refs.messages.scrollHeight
    },

    scrollTo (position) {
      this.$refs.messages.scrollTop = position
    },

   
    scrollToMessage (index) {
      const elements = this.$refs.messages.children

      if (!elements) return

      const element = elements[elements.length - 1 - index]

      if (element) {
        this.$refs.messages.scrollTop = element.offsetTop - 16
      } else {
        this.scrollToBottom()
      }
    },

    
    scrollToMessageEasy(index) {
      const elements = this.$refs.messages.children

      if (!elements) return Promise.resolve(false)

      const element = elements[elements.length - 1 - index]

      if (!element) return Promise.resolve(false)

      return new Promise((resolve) => {
        scrollIntoView(element, {
          behavior: (instructions) => {
            const [{ el, top }] = instructions
            const styler = Styler(el)

            
            if (el.scrollTop === top) {
              resolve(false)
              return
            }

            animate({
              from: el.scrollTop,
              to: top,
              duration: SCROLL_TO_REPLIED_MESSAGE_ANIMATION_DURATION,
              onUpdate: (top) => styler.set('scrollTop', top),
              onComplete: () => resolve(true),
            })
          },
          block: 'center'
        })
      })
    },

    isScrolledToBottom () {
      const scrollOffset =
        this.$refs.messages.scrollHeight -
        Math.ceil(this.$refs.messages.scrollTop) -
        this.$refs.messages.clientHeight

      return scrollOffset <= 60
    },

   
    getSenderMeta (senderId) {
      return this.partners.find(partner => isStringEqualCI(partner.id, senderId))
    }
  }
}
</script>
