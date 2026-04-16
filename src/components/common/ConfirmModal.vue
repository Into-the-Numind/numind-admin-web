<script setup lang="ts">
interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

withDefaults(defineProps<Props>(), {
  title: "确认操作",
  message: "确定要执行此操作吗？",
  confirmText: "确定",
  cancelText: "取消",
  danger: false,
});

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="modal-overlay"
        @click.self="$emit('cancel')"
        @keydown.esc="$emit('cancel')"
      >
        <div class="modal-card" role="dialog" aria-modal="true">
          <h3 class="modal-title">{{ title }}</h3>
          <p class="modal-message">
            <slot>{{ message }}</slot>
          </p>
          <div class="modal-actions">
            <button
              class="modal-btn modal-btn--cancel"
              @click="$emit('cancel')"
            >
              {{ cancelText }}
            </button>
            <button
              class="modal-btn"
              :class="danger ? 'modal-btn--danger' : 'modal-btn--confirm'"
              @click="$emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-card {
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
  padding: var(--space-6);
  width: 90%;
  max-width: 420px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--on-surface);
  margin-bottom: var(--space-3);
}

.modal-message {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
  margin-bottom: var(--space-6);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.modal-btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-sm);
  font-family: var(--font-label);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.modal-btn--cancel {
  background: var(--surface-high);
  color: var(--on-surface);
}
.modal-btn--cancel:hover {
  background: var(--surface-highest);
}

.modal-btn--confirm {
  background: var(--primary);
  color: var(--on-primary);
}
.modal-btn--confirm:hover {
  opacity: 0.9;
}

.modal-btn--danger {
  background: var(--danger);
  color: white;
}
.modal-btn--danger:hover {
  opacity: 0.9;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}
.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 200ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-card {
  transform: scale(0.95);
}
.modal-leave-to .modal-card {
  transform: scale(0.95);
}
</style>
