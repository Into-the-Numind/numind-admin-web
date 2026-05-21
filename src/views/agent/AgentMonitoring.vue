<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { RefreshCw } from "lucide-vue-next";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { listAgentRunsApi, cancelAgentRunApi } from "@/api/agent";
import { useToast } from "@/composables/useToast";
import type { AgentRunDTO } from "@/types/agent";

// M-C2: Langfuse base URL from env
const LANGFUSE_URL = (import.meta.env.VITE_LANGFUSE_URL as string) || "";

const toast = useToast();

// --- Data state ---
const runs = ref<AgentRunDTO[]>([]);
const total = ref(0);
const loading = ref(false);
const errorMsg = ref("");

// --- ConfirmModal state (M-C3c) ---
const confirmVisible = ref(false);
const pendingRun = ref<AgentRunDTO | null>(null);
const cancelling = ref(false);

// --- Columns ---
const columns: Column[] = [
  { key: "id", title: "Run ID", width: "80px" },
  { key: "user_id", title: "用户 ID", width: "80px" },
  { key: "agent_name", title: "Agent", width: "180px" },
  { key: "status", title: "状态", width: "100px" },
  { key: "created_at", title: "开始时间", width: "160px" },
  { key: "trace_id", title: "Trace", width: "120px" },
  { key: "actions", title: "操作", width: "120px" },
];

// --- Fetch (M-C4b) ---
async function fetchRunningRuns() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const res = await listAgentRunsApi({
      status: "running",
      page: 1,
      page_size: 50,
    });
    runs.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    errorMsg.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

// M-C2: build Langfuse trace URL
function langfuseTraceURL(traceId?: string): string {
  if (!LANGFUSE_URL || !traceId) return "";
  return `${LANGFUSE_URL}/trace/${traceId}`;
}

// M-C3c: open confirm dialog
function requestCancel(run: AgentRunDTO) {
  pendingRun.value = run;
  confirmVisible.value = true;
}

// M-C3c: execute cancel after modal confirm
async function executeCancel() {
  if (!pendingRun.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await cancelAgentRunApi(pendingRun.value.id);
    toast.success(`Agent Run #${pendingRun.value.id} 已发送取消请求`);
    confirmVisible.value = false;
    pendingRun.value = null;
    // Optimistic refresh
    await fetchRunningRuns();
  } catch (e) {
    toast.error(`取消失败: ${(e as Error).message}`);
  } finally {
    cancelling.value = false;
  }
}

function handleModalCancel() {
  confirmVisible.value = false;
  pendingRun.value = null;
}

// M-C4b: 30s polling with plain setInterval (no @vueuse/core)
let pollingTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchRunningRuns();
  pollingTimer = setInterval(fetchRunningRuns, 30_000);
});

onUnmounted(() => {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
});
</script>

<template>
  <!-- M-C5: NoticeBanner "v1 不联机" REMOVED — page is now fully wired -->

  <div class="agent-monitoring">
    <header class="page-header">
      <div>
        <h1 class="page-title">Agent 监控</h1>
        <p class="page-subtitle">
          实时查看运行中的 Agent 会话（每 30 秒自动刷新）
        </p>
      </div>
      <button class="refresh-btn" :disabled="loading" @click="fetchRunningRuns">
        <RefreshCw :size="14" :class="{ spinning: loading }" />
        刷新
      </button>
    </header>

    <!-- Error state -->
    <div v-if="errorMsg" class="error-alert">
      {{ errorMsg }}
      <button class="retry-btn" @click="fetchRunningRuns">重试</button>
    </div>

    <!-- DataTable — handles loading skeleton + empty state internally -->
    <DataTable
      :columns="columns"
      :data="runs"
      :loading="loading"
      :total="total"
      empty-text="当前无运行中的 Agent 会话"
    >
      <!-- M-C2: Langfuse trace link in id column -->
      <template #cell-id="{ row }">
        <a
          v-if="langfuseTraceURL(row.trace_id)"
          :href="langfuseTraceURL(row.trace_id)"
          target="_blank"
          rel="noopener noreferrer"
          class="trace-link"
        >
          {{ row.id }} ↗
        </a>
        <span v-else>{{ row.id }}</span>
      </template>

      <!-- agent_name fallback -->
      <template #cell-agent_name="{ row }">
        {{ row.agent_name || `Agent #${row.agent_definition_id}` }}
      </template>

      <!-- status badge -->
      <template #cell-status="{ row }">
        <span class="status-badge" :class="`status-badge--${row.status}`">
          {{ row.status }}
        </span>
      </template>

      <!-- formatted timestamp -->
      <template #cell-created_at="{ row }">
        {{
          row.created_at
            ? new Date(row.created_at).toLocaleString("zh-CN")
            : "-"
        }}
      </template>

      <!-- M-C2: trace_id column — separate short display -->
      <template #cell-trace_id="{ row }">
        <a
          v-if="langfuseTraceURL(row.trace_id)"
          :href="langfuseTraceURL(row.trace_id)"
          target="_blank"
          rel="noopener noreferrer"
          class="trace-link trace-link--mono"
          :title="row.trace_id"
        >
          {{ row.trace_id?.slice(0, 8) }}…
        </a>
        <span v-else class="muted">—</span>
      </template>

      <!-- M-C3c: force-cancel action button -->
      <template #cell-actions="{ row }">
        <button
          v-if="row.status === 'running'"
          class="btn-danger-sm"
          @click="requestCancel(row)"
        >
          强制取消
        </button>
        <span v-else class="muted">—</span>
      </template>
    </DataTable>

    <!-- M-C3c: ConfirmModal for destructive cancel -->
    <ConfirmModal
      :visible="confirmVisible"
      title="确认强制取消？"
      :message="
        pendingRun
          ? `Agent Run #${pendingRun.id}（${pendingRun.agent_name || 'Agent #' + pendingRun.agent_definition_id}）将立即终止，无法撤销。`
          : ''
      "
      confirm-text="强制取消"
      :danger="true"
      @confirm="executeCancel"
      @cancel="handleModalCancel"
    />
  </div>
</template>

<style scoped>
.agent-monitoring {
  padding: var(--space-6);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--on-surface);
}

.page-subtitle {
  color: var(--on-surface-variant);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid rgba(169, 180, 185, 0.2);
  border-radius: var(--radius-sm);
  background: var(--surface-lowest);
  color: var(--on-surface);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--surface-low);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

.error-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  background: rgba(var(--danger-rgb, 220, 53, 69), 0.08);
  border: 1px solid rgba(var(--danger-rgb, 220, 53, 69), 0.2);
  border-radius: var(--radius-sm);
  color: var(--danger, #dc3545);
  font-size: var(--text-sm);
}

.retry-btn {
  padding: var(--space-1) var(--space-3);
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font-size: var(--text-xs);
  cursor: pointer;
}

.trace-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
}

.trace-link:hover {
  text-decoration: underline;
}

.trace-link--mono {
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge--running {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.status-badge--cancelling {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}

.status-badge--cancelled {
  background: rgba(100, 116, 139, 0.15);
  color: #475569;
}

.status-badge--terminated {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.btn-danger-sm {
  padding: var(--space-1) var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--danger, #dc3545);
  color: white;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-danger-sm:hover {
  opacity: 0.85;
}

.muted {
  color: var(--on-surface-variant);
  opacity: 0.5;
}
</style>
