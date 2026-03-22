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
  <div class="min-h-screen bg-gray-50">
    <!-- Top bar -->
    <div class="bg-white border-b px-8 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-base font-semibold">客户升级记录</h1>
        <p class="text-sm text-gray-500">查看直客 (B2) 对终端用户 (B3) 的等级变更记录，用于月度营收核算</p>
      </div>
      <div class="flex items-center gap-3">
        <input type="date" v-model="from" class="border rounded px-3 py-1.5 text-sm" />
        <span class="text-gray-400">&mdash;</span>
        <input type="date" v-model="to" class="border rounded px-3 py-1.5 text-sm" />
        <button @click="handleQuery" :disabled="loading"
          class="bg-purple-600 text-white px-4 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
          {{ loading ? '加载中...' : '查询' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="mx-8 mt-6 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{{ error }}</div>

    <div class="p-8 space-y-6">
      <!-- Stats cards -->
      <div v-if="stats" class="grid grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">总变更次数</div>
          <div class="text-2xl font-bold">{{ stats.total_changes }}</div>
        </div>
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">升级次数</div>
          <div class="text-2xl font-bold text-green-600">{{ stats.upgrades }}</div>
        </div>
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">降级次数</div>
          <div class="text-2xl font-bold text-orange-500">{{ stats.downgrades }}</div>
        </div>
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">各等级分布</div>
          <div class="space-y-1">
            <div v-for="b in stats.tier_breakdown" :key="b.new_tier" class="flex items-center justify-between text-sm">
              <span class="text-gray-600">{{ tierBreakdownLabel(b.new_tier) }}</span>
              <span class="font-medium">{{ b.count }}次 / {{ b.total_months }}月</span>
            </div>
            <div v-if="stats.tier_breakdown.length === 0" class="text-sm text-gray-400">暂无数据</div>
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
          <span class="text-sm text-gray-500">{{ formatDateTime((row as TierChangeLogItem).created_at) }}</span>
        </template>

        <template #cell-old_tier="{ row }">
          <StatusBadge :status="(row as TierChangeLogItem).old_tier" :map="tierLabels" />
        </template>

        <template #cell-new_tier="{ row }">
          <div class="inline-flex items-center gap-1.5">
            <StatusBadge :status="(row as TierChangeLogItem).new_tier" :map="tierLabels" />
            <span v-if="isUpgrade((row as TierChangeLogItem).old_tier, (row as TierChangeLogItem).new_tier)"
              class="text-xs text-green-500 font-medium">&uarr;</span>
            <span v-else class="text-xs text-orange-500 font-medium">&darr;</span>
          </div>
        </template>

        <template #cell-months="{ row }">
          <span class="text-sm">{{ (row as TierChangeLogItem).months }}个月</span>
        </template>

        <template #cell-new_tier_expires="{ row }">
          <span class="text-sm text-gray-500">{{ formatDateTime((row as TierChangeLogItem).new_tier_expires) }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>
