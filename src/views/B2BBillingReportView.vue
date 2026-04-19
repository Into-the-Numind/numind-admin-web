<script setup lang="ts">
/**
 * B2BBillingReportView — B2B 月度结算报表（管理端，credits-system Q3 gap-fill）
 *
 * 只读页面，使用 GET /v1/admin/b2b-billing-report?month=YYYY-MM 汇总：
 *   - 本月所有父账户通过 POST /v1/users/children/:id/grant-membership 给子账户开通的会员
 *   - 每个父账户：grants_count / amount_cents / details[]
 *   - 总金额（所有父账户 amount_cents 之和）
 *
 * 页面结构：
 *   - 顶部：月份选择器（type="month"，默认当前月）+ 总金额大字
 *   - DataTable：父账户一行，展开看详情（子账户 / 产品类型 / 开通时间 / 金额）
 *
 * cents → 元 统一两位小数；granted_at 复用 @/utils/format 的 formatDate
 * （slice 到 YYYY-MM-DD HH:mm，和其他管理端页面保持一致）。
 */
import { ref, computed, onMounted } from "vue";
import {
  getB2BBillingReport,
  type B2BBillingReport,
  type ParentBillingRow,
} from "@/api/b2b_billing";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-vue-next";

const toast = useToast();

// ---- State ----
const report = ref<B2BBillingReport | null>(null);
const loading = ref(false);
const error = ref("");
// Expanded parent rows (by parent_user_id)
const expanded = ref<Set<number>>(new Set());

/**
 * 默认月份 = 当前月（YYYY-MM）。UTC 取当月并不必要——运营看的是国内自然月，
 * 直接用本地时区的 year/month，避免 toISOString 因为时区回退到上个月。
 */
function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const selectedMonth = ref<string>(currentMonth());

// ---- Derived ----
const rows = computed<ParentBillingRow[]>(() => report.value?.by_parent ?? []);
const totalAmountYuan = computed(() =>
  ((report.value?.total_amount_cents ?? 0) / 100).toFixed(2),
);
const totalGrants = computed(() =>
  rows.value.reduce((sum, r) => sum + r.grants_count, 0),
);

const columns: Column[] = [
  { key: "expand", title: "", width: "48px", align: "center" },
  { key: "parent_user_id", title: "父账户 ID", width: "100px", align: "right" },
  { key: "parent_username", title: "父账户用户名", align: "left" },
  { key: "grants_count", title: "开通数", width: "100px", align: "right" },
  { key: "amount_cents", title: "金额（元）", width: "140px", align: "right" },
];

// ---- Helpers ----
function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

function productTypeLabel(t: "trial" | "monthly"): string {
  return t === "trial" ? "体验" : "普通月付";
}

function detailMonthsLabel(d: {
  product_type: "trial" | "monthly";
  months: number | null;
}): string {
  if (d.product_type === "trial") return "3 天";
  return d.months != null ? `${d.months} 个月` : "-";
}

function toggleExpand(parentUserId: number) {
  const next = new Set(expanded.value);
  if (next.has(parentUserId)) {
    next.delete(parentUserId);
  } else {
    next.add(parentUserId);
  }
  expanded.value = next;
}

function isExpanded(parentUserId: number): boolean {
  return expanded.value.has(parentUserId);
}

