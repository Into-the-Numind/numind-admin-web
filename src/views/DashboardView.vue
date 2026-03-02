<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getStatsApi, getRecentRunsApi, type DashboardStats, type RecentRun } from '@/api/dashboard'
import StatsCard from '@/components/common/StatsCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { Users, PlayCircle, Zap, Activity } from 'lucide-vue-next'
import { formatTime, formatNumber } from '@/utils/format'
import { runStatusMap } from '@/constants/statusMaps'

const stats = ref<DashboardStats | null>(null)
const recentRuns = ref<RecentRun[]>([])
const loading = ref(true)
const error = ref('')

const tierColors: Record<string, string> = {
  free: '#9CA3AF',
  standard: '#3B82F6',
  premium: '#F59E0B'
}

const tierLabels: Record<string, string> = {
  free: '免费版',
  standard: '标准版',
  premium: '高级版'
}

const tierBarItems = computed(() => {
  if (!stats.value) return []
  const breakdown = stats.value.tier_breakdown
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return Object.entries(breakdown).map(([key, count]) => ({
    key,
    label: tierLabels[key] || key,
    count,
    percent: total > 0 ? Math.round((count / total) * 100) : 0,
    color: tierColors[key] || '#9CA3AF'
  }))
})

onMounted(async () => {
  try {
    const [statsData, runsData] = await Promise.all([
      getStatsApi(),
      getRecentRunsApi(10)
    ])
    stats.value = statsData
    recentRuns.value = runsData.runs
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
      <h1 class="page-title">仪表盘</h1>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <StatsCard
        label="总用户数"
        :value="stats ? formatNumber(stats.total_users) : '-'"
        :icon="Users"
        color="primary"
      />
      <StatsCard
        label="今日运行"
        :value="stats ? formatNumber(stats.runs_today) : '-'"
        :icon="Activity"
        color="success"
      />
      <StatsCard
        label="总SOP运行"
        :value="stats ? formatNumber(stats.total_runs) : '-'"
        :icon="PlayCircle"
        color="info"
      />
      <StatsCard
        label="Token消耗"
        :value="stats ? formatNumber(stats.total_tokens) : '-'"
        :icon="Zap"
        color="warning"
      />
    </div>

    <!-- Tier Breakdown -->
    <div class="card tier-section">
      <div class="card-body">
        <h2 class="section-title">用户等级分布</h2>
        <div class="tier-bar-container">
          <div class="tier-bar">
            <div
              v-for="item in tierBarItems"
              :key="item.key"
              class="tier-bar__segment"
              :style="{ width: item.percent + '%', background: item.color }"
              :title="`${item.label}: ${item.count} (${item.percent}%)`"
            />
          </div>
          <div class="tier-legend">
            <div v-for="item in tierBarItems" :key="item.key" class="tier-legend__item">
              <span class="tier-legend__dot" :style="{ background: item.color }" />
              <span class="tier-legend__label">{{ item.label }}</span>
              <span class="tier-legend__count">{{ item.count }}</span>
              <span class="tier-legend__percent">({{ item.percent }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Runs -->
    <div class="card recent-runs">
      <div class="card-body">
        <h2 class="section-title">最近运行</h2>
        <div class="runs-table-container">
          <table class="runs-table">
            <thead>
              <tr>
                <th>模板</th>
                <th>用户</th>
                <th>状态</th>
                <th>时间</th>
                <th class="align-right">Token</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="loading-cell">
                  <div class="spinner" style="margin: var(--space-6) auto;" />
                </td>
              </tr>
              <tr v-else-if="recentRuns.length === 0">
                <td colspan="5" class="empty-cell">暂无运行记录</td>
              </tr>
              <tr v-for="run in recentRuns" :key="run.id">
                <td class="text-medium">{{ run.template_name }}</td>
                <td>{{ run.user_nickname }}</td>
                <td>
                  <StatusBadge :status="run.status" :map="runStatusMap" />
                </td>
                <td class="text-muted">{{ formatTime(run.created_at) }}</td>
                <td class="align-right text-mono">{{ formatNumber(run.total_tokens) }}</td>
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
  grid-template-columns: repeat(4, 1fr);
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

.tier-section {
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-4);
}

.tier-bar-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.tier-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--gray-100);
}

.tier-bar__segment {
  transition: width var(--transition-slow);
  min-width: 2px;
}

.tier-bar__segment:first-child {
  border-radius: 6px 0 0 6px;
}

.tier-bar__segment:last-child {
  border-radius: 0 6px 6px 0;
}

.tier-legend {
  display: flex;
  gap: var(--space-6);
}

.tier-legend__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.tier-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tier-legend__label {
  color: var(--text);
  font-weight: 500;
}

.tier-legend__count {
  color: var(--text);
  font-weight: 600;
}

.tier-legend__percent {
  color: var(--text-secondary);
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

.text-medium {
  font-weight: 500;
}

.text-muted {
  color: var(--text-secondary);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.align-right {
  text-align: right;
}

.loading-cell,
.empty-cell {
  text-align: center;
  padding: var(--space-8) !important;
  color: var(--text-secondary);
}
</style>
