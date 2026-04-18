<script setup lang="ts">
/**
 * EstimationCoefficientView — R2 估算系数管理（管理端）
 *
 * Phase 1 / Track F Tasks F.1 + F.2：
 *   - F.1：DataTable + CRUD（list + filters、新增 modal、编辑 modal 触发
 *     UpdateCoefficient + change_reason 必填、软删）、503 Coefficient.Concurrent
 *     → toast "系数更新繁忙，请稍后重试"
 *   - F.2：历史版本 side-drawer（GET /history 读全部 version，列 version /
 *     is_active / values / change_reason / updated_by / updated_at）
 *
 * 后端契约冻结于 `@/api/coefficients`（Phase 0），本视图不改动契约。
 * request.ts 的响应拦截器在运行时返回 data.data，但 axios 类型签名
 * 仍为 `AxiosResponse<T>`，此处用 `as unknown as T` 断言以拿到运行时真实类型。
 *
 * spec §4.4.1 / §4.4.2 / plan Track F.1 + F.2
 */
import { ref, computed, onMounted } from "vue";
import {
  listCoefficients,
  listCoefficientHistory,
  createCoefficient,
  updateCoefficient,
  deleteCoefficient,
  type EstimationCoefficient,
  type ListCoefficientsResp,
  type UpdateCoefficientReq,
} from "@/api/coefficients";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";
import { History, Pencil, Plus, Trash2, X } from "lucide-vue-next";

const toast = useToast();

// ---- List state ----
const items = ref<EstimationCoefficient[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");

// ---- Filters ----
const filterProvider = ref("");
const filterModel = ref("");
const filterOperation = ref("");
const filterActive = ref<"1" | "all">("1");

// ---- Create / Edit modal ----
interface CoefForm {
  provider: string;
  model: string;
  operation: string;
  char_to_token_ratio: number;
  completion_prompt_ratio: number;
  safety_buffer_pct: number;
  change_reason: string;
}
const defaultForm: CoefForm = {
  provider: "",
  model: "",
  operation: "",
  char_to_token_ratio: 3,
  completion_prompt_ratio: 1,
  safety_buffer_pct: 15,
  change_reason: "",
};

const modalVisible = ref(false);
const isEdit = ref(false);
const editingId = ref(0);
const form = ref<CoefForm>({ ...defaultForm });
const processing = ref(false);

// ---- Delete confirm ----
const confirmVisible = ref(false);
const pendingDeleteId = ref(0);
const pendingDeleteLabel = ref("");

// ---- History drawer (F.2) ----
const historyVisible = ref(false);
const historyLoading = ref(false);
const historyItems = ref<EstimationCoefficient[]>([]);
const historyContext = ref<{
  provider: string;
  model: string;
  operation: string;
} | null>(null);

const activeStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: "激活", color: "success" },
  inactive: { label: "历史", color: "gray" },
};

const columns: Column[] = [
  { key: "id", title: "ID", width: "60px" },
  { key: "provider", title: "供应商", width: "100px" },
  { key: "model", title: "模型", width: "160px" },
  { key: "operation", title: "操作", width: "120px" },
  {
    key: "char_to_token_ratio",
    title: "字符→Token",
    width: "110px",
    align: "right",
  },
  {
    key: "completion_prompt_ratio",
    title: "Completion/Prompt",
    width: "140px",
    align: "right",
  },
  {
    key: "safety_buffer_pct",
    title: "Safety(%)",
    width: "90px",
    align: "right",
  },
  { key: "version", title: "版本", width: "70px", align: "right" },
  { key: "is_active", title: "状态", width: "80px" },
  { key: "updated_by", title: "更新人", width: "100px" },
  { key: "updated_at", title: "更新时间", width: "160px" },
  { key: "actions", title: "操作", width: "200px" },
];

const rowKey = "id";

const displayedItems = computed(() => items.value);

async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const res = (await listCoefficients({
      page: page.value,
      page_size: pageSize,
      provider: filterProvider.value || undefined,
      model: filterModel.value || undefined,
      operation: filterOperation.value || undefined,
      is_active: filterActive.value,
    })) as unknown as ListCoefficientsResp;
    items.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filterProvider.value = "";
  filterModel.value = "";
  filterOperation.value = "";
  filterActive.value = "1";
  page.value = 1;
  fetchList();
}

