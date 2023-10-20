<template>
  <div :class="className">
    <div :class="`${className}__activator`" @click="$refs.fileInput.click()">
      <slot />
    </div>

    <input
      id="fileInput"
      ref="fileInput"
      type="file"
      accept="image/*"
      :class="`${className}__file-input`"
      @change="onFileSelect"
    />

    <img ref="imageElement" :src="imageBase64" :class="`${className}__image`" />
  </div>
</template>

<script>
export default {
  emits: ['detect', 'error'],
  data: () => ({
    selectedImage: undefined,
    imageBase64: '',
    qrCodeText: '',
    codeReader: undefined
  }),
  computed: {
    className() {
      return 'qrcode-capture'
    }
  },
  methods: {
    async onFileSelect(event) {
      this.selectedImage = event.target.files[0]

      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        this.codeReader = new BrowserQRCodeReader()
        this.imageBase64 = await this.getImageBase64()
        this.qrCodeText = await this.tryToDecode()

        this.$emit('detect', this.qrCodeText)
      } catch (err) {
        this.$emit('error', err)
      }
      
      this.$refs.fileInput.value = ''
    },

  
    getImageBase64() {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => resolve(e.target.result)
        reader.onerror = (err) => reject(err)

        reader.readAsDataURL(this.selectedImage)
      })
    },

   
    async getQrcode() {
      const result = await this.codeReader.decodeFromImageElement(this.$refs.imageElement)

      return result.text
    },

    tryToDecode() {
      return new Promise((resolve, reject) => {
      
        setTimeout(() => {
          this.getQrcode()
            .then((qrCodeText) => resolve(qrCodeText))
            .catch((err) => reject(err))
        }, 0)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.qrcode-capture {
  &__file-input,
  &__image {
    display: none;
  }
}
</style>
