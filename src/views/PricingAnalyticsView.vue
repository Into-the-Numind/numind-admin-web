<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  getAnalyticsApi,
  type AnalyticsResponse,
  type AnalyticsBucket,
} from "@/api/billing";
import AppInput from "@/components/common/AppInput.vue";

const loading = ref(false);
const error = ref("");
const data = ref<AnalyticsResponse | null>(null);

// 日期范围：默认近 30 天
const toDate = new Date().toISOString().slice(0, 10);
const fromDate = new Date(Date.now() - 29 * 86400000)
  .toISOString()
  .slice(0, 10);
const from = ref(fromDate);
const to = ref(toDate);

async function fetchData() {
  loading.value = true;
  error.value = "";
  try {
    data.value = await getAnalyticsApi(from.value, to.value);
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);

// ====== 模拟器 ======
const simMonthlyFee = ref(49); // 元
const simTokenCapWan = ref(200); // 万 token
const simOveragePrice = ref(2.5); // 元 / 万 token

const simResult = computed(() => {
  if (!data.value) return null;
  const d = data.value;
  const days = d.summary.days_in_range || 30;
  const capTokens = simTokenCapWan.value * 10000;
  const overagePricePerToken = simOveragePrice.value / 10000;

  let totalRevenue = 0;
  let totalCost = 0;
  let withinCap = 0;

  for (const u of d.user_details) {
    // 将期间 token 归一化到 30 天
    const monthlyTokens = Math.round((u.period_tokens * 30) / days);
    const monthlyCostYuan = (u.period_cost_cents * 30) / days / 100;

    const overage = Math.max(0, monthlyTokens - capTokens);
    const userRevenue = simMonthlyFee.value + overage * overagePricePerToken;
    totalRevenue += userRevenue;
    totalCost += monthlyCostYuan;
    if (monthlyTokens <= capTokens) withinCap++;
  }

  const totalUsers = d.user_details.length || 1;
  const grossProfit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const withinCapPct = (withinCap / totalUsers) * 100;

  return {
    withinCapPct: withinCapPct.toFixed(1),
    totalRevenue: totalRevenue.toFixed(0),
    totalCost: totalCost.toFixed(0),
    grossProfit: grossProfit.toFixed(0),
    marginPct: marginPct.toFixed(1),
    marginPositive: grossProfit >= 0,
  };
});

// ====== 百分位数据（避免 v-for 遍历对象的类型问题）======
const runPercentiles = computed(() =>
  data.value
    ? [
        { label: "P50", val: data.value.summary.p50_tokens_per_run },
        { label: "P90", val: data.value.summary.p90_tokens_per_run },
        { label: "P95", val: data.value.summary.p95_tokens_per_run },
      ]
    : [],
);

const userCostPercentiles = computed(() =>
  data.value
    ? [
        { label: "P50 成本", val: data.value.summary.p50_cost_cents_per_user },
        { label: "P90 成本", val: data.value.summary.p90_cost_cents_per_user },
        { label: "P95 成本", val: data.value.summary.p95_cost_cents_per_user },
      ]
    : [],
);

// ====== 工具函数 ======
function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}

function histMaxCount(buckets: AnalyticsBucket[]): number {
  return Math.max(...buckets.map((b) => b.count), 1);
}

function formatBucketLabel(label: string): string {
  return label
    .replace("64001+", "64k+")
    .replace("1000001+", "1M+")
    .replace(/(\d+)/g, (n: string) =>
      parseInt(n) >= 1000 ? Math.round(parseInt(n) / 1000) + "k" : n,
    );
}
</script>

