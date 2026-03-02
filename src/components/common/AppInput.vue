<script setup lang="ts">
interface Props {
  modelValue: string
  placeholder?: string
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url'
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
  error?: string
}

withDefaults(defineProps<Props>(), {
  placeholder: '',
  type: 'text',
  disabled: false,
  size: 'md',
  label: undefined,
  error: undefined
})

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="app-input-field">
    <label v-if="label" class="app-input-label">{{ label }}</label>
    <div class="app-input-wrapper" :class="[`app-input--${size}`, { 'app-input-wrapper--error': !!error }]">
      <slot name="prefix" />
      <input
        class="app-input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <slot name="suffix" />
    </div>
    <p v-if="error" class="app-input-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.app-input-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  overflow: hidden;
}

.app-input-wrapper:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.app-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  width: 100%;
}

.app-input::placeholder {
  color: var(--gray-400);
}

.app-input:disabled {
  background: var(--gray-50);
  color: var(--gray-400);
  cursor: not-allowed;
}

.app-input--sm {
  height: 32px;
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
}

.app-input--md {
  height: 38px;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
}

.app-input--lg {
  height: 44px;
  padding: 0 var(--space-4);
  font-size: var(--text-base);
}

.app-input-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.app-input-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.app-input-wrapper--error {
  border-color: var(--danger);
}

.app-input-wrapper--error:focus-within {
  box-shadow: 0 0 0 3px var(--danger-light);
  border-color: var(--danger);
}

.app-input-error {
  font-size: var(--text-xs);
  color: var(--danger);
  margin: 0;
}
</style>
