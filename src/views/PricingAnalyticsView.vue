<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAnalyticsApi, type AnalyticsResponse, type AnalyticsBucket } from '@/api/billing'

const loading = ref(false)
const error = ref('')
const data = ref<AnalyticsResponse | null>(null)

// 日期范围：默认近 30 天
const toDate = new Date().toISOString().slice(0, 10)
const fromDate = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
const from = ref(fromDate)
const to = ref(toDate)

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    data.value = await getAnalyticsApi(from.value, to.value)
  } catch (e) {
    error.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

// ====== 模拟器 ======
const simMonthlyFee = ref(49)        // 元
const simTokenCapWan = ref(200)      // 万 token
const simOveragePrice = ref(2.5)     // 元 / 万 token

const simResult = computed(() => {
  if (!data.value) return null
  const d = data.value
  const days = d.summary.days_in_range || 30
  const capTokens = simTokenCapWan.value * 10000
  const overagePricePerToken = simOveragePrice.value / 10000

  let totalRevenue = 0
  let totalCost = 0
  let withinCap = 0

  for (const u of d.user_details) {
    // 将期间 token 归一化到 30 天
    const monthlyTokens = Math.round(u.period_tokens * 30 / days)
    const monthlyCostYuan = (u.period_cost_cents * 30 / days) / 100

    const overage = Math.max(0, monthlyTokens - capTokens)
    const userRevenue = simMonthlyFee.value + overage * overagePricePerToken
    totalRevenue += userRevenue
    totalCost += monthlyCostYuan
    if (monthlyTokens <= capTokens) withinCap++
  }

  const totalUsers = d.user_details.length || 1
  const grossProfit = totalRevenue - totalCost
  const marginPct = totalRevenue > 0 ? grossProfit / totalRevenue * 100 : 0
  const withinCapPct = withinCap / totalUsers * 100

  return {
    withinCapPct: withinCapPct.toFixed(1),
    totalRevenue: totalRevenue.toFixed(0),
    totalCost: totalCost.toFixed(0),
    grossProfit: grossProfit.toFixed(0),
    marginPct: marginPct.toFixed(1),
    marginPositive: grossProfit >= 0
  }
})

// ====== 百分位数据（避免 v-for 遍历对象的类型问题）======
const runPercentiles = computed(() => data.value ? [
  { label: 'P50', val: data.value.summary.p50_tokens_per_run },
  { label: 'P90', val: data.value.summary.p90_tokens_per_run },
  { label: 'P95', val: data.value.summary.p95_tokens_per_run },
] : [])

const userCostPercentiles = computed(() => data.value ? [
  { label: 'P50 成本', val: data.value.summary.p50_cost_cents_per_user },
  { label: 'P90 成本', val: data.value.summary.p90_cost_cents_per_user },
  { label: 'P95 成本', val: data.value.summary.p95_cost_cents_per_user },
] : [])

// ====== 工具函数 ======
function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k'
  return String(n)
}

function histMaxCount(buckets: AnalyticsBucket[]): number {
  return Math.max(...buckets.map(b => b.count), 1)
}