<template>
  <div class="page-container">
    <!-- 顶部栏 -->
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">Billing / Analytics</p>
        <h1 class="page-title">消费分析</h1>
        <p class="page-subtitle">
          分析用户 Token 消耗分布，用于制定订阅定价方案
        </p>
      </div>
      <div class="header-actions">
        <AppInput
          type="date"
          :model-value="from"
          @update:model-value="from = String($event)"
        />
        <span class="date-separator">&mdash;</span>
        <AppInput
          type="date"
          :model-value="to"
          @update:model-value="to = String($event)"
        />
        <button @click="fetchData" :disabled="loading" class="btn-primary">
          {{ loading ? "加载中..." : "查询" }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="error" class="error-alert">{{ error }}</div>

    <div v-else-if="data" class="content-area">
      <!-- 汇总卡片 -->
      <div class="stats-grid">
        <div class="card card-body">
          <div class="stat-label">有效用户数</div>
          <div class="stat-value">{{ data.summary.active_users }}</div>
          <div class="stat-hint">期间有运行记录</div>
        </div>
        <div class="card card-body">
          <div class="stat-label">总运行次数</div>
          <div class="stat-value">
            {{ data.summary.total_runs.toLocaleString() }}
          </div>
          <div class="stat-hint">
            人均
            {{
              data.summary.active_users > 0
                ? (data.summary.total_runs / data.summary.active_users).toFixed(
                    1,
                  )
                : 0
            }}
            次
          </div>
        </div>
        <div class="card card-body">
          <div class="stat-label">平均每次运行 Token</div>
          <div class="stat-value">
            {{ formatTokens(data.summary.avg_tokens_per_run) }}
          </div>
          <div class="stat-badge stat-badge--purple">
            P90 = {{ formatTokens(data.summary.p90_tokens_per_run) }}
          </div>
        </div>
        <div class="card card-body">
          <div class="stat-label">平均成本 / 用户（期间）</div>
          <div class="stat-value">
            ¥ {{ (data.summary.p50_cost_cents_per_user / 100).toFixed(2) }}
          </div>
          <div class="stat-badge stat-badge--warning">
            P90 = ¥{{ (data.summary.p90_cost_cents_per_user / 100).toFixed(2) }}
          </div>
        </div>
      </div>

      <!-- 两个直方图 -->
      <div class="chart-grid">
        <!-- 单次运行分布 -->
        <div class="card card-body">
          <h2 class="section-title">单次运行 Token 分布</h2>
          <p class="section-desc">每次 SOP 运行消耗的 token 总量</p>
          <!-- 百分位 -->
          <div class="percentile-grid">
            <div
              v-for="p in runPercentiles"
              :key="p.label"
              class="percentile-item percentile-item--purple"
            >
              <div class="percentile-label">{{ p.label }}</div>
              <div class="percentile-value percentile-value--purple">
                {{ formatTokens(p.val) }}
              </div>
            </div>
          </div>
          <!-- 柱状图 -->
          <div class="histogram">
            <div
              v-for="b in data.run_distribution"
              :key="b.bucket"
              class="histogram-bar"
            >
              <span class="histogram-count">{{ b.count }}</span>
              <div
                class="histogram-fill"
                :style="{
                  height: `${Math.max(4, (b.count / histMaxCount(data.run_distribution)) * 100)}%`,
                  background: 'var(--primary)',
                }"
              />
              <span class="histogram-label">{{
                formatBucketLabel(b.bucket)
              }}</span>
            </div>
          </div>
        </div>

        <!-- 用户月度分布 -->
        <div class="card card-body">
          <h2 class="section-title">用户期间 Token 分布</h2>
          <p class="section-desc">
            每个用户在所选时间范围内的总消耗（定价核心参考）
          </p>
          <div class="percentile-grid">
            <div
              v-for="p in userCostPercentiles"
              :key="p.label"
              class="percentile-item percentile-item--success"
            >
              <div class="percentile-label">{{ p.label }}</div>
              <div class="percentile-value percentile-value--success">
                ¥{{ (p.val / 100).toFixed(2) }}
              </div>
            </div>
          </div>
          <div class="histogram">
            <div
              v-for="b in data.user_distribution"
              :key="b.bucket"
              class="histogram-bar"
            >
              <span class="histogram-count">{{ b.count }}人</span>
              <div
                class="histogram-fill"
                :style="{
                  height: `${Math.max(4, (b.count / histMaxCount(data.user_distribution)) * 100)}%`,
                  background: 'var(--success)',
                }"
              />
              <span class="histogram-label">{{
                formatBucketLabel(b.bucket)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 模拟器 + 模型分布 -->
      <div class="chart-grid">
        <!-- 定价模拟器 -->
        <div class="card card-body">
          <h2 class="section-title">订阅定价模拟器</h2>
          <p class="section-desc">
            输入套餐参数，基于当前用户数据实时估算利润率
          </p>
          <div class="simulator-grid">
            <div class="simulator-inputs">
              <div class="form-group">
                <label class="form-label">月费（元）</label>
                <AppInput
                  type="number"
                  :model-value="simMonthlyFee"
                  @update:model-value="simMonthlyFee = Number($event)"
                />
              </div>
              <div class="form-group">
                <label class="form-label">包含 Token 上限（万）</label>
                <AppInput
                  type="number"
                  :model-value="simTokenCapWan"
                  @update:model-value="simTokenCapWan = Number($event)"
                />
                <p class="form-hint">
                  即 {{ (simTokenCapWan * 10000).toLocaleString() }} tokens / 月
                </p>
              </div>
              <div class="form-group">
                <label class="form-label">超出单价（元 / 万 token）</label>
                <AppInput
                  type="number"
                  step="0.1"
                  :model-value="simOveragePrice"
                  @update:model-value="simOveragePrice = Number($event)"
                />
              </div>
            </div>
            <div v-if="simResult" class="simulator-result">
              <div class="result-header">模拟结果</div>
              <div class="result-row">
                <span class="result-label">在限额内用户占比</span>
                <span class="result-value result-value--primary"
                  >{{ simResult.withinCapPct }}%</span
                >
              </div>
              <div class="result-row">
                <span class="result-label">预计月总收入</span>
                <span class="result-value"
                  >¥ {{ Number(simResult.totalRevenue).toLocaleString() }}</span
                >
              </div>
              <div class="result-row">
                <span class="result-label">预计月总成本</span>
                <span class="result-value"
                  >¥ {{ Number(simResult.totalCost).toLocaleString() }}</span
                >
              </div>
              <div class="result-row result-row--border">
                <span class="result-label">预计毛利润</span>
                <span
                  class="result-value"
                  :class="
                    simResult.marginPositive
                      ? 'result-value--success'
                      : 'result-value--danger'
                  "
                >
                  ¥ {{ Number(simResult.grossProfit).toLocaleString() }}
                </span>
              </div>
              <div class="margin-meter">
                <div class="margin-meter-header">
                  <span class="result-label">毛利率</span>
                  <span
                    class="result-value"
                    :class="
                      simResult.marginPositive
                        ? 'result-value--success'
                        : 'result-value--danger'
                    "
                  >
                    {{ simResult.marginPct }}%
                  </span>
                </div>
                <div class="progress-bg">
                  <div
                    class="progress-fill"
                    :style="{
                      width: `${Math.min(100, Math.max(0, Number(simResult.marginPct)))}%`,
                    }"
                    :class="
                      simResult.marginPositive
                        ? 'progress-fill--positive'
                        : 'progress-fill--negative'
                    "
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型分布 + 用户排行 -->
        <div class="card card-body">
          <h2 class="section-title">模型成本分布</h2>
          <div class="model-list">
            <div
              v-for="m in data.model_breakdown"
              :key="m.model"
              class="model-row"
            >
              <div class="model-name">{{ m.model || "未知" }}</div>
              <div class="model-bar-bg">
                <div
                  class="model-bar-fill"
                  :style="{ width: m.token_share_pct + '%' }"
                />
              </div>
              <div class="model-pct">{{ m.token_share_pct }}%</div>
              <div class="model-cost">
                ¥ {{ (m.period_cost_cents / 100).toFixed(0) }}
              </div>
            </div>
          </div>

          <h2 class="section-title section-title--mt">用户消费排行 Top 20</h2>
          <div class="table-container">
            <table class="runs-table">
              <thead>
                <tr>
                  <th class="align-left">用户</th>
                  <th class="align-right">运行次数</th>
                  <th class="align-right">Token</th>
                  <th class="align-right">成本</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in data.top_users" :key="u.user_id">
                  <td>{{ u.nickname || `用户${u.user_id}` }}</td>
                  <td class="align-right text-secondary">
                    {{ u.period_runs }}
                  </td>
                  <td class="align-right text-secondary">
                    {{ formatTokens(u.period_tokens) }}
                  </td>
                  <td
                    class="align-right"
                    :class="
                      u.period_cost_cents >
                      data!.summary.p90_cost_cents_per_user
                        ? 'text-warning text-medium'
                        : 'text-secondary'
                    "
                  >
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

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) 0;
  color: var(--text-secondary);
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

