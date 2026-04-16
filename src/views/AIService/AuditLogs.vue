<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { listAuditLogsApi } from "@/api/ai";
import type { AuditLog } from "@/types/ai";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import { useToast } from "@/composables/useToast";
import { ChevronDown, ChevronRight } from "lucide-vue-next";

const toast = useToast();

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");

// Filters
const filterTargetType = ref("");
const filterDateFrom = ref("");
const filterDateTo = ref("");

// Expanded rows for diff_json
const expandedIds = ref<Set<number>>(new Set());

const targetTypeOptions = [
  { label: "全部类型", value: "" },
  { label: "AI 服务", value: "ai_service" },
  { label: "任务配置", value: "task_profile" },
  { label: "供应商", value: "provider" },
];

const columns: Column[] = [
  { key: "created_at", title: "时间", width: "160px" },
  { key: "actor", title: "操作人", width: "120px", align: "left" },
  { key: "action", title: "操作", width: "120px" },
  { key: "target", title: "目标", align: "left" },
  { key: "reason", title: "原因", align: "left" },
  { key: "expand", title: "", width: "40px" },
];

function formatTime(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    create: "创建",
    update: "更新",
    delete: "删除",
    restore: "恢复",
    bind: "绑定",
    force_override: "强制覆盖",
  };
  return map[action] ?? action;
}

function actionColor(action: string): string {
  if (action === "delete") return "danger";
  if (action === "create") return "success";
  if (action === "force_override") return "warning";
  return "info";
}

function getTargetLabel(log: AuditLog): string {
  const parts = [log.target_type, log.target_name ?? log.target_id].filter(
    Boolean,
  );
  return parts.join(" / ");
}

function hasDiff(log: AuditLog): boolean {
  return !!(log.diff && (log.diff.before || log.diff.after));
}

function toggleExpand(log: AuditLog) {
  if (!hasDiff(log)) return;
  const next = new Set(expandedIds.value);
  if (next.has(log.id)) {
    next.delete(log.id);
  } else {
    next.add(log.id);
  }
  expandedIds.value = next;
}

function formatDiff(diff: AuditLog["diff"]): string {
  if (!diff) return "";
  return JSON.stringify(diff, null, 2);
}

async function fetchLogs() {
  loading.value = true;
  error.value = "";
  try {
    const params: Parameters<typeof listAuditLogsApi>[0] = {
      page: page.value,
      page_size: pageSize,
    };
    if (filterTargetType.value) params.target_type = filterTargetType.value;
    if (filterDateFrom.value) params.date_from = filterDateFrom.value;
    if (filterDateTo.value) params.date_to = filterDateTo.value;

    const res = await listAuditLogsApi(params);
    logs.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = (e as Error).message || "加载审计日志失败";
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

function handleFilter() {
  page.value = 1;
  fetchLogs();
}

watch(page, fetchLogs);
onMounted(fetchLogs);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">AI Services / Audit Logs</p>
        <h1 class="page-title">AI 审计日志</h1>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <AppSelect
        v-model="filterTargetType"
        :options="targetTypeOptions"
        size="sm"
      />
      <div class="date-range">
        <input
          v-model="filterDateFrom"
          type="date"
          class="date-input"
          placeholder="开始日期"
        />
        <span class="date-sep">—</span>
        <input
          v-model="filterDateTo"
          type="date"
          class="date-input"
          placeholder="结束日期"
        />
      </div>
      <AppButton size="sm" variant="secondary" @click="handleFilter">
        筛选
      </AppButton>
    </div>

    <!-- Error state -->
    <div v-if="error && !loading" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="fetchLogs">
        重试
      </AppButton>
    </div>

    <DataTable
      :columns="columns"
      :data="logs"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      empty-text="暂无审计日志"
      @update:page="page = $event"
    >
      <template #cell-created_at="{ value }">
        <span class="text-mono text-muted">{{
          formatTime(String(value))
        }}</span>
      </template>

      <template #cell-action="{ value }">
        <span
          class="action-badge"
          :class="`action-badge--${actionColor(String(value))}`"
        >
          {{ formatAction(String(value)) }}
        </span>
      </template>

      <template #cell-target="{ row }">
        <span class="target-text">{{ getTargetLabel(row as AuditLog) }}</span>
      </template>

      <template #cell-reason="{ row }">
        <span class="reason-text">{{ (row as AuditLog).reason || "—" }}</span>
      </template>

      <template #cell-expand="{ row }">
        <button
          v-if="hasDiff(row as AuditLog)"
          class="expand-btn"
          :title="
            expandedIds.has((row as AuditLog).id) ? '收起' : '展开变更详情'
          "
          @click.stop="toggleExpand(row as AuditLog)"
        >
          <ChevronDown
            v-if="expandedIds.has((row as AuditLog).id)"
            :size="14"
          />
          <ChevronRight v-else :size="14" />
        </button>
      </template>

      <!-- Expanded diff row — injected after each log row via a wrapper trick -->
    </DataTable>

    <!-- Diff panels rendered outside DataTable for each expanded row -->
    <template v-if="logs.length > 0">
      <div
        v-for="log in logs.filter((l) => expandedIds.has(l.id))"
        :key="`diff-${log.id}`"
        class="diff-panel"
      >
        <div class="diff-panel__header">
          变更详情 · {{ log.target_name ?? log.target_id }} ·
          {{ formatTime(log.created_at) }}
        </div>
        <pre class="diff-pre">{{ formatDiff(log.diff) }}</pre>
      </div>
    </template>
  </div>
</template>

<style scoped>
.date-range {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.date-sep {
  color: var(--on-surface-variant);
  font-size: var(--text-sm);
}

.date-input {
  height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--on-surface);
  background: var(--surface-low);
  outline: none;
  transition: border-color var(--transition-fast);
}

.date-input:focus {
  border-color: var(--primary);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.text-muted {
  color: var(--on-surface-variant);
}

.action-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: 9999px;
}

.action-badge--success {
  background: var(--success-soft);
  color: var(--success);
}

.action-badge--danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.action-badge--warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.action-badge--info {
  background: var(--info-soft, var(--surface-low));
  color: var(--info, var(--primary));
}

.target-text {
  font-size: var(--text-sm);
  color: var(--on-surface);
}

.reason-text {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: none;
  background: transparent;
}

.expand-btn:hover {
  background: var(--surface-low);
  color: var(--on-surface);
}

.diff-panel {
  background: var(--surface-low);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--border);
}

.diff-panel__header {
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--surface-high);
  border-bottom: 1px solid var(--border);
}

.diff-pre {
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  line-height: 1.6;
  background: var(--surface-low);
  color: var(--on-surface);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
}
</style>
