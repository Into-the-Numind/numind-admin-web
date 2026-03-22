<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  getTierChangeLogsApi,
  getTierChangeStatsApi,
  type TierChangeLogItem,
  type TierChangeStatsResponse
} from '@/api/billing'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { formatDateTime } from '@/utils/format'
import { tierLabels } from '@/constants/statusMaps'

const items = ref<TierChangeLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')
const stats = ref<TierChangeStatsResponse | null>(null)

// Default date range: last 30 days
const toDate = new Date().toISOString().slice(0, 10)
const fromDate = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
const from = ref(fromDate)
const to = ref(toDate)

const columns: Column[] = [
  { key: 'created_at', title: '时间', width: '160px' },
  { key: 'parent_nickname', title: '操作客户', width: '120px' },
  { key: 'sub_nickname', title: '目标用户', width: '120px' },
  { key: 'old_tier', title: '原等级', width: '100px', align: 'center' },
  { key: 'new_tier', title: '新等级', width: '100px', align: 'center' },
  { key: 'months', title: '时长', width: '80px', align: 'right' },
  { key: 'new_tier_expires', title: '到期时间', width: '160px' }
]

const tierOrder = ['free', 'standard', 'premium']

function isUpgrade(oldTier: string, newTier: string): boolean {
  return tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier)
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const offset = (page.value - 1) * pageSize
    const [logsRes, statsRes] = await Promise.all([
      getTierChangeLogsApi({ from: from.value, to: to.value, offset, limit: pageSize }),
      getTierChangeStatsApi(from.value, to.value)
    ])
    items.value = logsRes.items
    total.value = logsRes.total
    stats.value = statsRes
  } catch (e) {
    error.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  page.value = 1
  fetchData()
}

watch(page, () => {
  // Only fetch logs on page change (stats don't change)
  fetchLogs()
})

async function fetchLogs() {
  loading.value = true
  error.value = ''
  try {
    const offset = (page.value - 1) * pageSize
    const res = await getTierChangeLogsApi({ from: from.value, to: to.value, offset, limit: pageSize })
    items.value = res.items
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

function tierBreakdownLabel(tier: string): string {
  return tierLabels[tier]?.label || tier
}

onMounted(fetchData)
</script>

<template>
  <div class="page-container">
    <!-- Top bar -->
    <div class="page-header">
      <div>
        <h1 class="page-title">客户升级记录</h1>
        <p class="page-subtitle">查看直客 (B2) 对终端用户 (B3) 的等级变更记录，用于月度营收核算</p>
      </div>
      <div class="header-actions">
        <input type="date" v-model="from" class="date-input" />
        <span class="date-separator">&mdash;</span>
        <input type="date" v-model="to" class="date-input" />
        <button @click="handleQuery" :disabled="loading" class="btn-primary">
          {{ loading ? '加载中...' : '查询' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <div class="content-area">
      <!-- Stats cards -->
      <div v-if="stats" class="stats-grid">
        <div class="card card-body">
          <div class="stat-label">总变更次数</div>
          <div class="stat-value">{{ stats.total_changes }}</div>
        </div>
        <div class="card card-body">
          <div class="stat-label">升级次数</div>
          <div class="stat-value stat-value--success">{{ stats.upgrades }}</div>
        </div>
        <div class="card card-body">
          <div class="stat-label">降级次数</div>
          <div class="stat-value stat-value--warning">{{ stats.downgrades }}</div>
        </div>
        <div class="card card-body">
          <div class="stat-label">各等级分布</div>
          <div class="tier-breakdown">
            <div v-for="b in stats.tier_breakdown" :key="b.new_tier" class="tier-row">
              <span class="tier-name">{{ tierBreakdownLabel(b.new_tier) }}</span>
              <span class="tier-count">{{ b.count }}次 / {{ b.total_months }}月</span>
            </div>
            <div v-if="stats.tier_breakdown.length === 0" class="tier-empty">暂无数据</div>
          </div>
        </div>
      </div>

      <!-- Data table -->
      <DataTable
        :columns="columns"
        :data="items"
        :loading="loading"
        :total="total"
        :page="page"
        :page-size="pageSize"
        @update:page="page = $event"
      >
        <template #cell-created_at="{ row }">
          <span class="cell-text">{{ formatDateTime((row as TierChangeLogItem).created_at) }}</span>
        </template>

        <template #cell-old_tier="{ row }">
          <StatusBadge :status="(row as TierChangeLogItem).old_tier" :map="tierLabels" />
        </template>

        <template #cell-new_tier="{ row }">
          <div class="tier-cell">
            <StatusBadge :status="(row as TierChangeLogItem).new_tier" :map="tierLabels" />
            <span v-if="isUpgrade((row as TierChangeLogItem).old_tier, (row as TierChangeLogItem).new_tier)"
              class="arrow-up">&uarr;</span>
            <span v-else class="arrow-down">&darr;</span>
          </div>
        </template>

        <template #cell-months="{ row }">
          <span class="cell-text">{{ (row as TierChangeLogItem).months }}个月</span>
        </template>

        <template #cell-new_tier_expires="{ row }">
          <span class="cell-text">{{ formatDateTime((row as TierChangeLogItem).new_tier_expires) }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.date-input {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--surface);
  transition: border-color var(--transition-fast);
}

.date-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.date-separator {
  color: var(--gray-400);
}

.btn-primary {
  background: var(--primary);
  color: #fff;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background var(--transition-fast);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Stats grid - 4 columns */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text);
}

.stat-value--success {
  color: var(--success);
}

.stat-value--warning {
  color: var(--warning);
}

/* Tier breakdown in stats card */
.tier-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tier-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.tier-name {
  color: var(--gray-600);
}

.tier-count {
  font-weight: 500;
}

.tier-empty {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Cell styles */
.cell-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.tier-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.arrow-up {
  font-size: var(--text-xs);
  color: var(--success);
  font-weight: 500;
}

.arrow-down {
  font-size: var(--text-xs);
  color: var(--warning);
  font-weight: 500;
}
</style>
