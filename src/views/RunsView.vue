<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { getRunsApi, getRunDetailApi, type SopRun, type NodeRun } from '@/api/runs'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { Clock, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { formatDateTime } from '@/utils/format'
import { runStatusMap, nodeStatusMap } from '@/constants/statusMaps'

const runs = ref<SopRun[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const statusFilter = ref('')
const error = ref('')

// Detail panel
const expandedRunId = ref<number | null>(null)
const detailLoading = ref(false)
const nodeRuns = ref<NodeRun[]>([])

const columns: Column[] = [
  { key: 'id', title: 'ID', width: '60px' },
  { key: 'template_name', title: '模板', width: '160px' },
  { key: 'user_nickname', title: '用户', width: '120px' },
  { key: 'status', title: '状态', width: '90px' },
  { key: 'started_at', title: '开始时间', width: '150px' },
  { key: 'finished_at', title: '结束时间', width: '150px' },
  { key: 'duration', title: '耗时', width: '80px', align: 'right' },
  { key: 'expand', title: '', width: '40px' }
]

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '等待中', value: 'pending' },
  { label: '运行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' }
]

const tableData = computed(() => {
  return runs.value.map(run => ({
    ...run,
    template_name: run.template?.name || '-',
    user_nickname: run.user?.nickname || '-'
  }))
})

async function fetchRuns() {
  loading.value = true
  error.value = ''
  try {
    const offset = (page.value - 1) * pageSize
    const params: Record<string, unknown> = { offset, limit: pageSize }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await getRunsApi(params as Parameters<typeof getRunsApi>[0])
    runs.value = res.runs
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载运行数据失败'
  } finally {
    loading.value = false
  }
}

function calcDuration(run: SopRun): string {
  if (!run.started_at || !run.finished_at) return '-'
  const start = new Date(run.started_at).getTime()
  const end = new Date(run.finished_at).getTime()
  const diff = Math.round((end - start) / 1000)
  if (diff < 60) return `${diff}s`
  return `${Math.floor(diff / 60)}m${diff % 60}s`
}

async function toggleDetail(run: SopRun) {
  if (expandedRunId.value === run.id) {
    expandedRunId.value = null
    nodeRuns.value = []
    return
  }
  expandedRunId.value = run.id
  detailLoading.value = true
  try {
    const detail = await getRunDetailApi(run.id)
    nodeRuns.value = detail.node_runs.sort((a, b) => a.sort - b.sort)
  } catch (e) {
    error.value = (e as Error).message || '加载详情失败'
  } finally {
    detailLoading.value = false
  }
}

watch(statusFilter, () => {
  page.value = 1
  fetchRuns()
})

watch(page, fetchRuns)

onMounted(fetchRuns)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">运行监控</h1>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <div class="filters">
      <AppSelect v-model="statusFilter" :options="statusOptions" placeholder="状态筛选" />
    </div>

    <DataTable
      :columns="columns"
      :data="tableData"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :clickable="true"
      @update:page="page = $event"
      @row-click="toggleDetail($event as SopRun)"
    >
      <template #cell-status="{ row }">
        <StatusBadge :status="(row as SopRun).status" :map="runStatusMap" />
      </template>

      <template #cell-started_at="{ row }">
        <span class="text-muted">{{ formatDateTime((row as SopRun).started_at) }}</span>
      </template>

      <template #cell-finished_at="{ row }">
        <span class="text-muted">{{ formatDateTime((row as SopRun).finished_at) }}</span>
      </template>

      <template #cell-duration="{ row }">
        <span class="duration">
          <Clock :size="12" />
          {{ calcDuration(row as SopRun) }}
        </span>
      </template>

      <template #cell-expand="{ row }">
        <button class="expand-btn" aria-label="展开详情">
          <ChevronUp v-if="expandedRunId === (row as SopRun).id" :size="16" />
          <ChevronDown v-else :size="16" />
        </button>
      </template>
    </DataTable>

    <!-- Expanded Detail -->
    <Transition name="fade">
      <div v-if="expandedRunId" class="detail-panel card">
        <div class="card-body">
          <h3 class="detail-title">运行详情 #{{ expandedRunId }}</h3>

          <div v-if="detailLoading" class="loading-container">
            <div class="spinner" />
          </div>

          <div v-else-if="nodeRuns.length === 0" class="empty-state">
            <p>暂无节点运行数据</p>
          </div>

          <div v-else class="node-runs">
            <div v-for="nr in nodeRuns" :key="nr.id" class="node-run-card">
              <div class="node-run-header">
                <div class="node-run-sort">{{ nr.sort }}</div>
                <StatusBadge :status="nr.status" :map="nodeStatusMap" />
                <span v-if="nr.latency_ms" class="node-run-latency">
                  <Clock :size="12" />
                  {{ nr.latency_ms }}ms
                </span>
              </div>
              <div v-if="nr.input" class="node-run-section">
                <label class="node-run-label">输入</label>
                <pre class="node-run-content">{{ nr.input }}</pre>
              </div>
              <div v-if="nr.output" class="node-run-section">
                <label class="node-run-label">输出</label>
                <pre class="node-run-content">{{ nr.output }}</pre>
              </div>
              <div v-if="nr.thinking" class="node-run-section">
                <label class="node-run-label">思考过程</label>
                <pre class="node-run-content node-run-content--thinking">{{ nr.thinking }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.text-muted {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.duration {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.expand-btn:hover {
  color: var(--text);
}

.detail-panel {
  margin-top: var(--space-4);
}

.detail-title {
  font-size: var(--text-base);
  font-weight: 600;
  margin-bottom: var(--space-4);
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: var(--space-6);
}

.node-runs {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.node-run-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.node-run-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--border);
}

.node-run-sort {
  width: 24px;
  height: 24px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
}

.node-run-latency {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  margin-left: auto;
}

.node-run-section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.node-run-section:last-child {
  border-bottom: none;
}

.node-run-label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.node-run-content {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  background: var(--gray-50);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  margin: 0;
}

.node-run-content--thinking {
  color: var(--text-secondary);
  font-style: italic;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-base);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
