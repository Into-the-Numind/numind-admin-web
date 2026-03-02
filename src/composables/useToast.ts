import { reactive } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

const state = reactive<{ items: Toast[] }>({ items: [] })
let nextId = 0

export function useToast() {
  function show(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = nextId++
    state.items.push({ id, message, type })
    setTimeout(() => {
      const idx = state.items.findIndex(t => t.id === id)
      if (idx > -1) state.items.splice(idx, 1)
    }, duration)
  }

  return {
    toasts: state.items,
    success: (msg: string) => show(msg, 'success'),
    error: (msg: string) => show(msg, 'error'),
    info: (msg: string) => show(msg, 'info'),
  }
}
