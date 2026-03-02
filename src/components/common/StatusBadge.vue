<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  status: string
  map?: Record<string, { label: string; color: string }>
}

const props = withDefaults(defineProps<Props>(), {
  map: () => ({
    pending: { label: '等待中', color: 'gray' },
    running: { label: '运行中', color: 'info' },
    succeeded: { label: '成功', color: 'success' },
    failed: { label: '失败', color: 'danger' },
    enabled: { label: '启用', color: 'success' },
    disabled: { label: '禁用', color: 'danger' }
  })
})

const info = computed(() => props.map[props.status] || { label: props.status, color: 'gray' })
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
  padding: 2px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: 9999px;
  line-height: 1.5;
}

.badge--success {
  background: var(--success-light);
  color: #065F46;
}

.badge--danger {
  background: var(--danger-light);
  color: #991B1B;
}

.badge--warning {
  background: var(--warning-light);
  color: #92400E;
}

.badge--info {
  background: var(--info-light);
  color: #1E40AF;
}

.badge--gray {
  background: var(--gray-100);
  color: var(--gray-600);
}
</style>
