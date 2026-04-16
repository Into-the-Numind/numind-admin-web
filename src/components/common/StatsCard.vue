<script setup lang="ts">
import type { Component } from "vue";

interface Props {
  label: string;
  value: string | number;
  icon: Component;
  color?: "primary" | "success" | "warning" | "danger" | "info";
}

withDefaults(defineProps<Props>(), {
  color: "primary",
});
</script>

<template>
  <div class="stats-card" :class="`stats-card--${color}`">
    <p class="stats-label">{{ label }}</p>
    <p class="stats-value">{{ value }}</p>
  </div>
</template>

<style scoped>
.stats-card {
  background: var(--surface-low);
  padding: 16px;
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--outline-variant);
}

.stats-card--primary {
  border-left-color: var(--primary);
}

.stats-card--tertiary,
.stats-card--info {
  border-left-color: var(--tertiary);
}

.stats-card--success {
  border-left-color: var(--success);
}

.stats-card--warning {
  border-left-color: var(--warning);
}

.stats-card--danger {
  border-left-color: var(--danger);
}

.stats-card--secondary {
  border-left-color: var(--secondary);
}

.stats-label {
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--on-surface-variant);
  margin-bottom: 4px;
}

.stats-value {
  font-family: var(--font-headline);
  font-size: 20px;
  font-weight: 700;
  color: var(--on-background);
}
</style>