function applyFilters() {
  page.value = 1;
  fetchList();
}

function openCreate() {
  isEdit.value = false;
  editingId.value = 0;
  form.value = { ...defaultForm };
  modalVisible.value = true;
}

function openEdit(row: EstimationCoefficient) {
  isEdit.value = true;
  editingId.value = row.id;
  form.value = {
    provider: row.provider,
    model: row.model,
    operation: row.operation,
    char_to_token_ratio: row.char_to_token_ratio,
    completion_prompt_ratio: row.completion_prompt_ratio,
    safety_buffer_pct: row.safety_buffer_pct,
    // change_reason 为本次变更的审计留痕：绝不回填旧理由
    change_reason: "",
  };
  modalVisible.value = true;
}

function validForm(): boolean {
  if (!form.value.provider.trim()) {
    toast.error("供应商 provider 为必填");
    return false;
  }
  if (!form.value.model.trim()) {
    toast.error("模型 model 为必填");
    return false;
  }
  if (!form.value.operation.trim()) {
    toast.error("操作 operation 为必填");
    return false;
  }
  if (!form.value.change_reason.trim()) {
    toast.error("变更理由 change_reason 为必填");
    return false;
  }
  return true;
}

/**
 * 503 Coefficient.Concurrent: 后端乐观锁/并发控制命中时返回。
 * 通过两种路径判定：errno code 或 HTTP 状态。
 */
function handleUpdateError(e: unknown) {
  const err = e as Error & { code?: string | number };
  if (err.code === "Coefficient.Concurrent") {
    toast.error("系数更新繁忙，请稍后重试");
    return;
  }
  const maybeResp = (
    err as unknown as {
      response?: { status?: number };
    }
  ).response;
  if (maybeResp?.status === 503) {
    toast.error("系数更新繁忙，请稍后重试");
    return;
  }
  toast.error(err.message || "操作失败");
}

async function submitForm() {
  if (processing.value) return;
  if (!validForm()) return;
  processing.value = true;
  try {
    const body: UpdateCoefficientReq = {
      provider: form.value.provider.trim(),
      model: form.value.model.trim(),
      operation: form.value.operation.trim(),
      char_to_token_ratio: Number(form.value.char_to_token_ratio),
      completion_prompt_ratio: Number(form.value.completion_prompt_ratio),
      safety_buffer_pct: Number(form.value.safety_buffer_pct),
      change_reason: form.value.change_reason.trim(),
    };
    if (isEdit.value) {
      await updateCoefficient(editingId.value, body);
      toast.success("估算系数已更新");
    } else {
      await createCoefficient(body);
      toast.success("估算系数已新增");
    }
    modalVisible.value = false;
    await fetchList();
  } catch (e) {
    handleUpdateError(e);
  } finally {
    processing.value = false;
  }
}

function confirmDelete(row: EstimationCoefficient) {
  pendingDeleteId.value = row.id;
  pendingDeleteLabel.value = `${row.provider} / ${row.model} / ${row.operation} (v${row.version})`;
  confirmVisible.value = true;
}

async function executeDelete() {
  if (processing.value) return;
  processing.value = true;
  try {
    await deleteCoefficient(pendingDeleteId.value);
    confirmVisible.value = false;
    toast.success("估算系数已软删");
    await fetchList();
  } catch (e) {
    handleUpdateError(e);
  } finally {
    processing.value = false;
  }
}

/**
 * F.2: 打开某行的历史版本 drawer。调 `GET .../history` 拉所有 version
 * （含 is_active=0），展示在 side drawer。
 */
