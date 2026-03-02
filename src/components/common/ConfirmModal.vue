<script setup lang="ts">
interface Props {
  visible: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

withDefaults(defineProps<Props>(), {
  title: '确认操作',
  message: '确定要执行此操作吗？',
  confirmText: '确定',
  cancelText: '取消',
  danger: false
})

defineEmits<{
  confirm: []
  cancel: []
}>()
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
            <button class="modal-btn modal-btn--cancel" @click="$emit('cancel')">
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
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  width: 90%;
  max-width: 420px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-3);
}

.modal-message {
  font-size: var(--text-sm);
  color: var(--text-secondary);
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
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.modal-btn--cancel {
  background: var(--gray-100);
  color: var(--text);
}
.modal-btn--cancel:hover {
  background: var(--gray-200);
}

.modal-btn--confirm {
  background: var(--primary);
  color: #fff;
}
.modal-btn--confirm:hover {
  background: var(--primary-hover);
}

.modal-btn--danger {
  background: var(--danger);
  color: #fff;
}
.modal-btn--danger:hover {
  background: #DC2626;
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
