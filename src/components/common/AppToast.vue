<script setup lang="ts">
import { useToast } from "@/composables/useToast";
import { CheckCircle, XCircle, Info } from "lucide-vue-next";

const { toasts } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.type}`"
          role="alert"
        >
          <CheckCircle v-if="toast.type === 'success'" :size="18" />
          <XCircle v-if="toast.type === 'error'" :size="18" />
          <Info v-if="toast.type === 'info'" :size="18" />
          <span>{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-6);
  right: var(--space-6);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  box-shadow: var(--shadow-md);
  pointer-events: auto;
  min-width: 200px;
  max-width: 400px;
}

.toast--success {
  background: var(--success-soft);
  color: #065f46;
  border: 1px solid var(--success);
}

.toast--error {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--danger);
}

.toast--info {
  background: var(--info-soft);
  color: #1e40af;
  border: 1px solid var(--info);
}

.toast-enter-active {
  transition: all 300ms ease;
}

.toast-leave-active {
  transition: all 200ms ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
