<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getBillingOverviewApi, getUserConsumptionApi, type BillingOverview, type UserConsumption } from '@/api/billing'
import StatsCard from '@/components/common/StatsCard.vue'
import { DollarSign, TrendingUp, BarChart3, Zap, Activity, Database } from 'lucide-vue-next'
import { formatNumber } from '@/utils/format'
import { serviceTypeLabels, operationLabels, formatCost } from '@/constants/billingMaps'

const data = ref<BillingOverview | null>(null)
const topUsers = ref<UserConsumption[]>([])
const loading = ref(true)
const error = ref('')

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

    <!-- Stats Cards -->
    <div class="stats-grid">
      <StatsCard
        label="今日消费"
        :value="data ? formatCost(data.today_cost_cents) : '-'"
        :icon="DollarSign"
        color="warning"
      />
      <StatsCard
        label="本月消费"
        :value="data ? formatCost(data.month_cost_cents) : '-'"
        :icon="TrendingUp"
        color="primary"
      />
      <StatsCard
        label="累计消费"
        :value="data ? formatCost(data.total_cost_cents) : '-'"
        :icon="BarChart3"
        color="info"
      />
      <StatsCard
        label="今日调用"
        :value="data ? formatNumber(data.today_call_count) : '-'"
        :icon="Zap"
        color="success"
      />
      <StatsCard
        label="本月调用"
        :value="data ? formatNumber(data.month_call_count) : '-'"
        :icon="Activity"
        color="info"
      />
      <StatsCard
        label="累计调用"
        :value="data ? formatNumber(data.total_call_count) : '-'"
        :icon="Database"
        color="primary"
      />
    </div>

    <div class="tables-row">
      <!-- 按服务类型 -->
      <div class="card">
        <div class="card-body">
          <h2 class="section-title">按服务类型</h2>
          <div class="runs-table-container">
            <table class="runs-table">
              <thead>
                <tr>
                  <th>服务类型</th>
                  <th class="align-right">调用次数</th>
                  <th class="align-right">消费</th>
                  <th class="align-right">Token</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="4" class="loading-cell"><div class="spinner" /></td>
                </tr>
                <tr v-else-if="!data?.by_service_type?.length">
                  <td colspan="4" class="empty-cell">暂无数据</td>
                </tr>
                <tr v-for="item in data?.by_service_type" :key="item.service_type">
                  <td class="text-medium">{{ serviceTypeLabels[item.service_type] || item.service_type }}</td>
                  <td class="align-right text-mono">{{ formatNumber(item.call_count) }}</td>
                  <td class="align-right text-mono">{{ formatCost(item.cost_cents) }}</td>
                  <td class="align-right text-mono">{{ formatNumber(item.total_tokens) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 按操作 -->
      <div class="card">
        <div class="card-body">
          <h2 class="section-title">按业务操作</h2>
          <div class="runs-table-container">
            <table class="runs-table">
              <thead>
                <tr>
                  <th>操作</th>
                  <th class="align-right">调用次数</th>
                  <th class="align-right">消费</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading">
                  <td colspan="3" class="loading-cell"><div class="spinner" /></td>
                </tr>
                <tr v-else-if="!data?.by_operation?.length">
                  <td colspan="3" class="empty-cell">暂无数据</td>
                </tr>
                <tr v-for="item in data?.by_operation" :key="item.operation">
                  <td class="text-medium">{{ operationLabels[item.operation] || item.operation }}</td>
                  <td class="align-right text-mono">{{ formatNumber(item.call_count) }}</td>
                  <td class="align-right text-mono">{{ formatCost(item.cost_cents) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 用户消费 Top 10 -->
    <div class="card" style="margin-top: var(--space-6);">
      <div class="card-body">
        <h2 class="section-title">本月用户消费 Top 10</h2>
        <div class="runs-table-container">
          <table class="runs-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>用户</th>
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

.tables-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}

@media (max-width: 1024px) {
  .tables-row {
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
.text-mono { font-family: var(--font-mono); font-size: var(--text-xs); }
.align-right { text-align: right; }

.loading-cell,
.empty-cell {
  text-align: center;
  padding: var(--space-8) !important;
  color: var(--text-secondary);
}
</style>
