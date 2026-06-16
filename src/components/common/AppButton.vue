<script setup lang="ts">
interface Props {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  // 默认 "button"：放进 <form> 里的按钮不会意外触发表单提交（原生 <button> 默认是
  // submit，曾导致"取消"按钮一点就提交/创建重复，见 notif-acceptance-fixes）。
  // 需要提交按钮时显式写 type="submit"（全站 3 个表单的提交按钮均已显式标注）。
  type?: "button" | "submit" | "reset";
}

withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  loading: false,
  disabled: false,
  block: false,
  type: "button",
});
</script>

<template>
  <button
    class="app-btn"
    :type="type"
    :class="[
      `app-btn--${variant}`,
      `app-btn--${size}`,
      { 'app-btn--block': block, 'app-btn--loading': loading },
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
  border-radius: var(--radius-sm);
  font-family: var(--font-label);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
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
  height: 32px;
}

.app-btn--md {
  padding: var(--space-2) var(--space-4);
  height: 38px;
}

.app-btn--lg {
  padding: var(--space-3) var(--space-6);
  height: 44px;
}

.app-btn--primary {
  background: var(--primary);
  color: var(--on-primary);
}
.app-btn--primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.app-btn--secondary {
  background: var(--surface-high);
  color: var(--on-surface);
  border: 1px solid rgba(169, 180, 185, 0.2);
}
.app-btn--secondary:hover:not(:disabled) {
  background: var(--surface-highest);
}

.app-btn--danger {
  background: var(--danger);
  color: white;
}
.app-btn--danger:hover:not(:disabled) {
  background: var(--danger);
  filter: brightness(0.9);
}

.app-btn--ghost {
  background: transparent;
  color: var(--on-surface-variant);
}
.app-btn--ghost:hover:not(:disabled) {
  background: var(--surface-low);
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
  border-top-color: var(--on-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.app-btn--secondary .spinner {
  border-color: rgba(169, 180, 185, 0.3);
  border-top-color: var(--tertiary);
}

.app-btn--danger .spinner {
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: white;
}

.app-btn--ghost .spinner {
  border-color: rgba(169, 180, 185, 0.3);
  border-top-color: var(--tertiary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
