import { Directive } from 'vue'

export const LONG_PRESS_TIMEOUT = 500

export const longPressDirective: Directive = {
  created: (el: HTMLElement, { value }, vNode) => {
    if (typeof value !== 'function') {
      console.warn(`Expect a function, got ${value}`)
      return
    }

    const startX = 0 
    const startY = 0 
    const maxDiffX = 10 
    const maxDiffY = 10 

    let pressTimer: NodeJS.Timeout | null = null

    const clearLongPressTimer = () => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer)
        pressTimer = null
      }
    }

    const start = (e: TouchEvent) => {
      if (e.type === 'click') {
        return
      }

      if (pressTimer === null) {
        pressTimer = setTimeout(() => {
          value(e)
          pressTimer = null
        }, LONG_PRESS_TIMEOUT)
      }
    }

    
    const touchMove = (e: TouchEvent) => {
      const coordinates = e.touches[0]

      
      const diffX = Math.abs(startX - coordinates.clientX)
      const diffY = Math.abs(startY - coordinates.clientY)

      
      if (diffX >= maxDiffX || diffY >= maxDiffY) {
        clearLongPressTimer()
      }
    }

    const cancel = () => {
      clearLongPressTimer()
    }

    el.addEventListener('touchstart', start)
    el.addEventListener('touchend', cancel)
    el.addEventListener('touchcancel', cancel)
    el.addEventListener('touchmove', touchMove)
  }
}