.stat-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.stat-badge {
  display: inline-block;
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border-radius: 999px;
  margin-top: var(--space-1);
}

.stat-badge--purple {
  color: var(--primary);
  background: var(--primary-light);
}

.stat-badge--warning {
  color: var(--warning);
  background: var(--warning-light);
}

/* Chart grid - 2 columns */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-1);
}

.section-title--mt {
  margin-top: var(--space-6);
}

.section-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

/* Percentile cards */
.percentile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.percentile-item {
  text-align: center;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-1);
}

.percentile-item--purple {
  background: var(--primary-light);
}

.percentile-item--success {
  background: var(--success-light);
}

.percentile-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.percentile-value {
  font-size: var(--text-lg);
  font-weight: 700;
}

.percentile-value--purple {
  color: var(--primary);
}

.percentile-value--success {
  color: var(--success);
}

/* Histogram */
.histogram {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  height: 7rem;
}

.histogram-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}

.histogram-count {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 500;
}

.histogram-fill {
  width: 100%;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: height var(--transition-base);
}

.histogram-label {
  font-size: 10px;
  color: var(--gray-400);
  text-align: center;
  line-height: 1.2;
}

/* Simulator */
.simulator-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
}

.simulator-inputs {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--surface);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.simulator-result {
  background: var(--primary-light);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.result-header {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

.result-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
}

.result-row--border {
  border-top: 1px solid var(--border);
  padding-top: var(--space-2);
}

.result-label {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.result-value {
  font-weight: 700;
  font-size: var(--text-sm);
}

.result-value--primary {
  color: var(--primary);
}

.result-value--success {
  color: var(--success);
}

.result-value--danger {
  color: var(--danger);
}

.margin-meter {
  margin-top: var(--space-3);
}

.margin-meter-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.progress-bg {
  background: var(--gray-200);
  border-radius: var(--radius-sm);
  height: 8px;
}

.progress-fill {
  height: 8px;
  border-radius: var(--radius-sm);
  transition: width var(--transition-base);
}

.progress-fill--positive {
  background: linear-gradient(to right, var(--primary), var(--primary-200));
}

.progress-fill--negative {
  background: var(--danger);
}

/* Model breakdown */
.model-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.model-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.model-name {
  font-size: var(--text-sm);
  font-weight: 500;
  width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-bar-bg {
  flex: 1;
  background: var(--gray-100);
  border-radius: var(--radius-sm);
  height: 6px;
}

.model-bar-fill {
  background: var(--primary);
  height: 6px;
  border-radius: var(--radius-sm);
}

.model-pct {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  width: 2.5rem;
  text-align: right;
}

.model-cost {
  font-size: var(--text-xs);
  color: var(--warning);
  width: 4rem;
  text-align: right;
}

/* Table */
.table-container {
  overflow-x: auto;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
}

.runs-table th {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
}

.runs-table td {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text);
  border-bottom: 1px solid var(--gray-50);
}

.runs-table tr:last-child td {
  border-bottom: none;
}

.align-left {
  text-align: left;
}
.align-right {
  text-align: right;
}
.text-secondary {
  color: var(--text-secondary);
}
.text-warning {
  color: var(--warning);
}
.text-medium {
  font-weight: 500;
}
</style>
