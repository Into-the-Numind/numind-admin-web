<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getBillingOverviewApi, getUserConsumptionApi,
  type BillingOverview, type UserConsumption, type OperationStat
} from '@/api/billing'
import StatsCard from '@/components/common/StatsCard.vue'
import {
  DollarSign, TrendingUp, BarChart3, Percent,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-vue-next'
import { formatNumber } from '@/utils/format'
import {
  providerLabels, operationLabels, moduleGroups,
  formatCost, formatMarginRate
} from '@/constants/billingMaps'

const data = ref<BillingOverview | null>(null)
const topUsers = ref<UserConsumption[]>([])
const loading = ref(true)
const error = ref('')

// Compute module breakdown from by_operation data
interface ModuleRow {
  label: string
  call_count: number
  cost_cents: number
  revenue_cents: number
}

const moduleBreakdown = computed<ModuleRow[]>(() => {
  if (!data.value?.by_operation) return []
  const opMap = new Map<string, OperationStat>()
  for (const op of data.value.by_operation) {
    opMap.set(op.operation, op)
  }
  return Object.values(moduleGroups).map(group => {
    let call_count = 0
    let cost_cents = 0
    let revenue_cents = 0
    for (const opKey of group.operations) {
      const stat = opMap.get(opKey)
      if (stat) {
        call_count += stat.call_count
        cost_cents += stat.cost_cents
        revenue_cents += stat.revenue_cents
      }
    }
    return { label: group.label, call_count, cost_cents, revenue_cents }
  }).filter(r => r.call_count > 0 || r.cost_cents > 0)
})

// Total cost across providers for percentage calculation
const totalProviderCost = computed(() => {
  if (!data.value?.by_provider) return 0
  return data.value.by_provider.reduce((s, p) => s + p.cost_cents, 0)
})

function costPercent(cost: number): string {
  if (totalProviderCost.value === 0) return '\u2014'
  return ((cost / totalProviderCost.value) * 100).toFixed(1) + '%'
}

function margin(cost: number, revenue: number): string {
  return formatCost(revenue - cost)
}

onMounted(async () => {
  try {
    const [overview, consumption] = await Promise.all([
      getBillingOverviewApi(),
      getUserConsumptionApi({ limit: 10, period: 'month' })
    ])
    data.value = overview
    topUsers.value = consumption.users
  } catch (e) {
    error.value = (e as Error).message || '加载数据失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">用量概览</h1>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- Stats Cards: 3x3 grid -->
    <div class="stats-grid">
      <!-- Row 1 -->
      <StatsCard
        label="本月收入"
        :value="data ? formatCost(data.month_revenue_cents) : '-'"
        :icon="TrendingUp"
        color="primary"
      />
      <StatsCard
        label="本月成本"
        :value="data ? formatCost(data.month_cost_cents) : '-'"
        :icon="ArrowDownRight"
        color="warning"
      />
      <StatsCard
        label="本月毛利"
        :value="data ? margin(data.month_cost_cents, data.month_revenue_cents) : '-'"
        :icon="BarChart3"
        color="success"
      />
      <!-- Row 2 -->
      <StatsCard
        label="今日收入"
        :value="data ? formatCost(data.today_revenue_cents) : '-'"
        :icon="DollarSign"
        color="primary"
      />
      <StatsCard
        label="今日成本"
        :value="data ? formatCost(data.today_cost_cents) : '-'"
        :icon="ArrowUpRight"
        color="warning"
      />
      <StatsCard
        label="毛利率(本月)"
        :value="data ? formatMarginRate(data.month_cost_cents, data.month_revenue_cents) : '-'"
        :icon="Percent"
        color="success"
      />
      <!-- Row 3 -->
      <StatsCard
        label="累计收入"
        :value="data ? formatCost(data.total_revenue_cents) : '-'"
        :icon="TrendingUp"
        color="primary"
      />
      <StatsCard
        label="累计成本"
        :value="data ? formatCost(data.total_cost_cents) : '-'"
        :icon="Minus"
        color="warning"
      />
      <StatsCard
        label="累计毛利"
        :value="data ? margin(data.total_cost_cents, data.total_revenue_cents) : '-'"
        :icon="BarChart3"
        color="success"
      />
    </div>

    <!-- Module Breakdown -->
    <div class="card">
      <div class="card-body">
        <h2 class="section-title">按功能模块</h2>
        <div class="runs-table-container">
          <table class="runs-table">
            <thead>
              <tr>
                <th>功能模块</th>
                <th class="align-right">调用次数</th>
                <th class="align-right">成本</th>
                <th class="align-right">收入</th>
                <th class="align-right">毛利</th>
                <th class="align-right">毛利率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="loading-cell"><div class="spinner" /></td>
              </tr>
              <tr v-else-if="!moduleBreakdown.length">
                <td colspan="6" class="empty-cell">暂无数据</td>
              </tr>
              <tr v-for="row in moduleBreakdown" :key="row.label">
                <td class="text-medium">{{ row.label }}</td>
                <td class="align-right text-mono">{{ formatNumber(row.call_count) }}</td>
                <td class="align-right text-mono">{{ formatCost(row.cost_cents) }}</td>
                <td class="align-right text-mono">{{ formatCost(row.revenue_cents) }}</td>
                <td class="align-right text-mono">{{ margin(row.cost_cents, row.revenue_cents) }}</td>
                <td class="align-right text-mono">{{ formatMarginRate(row.cost_cents, row.revenue_cents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Two-column: Provider + User ranking -->
    <div class="bottom-row">
      <!-- Provider Breakdown -->
      <div class="card">
        <div class="card-body">
          <h2 class="section-title">按供应商</h2>
          <div class="runs-table-container">
            <table class="runs-table">
              <thead>
                <tr>
                  <th>供应商</th>
                  <th class="align-right">调用次数</th>
                  <th class="align-right">成本</th>
                  <th class="align-right">收入</th>
                  <th class="align-right">占比(成本)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="5" class="loading-cell"><div class="spinner" /></td>
                </tr>
                <tr v-else-if="!data?.by_provider?.length">
                  <td colspan="5" class="empty-cell">暂无数据</td>
                </tr>
                <tr v-for="item in data?.by_provider" :key="item.provider">
                  <td class="text-medium">{{ providerLabels[item.provider] || item.provider }}</td>
                  <td class="align-right text-mono">{{ formatNumber(item.call_count) }}</td>
                  <td class="align-right text-mono">{{ formatCost(item.cost_cents) }}</td>
                  <td class="align-right text-mono">{{ formatCost(item.revenue_cents) }}</td>
                  <td class="align-right text-mono">{{ costPercent(item.cost_cents) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- User Top 10 -->
      <div class="card">
        <div class="card-body">
          <h2 class="section-title">本月客户消费排行</h2>
          <div class="runs-table-container">
            <table class="runs-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>客户</th>
                  <th class="align-right">调用次数</th>
                  <th class="align-right">消费</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="4" class="loading-cell"><div class="spinner" /></td>
                </tr>
                <tr v-else-if="!topUsers.length">
                  <td colspan="4" class="empty-cell">暂无数据</td>
                </tr>
                <tr v-for="(user, idx) in topUsers" :key="user.user_id">
                  <td class="text-mono">{{ idx + 1 }}</td>
                  <td class="text-medium">{{ user.nickname || user.username }}</td>
                  <td class="align-right text-mono">{{ formatNumber(user.call_count) }}</td>
                  <td class="align-right text-mono">{{ formatCost(user.cost_cents) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.bottom-row {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: var(--space-6);
  margin-top: var(--space-6);
}

@media (max-width: 1024px) {
  .bottom-row {
    grid-template-columns: 1fr;
  }
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-4);
}

.runs-table-container {
  overflow-x: auto;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
}

.runs-table th {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.runs-table td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--gray-100);
}

.runs-table tr:last-child td {
  border-bottom: none;
}

.text-medium { font-weight: 500; }
.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}
.align-right { text-align: right; }

.loading-cell,
.empty-cell {
  text-align: center;
  padding: var(--space-8) !important;
  color: var(--text-secondary);
}
</style>
