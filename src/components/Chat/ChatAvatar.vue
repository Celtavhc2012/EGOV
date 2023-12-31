<template>
  <div
    :class="classes"
    :style="styles"
    @click="$attrs.onClick"
  >
    <img
      v-if="avatar"
      :src="avatar"
      :width="size"
      :height="size"
    >
    <canvas
      ref="avatar"
      :width="canvasSize"
      :height="canvasSize"
      :style="{ display: 'none' }"
    />
  </div>
</template>

<script>
import { getPublicKey } from '@/lib/adamant-api'
import Identicon from '@/lib/identicon'

export default {
  inheritAttrs: false,
  props: {
    size: {
      type: Number,
      default: 40
    },
    userId: {
      type: String,
      required: true
    },
    usePublicKey: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    className: () => 'chat-avatar',
    isClickable () {
      return !!this.$attrs.onClick
    },
    classes () {
      return [
        this.className,
        { [`${this.className}--clickable`]: this.isClickable }
      ]
    },
    styles () {
      return {
        width: `${this.size}px`,
        height: `${this.size}px`
      }
    },
    avatar () {
      return this.$store.getters['identicon/avatar'](this.userId)
    },
    canvasSize () {
      return this.size < 40 ? 40 : this.size
    },
    isAvatarCached () {
      return this.$store.getters['identicon/isAvatarCached'](this.userId)
    }
  },
  mounted () {
    this.getAvatar()
  },
  methods: {
   
    getAvatar () {
      if (!this.isAvatarCached) {
        this.getBase64Image()
          .then(Base64 => {
            this.$store.dispatch('identicon/saveAvatar', {
              userId: this.userId,
              Base64
            })
          })
      }
    },
    
    getBase64Image () {
      const el = this.$refs.avatar
      const identicon = new Identicon()

      
      if (this.usePublicKey) {
        return getPublicKey(this.userId)
          .then(key => {
            identicon.avatar(el, key, this.canvasSize)

            return el.toDataURL()
          })
          .catch(() => {
            
            identicon.avatar(el, this.userId, this.canvasSize)

            return el.toDataURL()
          })
      } else {
        identicon.avatar(el, this.userId, this.canvasSize)
      }

      return Promise.resolve(el.toDataURL())
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-avatar {
  line-height: 1;

  &--clickable {
    cursor: pointer;
  }

  img {
    display: block;
  }
}
</style>
