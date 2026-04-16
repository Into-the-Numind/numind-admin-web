<script setup lang="ts">
import { computed } from "vue";

interface Props {
  status: string;
  map?: Record<string, { label: string; color: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  map: () => ({
    pending: { label: "等待中", color: "gray" },
    running: { label: "运行中", color: "info" },
    succeeded: { label: "成功", color: "success" },
    failed: { label: "失败", color: "danger" },
    enabled: { label: "启用", color: "success" },
    disabled: { label: "禁用", color: "danger" },
  }),
});

const info = computed(
  () => props.map[props.status] || { label: props.status, color: "gray" },
);
</script>

<template>
  <span class="badge" :class="`badge--${info.color}`">
    {{ info.label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  border-radius: var(--radius-sm);
  line-height: 1.5;
}

.badge--success {
  background: var(--success-soft);
  color: #065f46;
}

.badge--danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.badge--warning {
  background: var(--warning-soft);
  color: #92400e;
}

.badge--info {
  background: var(--info-soft);
  color: #1e40af;
}

.badge--gray {
  background: var(--surface-high);
  color: var(--on-surface-variant);
}
</style>