async function openHistory(row: EstimationCoefficient) {
  historyContext.value = {
    provider: row.provider,
    model: row.model,
    operation: row.operation,
  };
  historyVisible.value = true;
  historyLoading.value = true;
  historyItems.value = [];
  try {
    const res = (await listCoefficientHistory({
      provider: row.provider,
      model: row.model,
      operation: row.operation,
    })) as unknown as { list: EstimationCoefficient[] };
    historyItems.value = res.list ?? [];
  } catch (e) {
    toast.error((e as Error).message || "加载历史版本失败");
  } finally {
    historyLoading.value = false;
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">AI 服务管理 / 估算系数</p>
        <h1 class="page-title">估算系数</h1>
        <p class="page-subtitle">
          R2 估算公式所用系数（char→token、completion/prompt 比、safety
          buffer）。每次 UpdateCoefficient 需填写变更理由。
        </p>
      </div>
      <div class="page-actions">
        <AppButton
          variant="primary"
          data-test="open-create"
          @click="openCreate"
        >
          <Plus :size="14" />
          新增系数
        </AppButton>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <AppInput
        :model-value="filterProvider"
        placeholder="供应商筛选"
        label="供应商"
        data-test="filter-provider"
        @update:model-value="filterProvider = String($event ?? '')"
      />
      <AppInput
        :model-value="filterModel"
        placeholder="模型筛选"
        label="模型"
        data-test="filter-model"
        @update:model-value="filterModel = String($event ?? '')"
      />
      <AppInput
        :model-value="filterOperation"
        placeholder="操作筛选"
        label="操作"
        data-test="filter-operation"
        @update:model-value="filterOperation = String($event ?? '')"
      />
      <div class="filter-active">
        <label class="app-input-label">状态</label>
        <select v-model="filterActive" class="filter-select">
          <option value="1">仅激活</option>
          <option value="all">全部（含历史）</option>
        </select>
      </div>
      <div class="filter-actions">
        <AppButton
          variant="secondary"
          size="md"
          data-test="apply-filters"
          @click="applyFilters"
        >
          筛选
        </AppButton>
        <AppButton variant="ghost" size="md" @click="resetFilters">
          重置
        </AppButton>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="displayedItems"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      :row-key="rowKey"
      @update:page="
        page = $event;
        fetchList();
      "
    >
      <template #cell-is_active="{ row }">
        <StatusBadge
          :status="
            (row as EstimationCoefficient).is_active ? 'active' : 'inactive'
          "
          :map="activeStatusMap"
        />
      </template>

      <template #cell-updated_at="{ row }">
        <span class="text-muted">{{
          formatDate((row as EstimationCoefficient).updated_at)
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :data-test="`row-edit-${(row as EstimationCoefficient).id}`"
            @click.stop="openEdit(row as EstimationCoefficient)"
          >
            <Pencil :size="14" />
            编辑
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            :data-test="`row-history-${(row as EstimationCoefficient).id}`"
            @click.stop="openHistory(row as EstimationCoefficient)"
          >
            <History :size="14" />
            历史
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            :data-test="`row-delete-${(row as EstimationCoefficient).id}`"
            @click.stop="confirmDelete(row as EstimationCoefficient)"
          >
            <Trash2 :size="14" />
            软删
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Create / Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="modalVisible"
          class="modal-overlay"
          @click.self="modalVisible = false"
          @keydown.esc="modalVisible = false"
        >
          <div
            class="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
          >
            <div class="modal-header">
              <h3 class="modal-title">
                {{ isEdit ? "编辑估算系数" : "新增估算系数" }}
              </h3>
              <AppButton
                size="sm"
                variant="ghost"
                @click="modalVisible = false"
              >
                关闭
              </AppButton>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <AppInput
                  :model-value="form.provider"
                  label="供应商 *"
                  placeholder="如 volc / ali / baidu"
                  :disabled="isEdit"
                  data-test="form-provider"
                  @update:model-value="form.provider = String($event ?? '')"
                />
              </div>
              <div class="form-group">
                <AppInput
                  :model-value="form.model"
                  label="模型 *"
                  placeholder="如 glm-4-7-251222"
                  :disabled="isEdit"
                  data-test="form-model"
                  @update:model-value="form.model = String($event ?? '')"
                />
              </div>
              <div class="form-group">
                <AppInput
                  :model-value="form.operation"
                  label="操作 *"
                  placeholder="如 sop_step / salesrag_chat"
                  :disabled="isEdit"
                  data-test="form-operation"
                  @update:model-value="form.operation = String($event ?? '')"
                />
              </div>
              <div class="form-group">
                <AppInput
                  :model-value="form.char_to_token_ratio"
                  type="number"
                  label="字符→Token 比率 *"
                  data-test="form-char-ratio"
                  @update:model-value="
                    form.char_to_token_ratio = Number($event ?? 0)
                  "
                />
              </div>
              <div class="form-group">
                <AppInput
                  :model-value="form.completion_prompt_ratio"
                  type="number"
                  label="Completion/Prompt 比率 *"
                  data-test="form-completion-ratio"
                  @update:model-value="
                    form.completion_prompt_ratio = Number($event ?? 0)
                  "
                />
              </div>
              <div class="form-group">
                <AppInput
                  :model-value="form.safety_buffer_pct"
                  type="number"
                  label="Safety Buffer (%) *"
                  data-test="form-safety"
                  @update:model-value="
                    form.safety_buffer_pct = Number($event ?? 0)
                  "
                />
              </div>
              <div class="form-group form-group--full">
                <AppInput
                  :model-value="form.change_reason"
                  label="变更理由 *"
                  placeholder="说明本次变更原因（审计留痕，必填）"
                  data-test="form-change-reason"
                  @update:model-value="
                    form.change_reason = String($event ?? '')
                  "
                />
              </div>
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="modalVisible = false">
                取消
              </AppButton>
              <AppButton
                variant="primary"
                :loading="processing"
                data-test="submit-form"
                @click="submitForm"
              >
                {{ isEdit ? "保存更新" : "创建" }}
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirm -->
    <ConfirmModal
      :visible="confirmVisible"
      title="软删估算系数"
      :message="`确定要软删 ${pendingDeleteLabel} 吗？记录将标记为 is_active=false，不会物理删除。`"
      confirm-text="确认软删"
      danger
      @cancel="confirmVisible = false"
      @confirm="executeDelete"
    />

    <!-- History Drawer (F.2) -->
    <Teleport to="body">
      <Transition name="drawer">
        <div
          v-if="historyVisible"
          class="drawer-overlay"
          data-test="history-drawer"
          @click.self="historyVisible = false"
          @keydown.esc="historyVisible = false"
        >
          <aside class="drawer" role="dialog" aria-modal="true">
            <div class="drawer-header">
              <div>
                <h3 class="drawer-title">历史版本</h3>
                <p v-if="historyContext" class="drawer-subtitle">
                  {{ historyContext.provider }} / {{ historyContext.model }} /
                  {{ historyContext.operation }}
                </p>
              </div>
              <button
                type="button"
                class="drawer-close"
                aria-label="关闭"
                @click="historyVisible = false"
              >
                <X :size="18" />
              </button>
            </div>
            <div class="drawer-body">
              <p v-if="historyLoading" class="empty-hint">加载中...</p>
              <table v-else-if="historyItems.length" class="inner-table">
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>状态</th>
                    <th>字符→Token</th>
                    <th>Comp/Prompt</th>
                    <th>Safety(%)</th>
                    <th>变更理由</th>
                    <th>更新人</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="h in historyItems" :key="h.id">
                    <td>v{{ h.version }}</td>
                    <td>
                      <StatusBadge
                        :status="h.is_active ? 'active' : 'inactive'"
                        :map="activeStatusMap"
                      />
                    </td>
                    <td>{{ h.char_to_token_ratio }}</td>
                    <td>{{ h.completion_prompt_ratio }}</td>
                    <td>{{ h.safety_buffer_pct }}</td>
                    <td>{{ h.change_reason || "-" }}</td>
                    <td>{{ h.updated_by || "-" }}</td>
                    <td class="text-muted">{{ formatDate(h.updated_at) }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="empty-hint">暂无历史版本</p>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.filter-active {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 160px;
}

.filter-select {
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid rgba(169, 180, 185, 0.15);
  border-radius: var(--radius-sm);
  background: var(--surface-low);
  color: var(--on-surface);
  font-size: var(--text-sm);
}

.app-input-label {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-actions {
  display: flex;
  gap: var(--space-2);
}

.page-actions {
  display: flex;
  gap: var(--space-2);
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.text-muted {
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
}

.modal-card--wide {
  width: min(680px, 95vw);
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.form-group--full {
  grid-column: span 2;
}

/* ---- History drawer (F.2) ---- */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
}

.drawer {
  width: min(780px, 95vw);
  height: 100vh;
  background: var(--surface-lowest);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--outline-variant);
}

.drawer-title {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0 0 var(--space-1);
}

.drawer-subtitle {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin: 0;
}

.drawer-close {
  background: transparent;
  border: none;
  color: var(--on-surface-variant);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
}

.drawer-close:hover {
  background: var(--surface-high);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
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

.empty-hint {
  color: var(--on-surface-variant);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-4);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 180ms ease;
}
.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 220ms ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(30px);
}
</style>
