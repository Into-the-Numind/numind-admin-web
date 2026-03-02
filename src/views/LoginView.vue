<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import { Lock, User } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await authStore.login(username.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = (e as Error).message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">N</div>
        <h1 class="login-title">莫小派管理后台</h1>
        <p class="login-subtitle">Numind Admin Dashboard</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <AppInput v-model="username" placeholder="请输入管理员用户名" size="lg">
            <template #prefix>
              <User :size="18" class="input-icon" />
            </template>
          </AppInput>
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <AppInput v-model="password" type="password" placeholder="请输入密码" size="lg">
            <template #prefix>
              <Lock :size="18" class="input-icon" />
            </template>
          </AppInput>
        </div>

        <Transition name="fade">
          <p v-if="error" class="login-error">{{ error }}</p>
        </Transition>

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="loading"
          block
        >
          登录
        </AppButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #4338CA 100%);
  padding: var(--space-4);
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: var(--space-10);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.login-header {
  text-align: center;
  margin-bottom: var(--space-8);
}

.login-logo {
  width: 56px;
  height: 56px;
  background: var(--primary);
  color: #fff;
  border-radius: var(--radius-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--text-2xl);
  margin-bottom: var(--space-4);
}

.login-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-1);
}

.login-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.input-icon {
  color: var(--gray-400);
  flex-shrink: 0;
}

.login-error {
  font-size: var(--text-sm);
  color: var(--danger);
  text-align: center;
  margin: calc(-1 * var(--space-2)) 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
