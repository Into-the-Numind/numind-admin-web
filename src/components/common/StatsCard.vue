<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  label: string
  value: string | number
  icon: Component
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

withDefaults(defineProps<Props>(), {
  color: 'primary'
})
</script>

<template>
  <div class="stats-card" :class="`stats-card--${color}`">
    <div class="stats-card__icon">
      <component :is="icon" :size="24" />
    </div>
    <div class="stats-card__content">
      <p class="stats-card__label">{{ label }}</p>
      <p class="stats-card__value">{{ value }}</p>
    </div>
  </div>
</template>

<style scoped>
.stats-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}

.stats-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.stats-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.stats-card--primary .stats-card__icon {
  background: var(--primary-light);
  color: var(--primary);
}
.stats-card--success .stats-card__icon {
  background: var(--success-light);
  color: var(--success);
}
.stats-card--warning .stats-card__icon {
  background: var(--warning-light);
  color: var(--warning);
}
.stats-card--danger .stats-card__icon {
  background: var(--danger-light);
  color: var(--danger);
}
.stats-card--info .stats-card__icon {
  background: var(--info-light);
  color: var(--info);
}

.stats-card__content {
  min-width: 0;
}

.stats-card__label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.stats-card__value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}
</style>
