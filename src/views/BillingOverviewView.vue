<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getBillingOverviewApi, getUserConsumptionApi,
  type BillingOverview, type UserConsumption, type OperationStat
} from '@/api/billing'
import StatsCard from '@/components/common/StatsCard.vue'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import {
  DollarSign, TrendingUp, BarChart3, Percent,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-vue-next'
import { formatNumber } from '@/utils/format'
import {
  providerLabels, moduleGroups,
  formatCost, formatMarginRate
} from '@/constants/billingMaps'

const data = ref<BillingOverview | null>(null)
const topUsers = ref<UserConsumption[]>([])
const loading = ref(true)
const error = ref('')

// Compute module breakdown from by_operation data
interface ModuleRow {
  id: string
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
  return Object.entries(moduleGroups).map(([key, group]) => {
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
    return { id: key, label: group.label, call_count, cost_cents, revenue_cents }
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

// Column definitions for DataTable
const moduleColumns: Column[] = [
  { key: 'label', title: '功能模块', align: 'left' },
  { key: 'call_count', title: '调用次数', align: 'right' },
  { key: 'cost_cents', title: '成本', align: 'right' },
  { key: 'revenue_cents', title: '收入', align: 'right' },
  { key: 'margin', title: '毛利', align: 'right' },
  { key: 'margin_rate', title: '毛利率', align: 'right' },
]

const providerColumns: Column[] = [
  { key: 'provider', title: '供应商', align: 'left' },
  { key: 'call_count', title: '调用次数', align: 'right' },
  { key: 'cost_cents', title: '成本', align: 'right' },
  { key: 'revenue_cents', title: '收入', align: 'right' },
  { key: 'cost_percent', title: '占比(成本)', align: 'right' },
]

const topUsersColumns: Column[] = [
  { key: 'rank', title: '排名', align: 'center', width: '60px' },
  { key: 'nickname', title: '客户', align: 'left' },
  { key: 'call_count', title: '调用次数', align: 'right' },
  { key: 'cost_cents', title: '消费', align: 'right' },
]

// Computed data for provider table (add provider label + id)
const providerData = computed(() => {
  if (!data.value?.by_provider) return []
  return data.value.by_provider.map(item => ({
    ...item,
    id: item.provider,
    provider_label: providerLabels[item.provider] || item.provider,
  }))
})

// Computed data for top users table (add rank + id)
const topUsersData = computed(() => {
  return topUsers.value.map((user, idx) => ({
    ...user,
    id: user.user_id,
    rank: idx + 1,
    display_name: user.nickname || user.username,
  }))
})

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
      <p class="page-breadcrumb">Billing / Overview</p>
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
        color="info"
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
        color="danger"
      />
      <StatsCard
        label="累计毛利"
        :value="data ? margin(data.total_cost_cents, data.total_revenue_cents) : '-'"
        :icon="BarChart3"
        color="success"
      />
    </div>

    <!-- Module Breakdown -->
    <div class="section-container">
      <h2 class="section-title">按功能模块</h2>
      <DataTable
        :columns="moduleColumns"
        :data="moduleBreakdown"
        :loading="loading"
        row-key="id"
        empty-text="暂无数据"
      >
        <template #cell-call_count="{ value }">
          <span class="text-mono">{{ formatNumber(value as number) }}</span>
        </template>
        <template #cell-cost_cents="{ row }">
          <span class="text-mono">{{ formatCost((row as ModuleRow).cost_cents) }}</span>
        </template>
        <template #cell-revenue_cents="{ row }">
          <span class="text-mono">{{ formatCost((row as ModuleRow).revenue_cents) }}</span>
        </template>
        <template #cell-margin="{ row }">
          <span class="text-mono">{{ margin((row as ModuleRow).cost_cents, (row as ModuleRow).revenue_cents) }}</span>
        </template>
        <template #cell-margin_rate="{ row }">
          <span class="text-mono">{{ formatMarginRate((row as ModuleRow).cost_cents, (row as ModuleRow).revenue_cents) }}</span>
        </template>
      </DataTable>
    </div>

    <!-- Two-column: Provider + User ranking -->
    <div class="bottom-row">
      <!-- Provider Breakdown -->
      <div class="section-container">
        <h2 class="section-title">按供应商</h2>
        <DataTable
          :columns="providerColumns"
          :data="providerData"
          :loading="loading"
          row-key="id"
          empty-text="暂无数据"
        >
          <template #cell-provider="{ row }">
            <span class="text-medium">{{ (row as Record<string, any>).provider_label }}</span>
          </template>
          <template #cell-call_count="{ value }">
            <span class="text-mono">{{ formatNumber(value as number) }}</span>
          </template>
          <template #cell-cost_cents="{ row }">
            <span class="text-mono">{{ formatCost((row as Record<string, any>).cost_cents) }}</span>
          </template>
          <template #cell-revenue_cents="{ row }">
            <span class="text-mono">{{ formatCost((row as Record<string, any>).revenue_cents) }}</span>
          </template>
          <template #cell-cost_percent="{ row }">
            <span class="text-mono">{{ costPercent((row as Record<string, any>).cost_cents) }}</span>
          </template>
        </DataTable>
      </div>

      <!-- User Top 10 -->
      <div class="section-container">
        <h2 class="section-title">本月客户消费排行</h2>
        <DataTable
          :columns="topUsersColumns"
          :data="topUsersData"
          :loading="loading"
          row-key="id"
          empty-text="暂无数据"
        >
          <template #cell-rank="{ value }">
            <span class="text-mono">{{ value }}</span>
          </template>
          <template #cell-nickname="{ row }">
            <span class="text-medium">{{ (row as Record<string, any>).display_name }}</span>
          </template>
          <template #cell-call_count="{ value }">
            <span class="text-mono">{{ formatNumber(value as number) }}</span>
          </template>
          <template #cell-cost_cents="{ row }">
            <span class="text-mono">{{ formatCost((row as Record<string, any>).cost_cents) }}</span>
          </template>
        </DataTable>
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

.section-container {
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
}

.section-title {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text);
  margin-bottom: var(--space-4);
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

.text-medium {
  font-weight: 500;
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}
</style>
