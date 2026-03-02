import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, type AdminUser } from '@/api/auth'

function parseStoredUser(): AdminUser | null {
  try {
    return JSON.parse(localStorage.getItem('admin_user') || 'null')
  } catch {
    localStorage.removeItem('admin_user')
    return null
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    const payload = JSON.parse(atob(parts[1]))
    return payload.exp ? payload.exp * 1000 < Date.now() : false
  } catch {
    return true
  }
}

export const useAuthStore = defineStore('auth', () => {
  const savedToken = localStorage.getItem('admin_token') || ''
  const tokenExpired = savedToken && isTokenExpired(savedToken)

  if (tokenExpired) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  const token = ref(tokenExpired ? '' : savedToken)
  const user = ref<AdminUser | null>(tokenExpired ? null : parseStoredUser())

  const isLoggedIn = computed(() => !!token.value)

  async function login(username: string, password: string) {
    const res = await loginApi(username, password)
    token.value = res.token
    user.value = res.user
    localStorage.setItem('admin_token', res.token)
    localStorage.setItem('admin_user', JSON.stringify(res.user))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  return { token, user, isLoggedIn, login, logout }
})
