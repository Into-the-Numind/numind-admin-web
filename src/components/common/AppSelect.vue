<script setup lang="ts">
export interface SelectOption {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
  disabled: false,
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function handleChange(event: Event) {
  const strValue = (event.target as HTMLSelectElement).value
  const option = props.options.find(o => String(o.value) === strValue)
  const value = option && typeof option.value === 'number' ? Number(strValue) : strValue
  emit('update:modelValue', value)
}
</script>

<template>
  <div class="app-select-wrapper" :class="`app-select--${size}`">
    <select
      class="app-select"
      :value="modelValue"
      :disabled="disabled"
      @change="handleChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.app-select-wrapper {
  position: relative;
  display: inline-flex;
}

.app-select {
  appearance: none;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  padding-right: var(--space-8);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236B7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.app-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.app-select:disabled {
  background: var(--gray-50);
  color: var(--gray-400);
  cursor: not-allowed;
}

.app-select--sm .app-select {
  height: 32px;
  padding: 0 var(--space-6) 0 var(--space-2);
  font-size: var(--text-xs);
}

.app-select--md .app-select {
  height: 38px;
  padding: 0 var(--space-8) 0 var(--space-3);
  font-size: var(--text-sm);
}

.app-select--lg .app-select {
  height: 44px;
  padding: 0 var(--space-8) 0 var(--space-4);
  font-size: var(--text-base);
}
</style>
