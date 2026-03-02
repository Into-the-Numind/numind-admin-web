<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  block: false
})
</script>

<template>
  <button
    class="app-btn"
    :class="[
      `app-btn--${variant}`,
      `app-btn--${size}`,
      { 'app-btn--block': block, 'app-btn--loading': loading }
    ]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="spinner" />
    <slot />
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
}

.app-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-btn--sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  height: 32px;
}

.app-btn--md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  height: 38px;
}

.app-btn--lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
  height: 44px;
}

.app-btn--primary {
  background: var(--primary);
  color: #fff;
}
.app-btn--primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.app-btn--secondary {
  background: var(--surface);
  color: var(--text);
  border-color: var(--border);
}
.app-btn--secondary:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.app-btn--danger {
  background: var(--danger);
  color: #fff;
}
.app-btn--danger:hover:not(:disabled) {
  background: #DC2626;
}

.app-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.app-btn--ghost:hover:not(:disabled) {
  background: var(--gray-100);
  color: var(--text);
}

.app-btn--block {
  display: flex;
  width: 100%;
}

.app-btn--loading {
  position: relative;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.app-btn--secondary .spinner,
.app-btn--ghost .spinner {
  border-color: var(--gray-300);
  border-top-color: var(--primary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