// ---- Data flow ----
async function fetchReport() {
  if (!selectedMonth.value) return;
  loading.value = true;
  error.value = "";
  try {
    const res = (await getB2BBillingReport(
      selectedMonth.value,
    )) as unknown as B2BBillingReport;
    report.value = res;
    // Collapse all on reload so new month doesn't inherit stale expansion.
    expanded.value = new Set();
  } catch (e) {
    error.value = (e as Error).message || "加载结算报表失败";
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

function onMonthChange(event: Event) {
  const val = (event.target as HTMLInputElement).value;
  if (!val) return;
  selectedMonth.value = val;
  fetchReport();
}

onMounted(fetchReport);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">结算 / B2B 月度结算</p>
        <h1 class="page-title">B2B 月度结算报表</h1>
        <p class="page-subtitle">
          按月汇总所有 B 端父账户给子账户开通的会员明细，用于对公转账对账。
          数据来自 POST /v1/users/children/:id/grant-membership 的历史记录。
        </p>
      </div>
      <div class="page-actions">
        <AppButton
          variant="secondary"
          data-test="refresh"
          :loading="loading"
          @click="fetchReport"
        >
          <RefreshCw :size="14" />
          刷新
        </AppButton>
      </div>
    </div>

    <div class="summary-bar">
      <div class="month-picker-field">
        <label class="summary-label" for="b2b-month-picker">结算月份</label>
        <input
          id="b2b-month-picker"
          type="month"
          class="month-picker"
          data-test="month-picker"
          :value="selectedMonth"
          @change="onMonthChange"
        />
      </div>
      <div class="summary-totals">
        <div class="summary-cell">
          <span class="summary-label">开通总数</span>
          <span class="summary-value">{{ totalGrants }}</span>
        </div>
        <div class="summary-cell summary-cell--primary">
          <span class="summary-label">本月应收总额</span>
          <span class="summary-value summary-value--hero" data-test="total-yuan"
            >¥ {{ totalAmountYuan }}</span
          >
        </div>
      </div>
    </div>

    <div v-if="error" class="error-alert" data-test="error-alert">
      {{ error }}
    </div>

    <DataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :total="rows.length"
      :page-size="rows.length || 1"
      :page="1"
      row-key="parent_user_id"
      empty-text="暂无本月结算记录"
    >
      <template #cell-expand="{ row }">
        <button
          type="button"
          class="expand-btn"
          :data-test="`row-expand-${(row as ParentBillingRow).parent_user_id}`"
          :aria-expanded="isExpanded((row as ParentBillingRow).parent_user_id)"
          :aria-label="
            isExpanded((row as ParentBillingRow).parent_user_id)
              ? '收起详情'
              : '展开详情'
          "
          @click.stop="toggleExpand((row as ParentBillingRow).parent_user_id)"
        >
          <ChevronDown
            v-if="isExpanded((row as ParentBillingRow).parent_user_id)"
            :size="16"
          />
          <ChevronRight v-else :size="16" />
        </button>
      </template>

      <template #cell-parent_username="{ row }">
        <div class="parent-cell">
          <span class="parent-name">{{
            (row as ParentBillingRow).parent_username
          }}</span>
          <div
            v-if="isExpanded((row as ParentBillingRow).parent_user_id)"
            class="details-panel"
            :data-test="`details-${(row as ParentBillingRow).parent_user_id}`"
          >
            <table class="inner-table">
              <thead>
                <tr>
                  <th>子账户</th>
                  <th>产品</th>
                  <th>时长</th>
                  <th class="align-right">金额（元）</th>
                  <th>开通时间</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(d, i) in (row as ParentBillingRow).details"
                  :key="`${(row as ParentBillingRow).parent_user_id}-${i}`"
                >
                  <td>{{ d.child_username }}</td>
                  <td>{{ productTypeLabel(d.product_type) }}</td>
                  <td>{{ detailMonthsLabel(d) }}</td>
                  <td class="align-right">{{ centsToYuan(d.cents) }}</td>
                  <td class="text-muted">{{ formatDate(d.granted_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <template #cell-amount_cents="{ row }">
        <strong>{{
          centsToYuan((row as ParentBillingRow).amount_cents)
        }}</strong>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.summary-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-5);
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(169, 180, 185, 0.05);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.month-picker-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 200px;
}

.month-picker {
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid rgba(169, 180, 185, 0.15);
  border-radius: var(--radius-sm);
  background: var(--surface-low);
  color: var(--on-surface);
  font-size: var(--text-sm);
  font-family: var(--font-body);
  outline: none;
  transition: border-color var(--transition-fast);
}

.month-picker:focus {
  border-color: var(--primary);
}

.summary-totals {
  display: flex;
  gap: var(--space-5);
  align-items: flex-end;
  flex-wrap: wrap;
}

.summary-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
}

.summary-cell--primary {
  border-left: 2px solid var(--primary);
}

.summary-label {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  color: var(--on-surface);
  font-weight: 700;
}

.summary-value--hero {
  font-size: var(--text-2xl, 28px);
  color: var(--primary);
}

.page-actions {
  display: flex;
  gap: var(--space-2);
}

.error-alert {
  padding: var(--space-3) var(--space-4);
  background: var(--danger-soft, rgba(220, 53, 69, 0.08));
  color: var(--danger);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
}

.expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--on-surface-variant);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.expand-btn:hover {
  background: var(--surface-high);
  color: var(--on-surface);
}

.parent-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.parent-name {
  font-weight: 600;
}

.details-panel {
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-low);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(169, 180, 185, 0.08);
}

.inner-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.inner-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--outline-variant);
  color: var(--on-surface-variant);
  font-family: var(--font-label);
  font-weight: 700;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inner-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--outline-variant);
  color: var(--on-surface);
}

.inner-table tr:last-child td {
  border-bottom: none;
}

.align-right {
  text-align: right;
}

.text-muted {
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
}
</style>
