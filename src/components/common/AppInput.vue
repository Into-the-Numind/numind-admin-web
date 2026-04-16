<script setup lang="ts">
interface Props {
  modelValue: string | number | null;
  placeholder?: string;
  type?: "text" | "password" | "email" | "number" | "tel" | "url" | "date";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  step?: string;
  label?: string;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "",
  type: "text",
  disabled: false,
  size: "md",
  step: undefined,
  label: undefined,
  error: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: string | number | null];
}>();

function onInput(event: Event) {
  const val = (event.target as HTMLInputElement).value;
  if (props.type === "number") {
    // If the original modelValue was null and input is empty, emit null back
    if (val === "" && props.modelValue === null) {
      emit("update:modelValue", null);
    } else {
      emit("update:modelValue", val === "" ? 0 : Number(val));
    }
  } else {
    emit("update:modelValue", val);
  }
}
</script>

<template>
  <div class="app-input-field">
    <label v-if="label" class="app-input-label">{{ label }}</label>
    <div
      class="app-input-wrapper"
      :class="[`app-input--${size}`, { 'app-input-wrapper--error': !!error }]"
    >
      <slot name="prefix" />
      <input
        class="app-input"
        :type="type"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :disabled="disabled"
        :step="step"
        @input="onInput"
      />
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
  background: var(--surface-low);
  border: none;
  border-radius: var(--radius-sm);
  transition: box-shadow var(--transition-fast);
  overflow: hidden;
}

.app-input-wrapper:focus-within {
  outline: none;
  box-shadow: 0 0 0 1px var(--tertiary);
}

.app-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--on-surface);
  width: 100%;
}

.app-input::placeholder {
  color: var(--on-surface-variant);
}

.app-input:disabled {
  opacity: 0.5;
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
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.app-input-wrapper--error {
  box-shadow: 0 0 0 1px var(--danger);
}

.app-input-wrapper--error:focus-within {
  box-shadow: 0 0 0 1px var(--danger);
}

.app-input-error {
  font-size: var(--text-xs);
  color: var(--danger);
  margin: 0;
}
</style>