function formatBucketLabel(label: string): string {
  return label
    .replace('64001+', '64k+')
    .replace('1000001+', '1M+')
    .replace(/(\d+)/g, (n: string) => parseInt(n) >= 1000 ? Math.round(parseInt(n) / 1000) + 'k' : n)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 顶部栏 -->
    <div class="bg-white border-b px-8 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-base font-semibold">消费分析</h1>
        <p class="text-sm text-gray-500">分析用户 Token 消耗分布，用于制定订阅定价方案</p>
      </div>
      <div class="flex items-center gap-3">
        <input type="date" v-model="from" class="border rounded px-3 py-1.5 text-sm" />
        <span class="text-gray-400">—</span>
        <input type="date" v-model="to" class="border rounded px-3 py-1.5 text-sm" />
        <button @click="fetchData" :disabled="loading"
          class="bg-purple-600 text-white px-4 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
          {{ loading ? '加载中...' : '查询' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-32 text-gray-400">加载中...</div>
    <div v-else-if="error" class="flex items-center justify-center py-32 text-red-400">{{ error }}</div>

    <div v-else-if="data" class="p-8 space-y-6">
      <!-- 汇总卡片 -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">有效用户数</div>
          <div class="text-2xl font-bold">{{ data.summary.active_users }}</div>
          <div class="text-xs text-gray-400 mt-1">期间有运行记录</div>
        </div>
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">总运行次数</div>
          <div class="text-2xl font-bold">{{ data.summary.total_runs.toLocaleString() }}</div>
          <div class="text-xs text-gray-400 mt-1">人均 {{ data.summary.active_users > 0 ? (data.summary.total_runs / data.summary.active_users).toFixed(1) : 0 }} 次</div>
        </div>
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">平均每次运行 Token</div>
          <div class="text-2xl font-bold">{{ formatTokens(data.summary.avg_tokens_per_run) }}</div>
          <div class="text-xs text-purple-500 mt-1 bg-purple-50 inline-block px-2 py-0.5 rounded-full">P90 = {{ formatTokens(data.summary.p90_tokens_per_run) }}</div>
        </div>
        <div class="bg-white rounded-xl border p-5">
          <div class="text-xs text-gray-400 mb-2">平均成本 / 用户（期间）</div>
          <div class="text-2xl font-bold">¥ {{ (data.summary.p50_cost_cents_per_user / 100).toFixed(2) }}</div>
          <div class="text-xs text-orange-500 mt-1 bg-orange-50 inline-block px-2 py-0.5 rounded-full">P90 = ¥{{ (data.summary.p90_cost_cents_per_user / 100).toFixed(2) }}</div>
        </div>
      </div>

      <!-- 两个直方图 -->
      <div class="grid grid-cols-2 gap-6">
        <!-- 单次运行分布 -->
        <div class="bg-white rounded-xl border p-6">
          <h2 class="font-semibold text-sm mb-1">单次运行 Token 分布</h2>
          <p class="text-xs text-gray-400 mb-4">每次 SOP 运行消耗的 token 总量</p>
          <!-- 百分位 -->
          <div class="grid grid-cols-3 gap-3 mb-5">
            <div v-for="p in runPercentiles" :key="p.label"
              class="text-center bg-purple-50 rounded-lg py-2 px-1">
              <div class="text-xs text-gray-400">{{ p.label }}</div>
              <div class="text-lg font-bold text-purple-600">{{ formatTokens(p.val) }}</div>
            </div>
          </div>
          <!-- 柱状图 -->
          <div class="flex items-end gap-2 h-28">
            <div v-for="b in data.run_distribution" :key="b.bucket"
              class="flex-1 flex flex-col items-center justify-end gap-1">
              <span class="text-xs text-gray-500 font-medium">{{ b.count }}</span>
              <div class="w-full rounded-t"
                :style="{ height: `${Math.max(4, b.count / histMaxCount(data.run_distribution) * 100)}%`, background: '#7c3aed' }" />
              <span class="text-[10px] text-gray-400 text-center leading-tight">{{ formatBucketLabel(b.bucket) }}</span>
            </div>
          </div>
        </div>

        <!-- 用户月度分布 -->
        <div class="bg-white rounded-xl border p-6">
          <h2 class="font-semibold text-sm mb-1">用户期间 Token 分布</h2>
          <p class="text-xs text-gray-400 mb-4">每个用户在所选时间范围内的总消耗（定价核心参考）</p>
          <div class="grid grid-cols-3 gap-3 mb-5">
            <div v-for="p in userCostPercentiles" :key="p.label"
              class="text-center bg-green-50 rounded-lg py-2 px-1">
              <div class="text-xs text-gray-400">{{ p.label }}</div>
              <div class="text-lg font-bold text-green-600">¥{{ (p.val / 100).toFixed(2) }}</div>
            </div>
          </div>
          <div class="flex items-end gap-2 h-28">
            <div v-for="b in data.user_distribution" :key="b.bucket"
              class="flex-1 flex flex-col items-center justify-end gap-1">
              <span class="text-xs text-gray-500 font-medium">{{ b.count }}人</span>
              <div class="w-full rounded-t"
                :style="{ height: `${Math.max(4, b.count / histMaxCount(data.user_distribution) * 100)}%`, background: '#16a34a' }" />
              <span class="text-[10px] text-gray-400 text-center leading-tight">{{ formatBucketLabel(b.bucket) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 模拟器 + 模型分布 -->
      <div class="grid grid-cols-2 gap-6">
        <!-- 定价模拟器 -->
        <div class="bg-white rounded-xl border p-6">
          <h2 class="font-semibold text-sm mb-1">订阅定价模拟器</h2>
          <p class="text-xs text-gray-400 mb-5">输入套餐参数，基于当前用户数据实时估算利润率</p>
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">月费（元）</label>
                <input type="number" v-model.number="simMonthlyFee" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:outline-none" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">包含 Token 上限（万）</label>
                <input type="number" v-model.number="simTokenCapWan" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:outline-none" />
                <p class="text-xs text-gray-400 mt-1">即 {{ (simTokenCapWan * 10000).toLocaleString() }} tokens / 月</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">超出单价（元 / 万 token）</label>
                <input type="number" step="0.1" v-model.number="simOveragePrice" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-300 focus:outline-none" />
              </div>
            </div>
            <div v-if="simResult" class="bg-purple-50 rounded-xl p-4 space-y-2.5">
              <div class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-3">模拟结果</div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">在限额内用户占比</span>
                <span class="font-bold text-purple-600">{{ simResult.withinCapPct }}%</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">预计月总收入</span>
                <span class="font-bold">¥ {{ Number(simResult.totalRevenue).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">预计月总成本</span>
                <span class="font-bold">¥ {{ Number(simResult.totalCost).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm border-t pt-2">
                <span class="text-gray-500">预计毛利润</span>
                <span class="font-bold" :class="simResult.marginPositive ? 'text-green-600' : 'text-red-500'">
                  ¥ {{ Number(simResult.grossProfit).toLocaleString() }}
                </span>
              </div>
              <div class="mt-3">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                  <span>毛利率</span>
                  <span class="font-bold" :class="simResult.marginPositive ? 'text-green-600' : 'text-red-500'">
                    {{ simResult.marginPct }}%
                  </span>
                </div>
                <div class="bg-gray-200 rounded h-2">
                  <div class="h-2 rounded transition-all"
                    :style="{ width: `${Math.min(100, Math.max(0, Number(simResult.marginPct)))}%` }"
                    :class="simResult.marginPositive ? 'bg-gradient-to-r from-purple-500 to-purple-300' : 'bg-red-400'" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型分布 + 用户排行 -->
        <div class="bg-white rounded-xl border p-6">
          <h2 class="font-semibold text-sm mb-4">模型成本分布</h2>
          <div class="space-y-3 mb-6">
            <div v-for="m in data.model_breakdown" :key="m.model" class="flex items-center gap-3">
              <div class="text-sm font-medium w-36 truncate">{{ m.model || '未知' }}</div>
              <div class="flex-1 bg-gray-100 rounded h-1.5">
                <div class="bg-purple-500 h-1.5 rounded" :style="{ width: m.token_share_pct + '%' }" />
              </div>
              <div class="text-xs text-gray-500 w-10 text-right">{{ m.token_share_pct }}%</div>
              <div class="text-xs text-orange-500 w-16 text-right">¥ {{ (m.period_cost_cents / 100).toFixed(0) }}</div>
            </div>
          </div>

          <h2 class="font-semibold text-sm mb-3">用户消费排行 Top 20</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-gray-400">
                  <th class="text-left pb-2">用户</th>
                  <th class="text-right pb-2">运行次数</th>
                  <th class="text-right pb-2">Token</th>
                  <th class="text-right pb-2">成本</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in data.top_users" :key="u.user_id" class="border-t border-gray-50">
                  <td class="py-1.5 text-gray-700">{{ u.nickname || `用户${u.user_id}` }}</td>
                  <td class="py-1.5 text-right text-gray-500">{{ u.period_runs }}</td>
                  <td class="py-1.5 text-right text-gray-500">{{ formatTokens(u.period_tokens) }}</td>
                  <td class="py-1.5 text-right"
                    :class="u.period_cost_cents > data!.summary.p90_cost_cents_per_user ? 'text-orange-500 font-medium' : 'text-gray-500'">
                    ¥{{ (u.period_cost_cents / 100).toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
