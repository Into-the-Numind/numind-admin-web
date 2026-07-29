<script setup lang="ts">
/**
 * B2BBillingReportView — B2B 月度结算报表（管理端，credits-system Q3 gap-fill）
 *
 * GET /v1/admin/b2b-billing-report?month=YYYY-MM
 * 按 by_parent 分组，可点击展开 details 明细。
 * summary 字段直接读取服务端顶层字段（不在客户端重聚合）。
 *
 * Plan §Task 21 / Spec §8.4
 */
import { ref, computed, onMounted } from "vue";
import {
  getB2BBillingReport,
  type B2BBillingReport,
  type ParentBillingRow,
  type GrantDetail,
} from "@/api/b2b_billing";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import { useToast } from "@/composables/useToast";
import { formatDateTime, centsToYuan } from "@/utils/datetime";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
} from "lucide-vue-next";

const toast = useToast();

// ── State ─────────────────────────────────────────────────────────────────────
const report = ref<B2BBillingReport | null>(null);
const loading = ref(false);
const error = ref("");
const expanded = ref<Set<number>>(new Set());

/** Default month = current month in local timezone (YYYY-MM). */
function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const selectedMonth = ref<string>(currentMonth());

// ── Event type mapping ──────────────────────────────────────────────────────
// Backend GrantDetail carries no event_type, so the report cannot distinguish
// 开通 (sub_granted) from 续费 (sub_renewed). The old `months > 1` heuristic was
// wrong both ways — it mislabelled 12-month annual grants (an opening) as "续费"
// and would mislabel a 1-month renewal as "开通". Every parent-side settlement row
// is treated as an "开通"; the grant duration is shown separately via durationLabel.
function eventTypeLabel(d: GrantDetail): string {
  if (d.product_type === "trial") return "开通体验";
  if (d.product_type === "weekly") return "开通周度";
  if (d.product_type === "monthly") return "开通 Pro";
  // Fallback for booster (currently not returned by backend, but keep for future use)
  return "购买加量包";
}

// ── Derived ───────────────────────────────────────────────────────────────────
const rows = computed<ParentBillingRow[]>(() => report.value?.by_parent ?? []);

const columns: Column[] = [
  { key: "expand", title: "", width: "48px", align: "center" },
  { key: "parent_user_id", title: "父账户 ID", width: "100px", align: "right" },
  { key: "parent_username", title: "父账户用户名", align: "left" },
  { key: "grants_count", title: "事件数", width: "90px", align: "right" },
  { key: "amount_cents", title: "金额（元）", width: "150px", align: "right" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function productLabel(d: GrantDetail): string {
  if (d.product_type === "trial") return "体验包";
  if (d.product_type === "weekly") return "周度会员";
  return "Pro 订阅";
}

function durationLabel(d: GrantDetail): string {
  if (d.product_type === "trial") return "3 天";
  if (d.product_type === "weekly") return "7 天";
  return `${d.months} 个月`;
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

// ── Data flow ─────────────────────────────────────────────────────────────────
async function fetchReport() {
  if (!selectedMonth.value) return;
  loading.value = true;
  error.value = "";
  try {
    const res = (await getB2BBillingReport(
      selectedMonth.value,
    )) as unknown as B2BBillingReport;
    report.value = res;
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

// ── CSV Export ────────────────────────────────────────────────────────────────
function escapeCsvCell(val: string | number | undefined | null): string {
  const s = String(val ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCSV() {
  if (!report.value) return;
  const r = report.value;

  const headers = [
    "日期",
    "父账户",
    "子账户",
    "事件类型",
    "产品",
    "时长/数量",
    "金额(元)",
  ];

  const dataRows = r.by_parent.flatMap((p) =>
    p.details.map((d) => [
      formatDateTime(d.granted_at),
      p.parent_username,
      d.child_username,
      eventTypeLabel(d),
      productLabel(d),
      durationLabel(d),
      (d.amount_cents / 100).toFixed(2),
    ]),
  );

  const csvLines = [headers, ...dataRows].map((row) =>
    row.map(escapeCsvCell).join(","),
  );
  const csvStr = csvLines.join("\n");

  // UTF-8 BOM for Excel compatibility
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, csvStr], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `b2b-billing-${r.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">结算 / B2B 月度结算</p>
        <h1 class="page-title">B2B 月度结算报表</h1>
        <p class="page-subtitle">
          按月汇总所有 B 端父账户给子账户开通的会员明细，用于对公转账对账。
        </p>
      </div>
      <div class="page-actions">
        <AppButton
          variant="secondary"
          data-test="export-csv"
          :disabled="!report || rows.length === 0"
          @click="exportCSV"
        >
          <Download :size="14" />
          导出 CSV
        </AppButton>
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

    <!-- Summary bar -->
    <div class="summary-bar" data-test="summary-bar">
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
          <span class="summary-label">活跃父账户</span>
          <span class="summary-value" data-test="active-parents">{{
            report?.active_parents_count ?? 0
          }}</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">事件总数</span>
          <span class="summary-value" data-test="total-events">{{
            report?.total_events_count ?? 0
          }}</span>
        </div>
        <div class="summary-cell summary-cell--primary">
          <span class="summary-label">本月应收总额</span>
          <span class="summary-value summary-value--hero" data-test="total-yuan"
            >¥ {{ centsToYuan(report?.total_amount_cents ?? 0) }}</span
          >
        </div>
      </div>
    </div>

    <!-- Error alert -->
    <div v-if="error" class="error-alert" data-test="error-alert">
      {{ error }}
      <button type="button" class="retry-btn" @click="fetchReport">重试</button>
    </div>

    <!-- Main DataTable: grouped by parent -->
    <DataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :total="rows.length"
      :page-size="rows.length || 1"
      :page="1"
      row-key="parent_user_id"
      empty-text="暂无本月结算记录"
      data-test="billing-table"
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
          <!-- Expanded detail panel -->
          <div
            v-if="isExpanded((row as ParentBillingRow).parent_user_id)"
            class="details-panel"
            :data-test="`details-${(row as ParentBillingRow).parent_user_id}`"
          >
            <table class="inner-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>子账户</th>
                  <th>事件类型</th>
                  <th>产品</th>
                  <th>时长/数量</th>
                  <th class="align-right">金额（元）</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(d, i) in (row as ParentBillingRow).details"
                  :key="`${(row as ParentBillingRow).parent_user_id}-${i}`"
                >
                  <td class="text-muted">
                    {{ formatDateTime(d.granted_at) }}
                  </td>
                  <td>{{ d.child_username }}</td>
                  <td>
                    <span class="event-badge">{{ eventTypeLabel(d) }}</span>
                  </td>
                  <td>{{ productLabel(d) }}</td>
                  <td>{{ durationLabel(d) }}</td>
                  <td class="align-right">{{ centsToYuan(d.amount_cents) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <template #cell-grants_count="{ row }">
        {{ (row as ParentBillingRow).grants_count }}
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
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-soft, rgba(220, 53, 69, 0.08));
  color: var(--danger);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
}

.retry-btn {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--danger);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.retry-btn:hover {
  background: var(--danger-soft, rgba(220, 53, 69, 0.12));
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

.event-badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--surface-high);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--on-surface-variant);
}
</style>
