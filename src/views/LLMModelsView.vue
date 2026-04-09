<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  getModelsApi,
  createModelApi,
  updateModelApi,
  deleteModelApi,
  getRoutesApi,
  createRouteApi,
  updateRouteApi,
  deleteRouteApi,
  getProvidersApi,
  type LLMModel,
  type LLMModelRoute,
  type LLMProvider,
} from "@/api/llm";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Inbox,
} from "lucide-vue-next";
import { useToast } from "@/composables/useToast";

const toast = useToast();

// ====== Models ======
const models = ref<LLMModel[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 50;
const loading = ref(false);
const error = ref("");
const processing = ref(false);

// ====== Model Modal ======
const modelModalVisible = ref(false);
const isEditModel = ref(false);
const editingModelId = ref(0);

interface ModelForm {
  model_key: string;
  display_name: string;
  is_thinking: boolean;
  base_model_id: number | null;
  supports_thinking: boolean;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

const defaultModelForm: ModelForm = {
  model_key: "",
  display_name: "",
  is_thinking: false,
  base_model_id: null,
  supports_thinking: false,
  icon: "",
  sort_order: 0,
  is_active: true,
};

const modelForm = ref<ModelForm>({ ...defaultModelForm });

// ====== Delete Confirm ======
const confirmVisible = ref(false);
const pendingDeleteId = ref(0);
const pendingDeleteName = ref("");
const pendingDeleteType = ref<"model" | "route">("model");
const pendingDeleteModelId = ref(0);

// ====== Expandable Routes ======
const expandedModelId = ref<number | null>(null);
const routesMap = ref<Record<number, LLMModelRoute[]>>({});
const routesLoadingMap = ref<Record<number, boolean>>({});

// ====== Providers (for route form) ======
const providers = ref<LLMProvider[]>([]);

// ====== Route Modal ======
const routeModalVisible = ref(false);
const isEditRoute = ref(false);
const editingRouteId = ref(0);
const routeForModelId = ref(0);

interface RouteForm {
  provider_id: number | null;
  provider_model_id: string;
  priority: number;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  is_active: boolean;
}

const defaultRouteForm: RouteForm = {
  provider_id: null,
  provider_model_id: "",
  priority: 0,
  input_price_per_mtok: 0,
  output_price_per_mtok: 0,
  is_active: true,
};

const routeForm = ref<RouteForm>({ ...defaultRouteForm });

// ====== Pagination ======
const totalPages = () => Math.max(1, Math.ceil(total.value / pageSize));

// ====== Fetch ======
async function fetchModels() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getModelsApi(page.value, pageSize);
    models.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = (e as Error).message || "加载模型失败";
  } finally {
    loading.value = false;
  }
}

async function fetchProviders() {
  try {
    const res = await getProvidersApi(1, 100);
    providers.value = res.list ?? [];
  } catch {
    // non-critical
  }
}

async function toggleRoutes(model: LLMModel) {
  if (expandedModelId.value === model.id) {
    expandedModelId.value = null;
    return;
  }
  expandedModelId.value = model.id;
  if (!routesMap.value[model.id]) {
    routesLoadingMap.value[model.id] = true;
    try {
      const res = await getRoutesApi(model.id);
      routesMap.value[model.id] = res.list ?? [];
    } catch (e) {
      toast.error((e as Error).message || "加载路由失败");
    } finally {
      routesLoadingMap.value[model.id] = false;
    }
  }
}

// ====== Model CRUD ======
function openCreateModel() {
  isEditModel.value = false;
  editingModelId.value = 0;
  modelForm.value = { ...defaultModelForm };
  modelModalVisible.value = true;
}

function openEditModel(model: LLMModel) {
  isEditModel.value = true;
  editingModelId.value = model.id;
  modelForm.value = {
    model_key: model.model_key,
    display_name: model.display_name,
    is_thinking: model.is_thinking,
    base_model_id: model.base_model_id,
    supports_thinking: model.supports_thinking,
    icon: model.icon,
    sort_order: model.sort_order,
    is_active: model.is_active,
  };
  modelModalVisible.value = true;
}

async function submitModelForm() {
  if (processing.value) return;
  if (!modelForm.value.model_key || !modelForm.value.display_name) {
    toast.error("Model Key 和显示名称为必填项");
    return;
  }
  processing.value = true;
  try {
    if (isEditModel.value) {
      await updateModelApi(editingModelId.value, modelForm.value);
      toast.success("模型已更新");
    } else {
      await createModelApi(modelForm.value);
      toast.success("模型已创建");
    }
    modelModalVisible.value = false;
    await fetchModels();
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    processing.value = false;
  }
}

function confirmDeleteModel(model: LLMModel) {
  pendingDeleteId.value = model.id;
  pendingDeleteName.value = model.display_name || model.model_key;
  pendingDeleteType.value = "model";
  confirmVisible.value = true;
}

async function toggleModelActive(model: LLMModel) {
  try {
    await updateModelApi(model.id, { is_active: !model.is_active });
    model.is_active = !model.is_active;
    toast.success(model.is_active ? "已启用" : "已禁用");
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  }
}

// ====== Route CRUD ======
function openCreateRoute(modelId: number) {
  isEditRoute.value = false;
  editingRouteId.value = 0;
  routeForModelId.value = modelId;
  routeForm.value = { ...defaultRouteForm };
  routeModalVisible.value = true;
}

function openEditRoute(modelId: number, route: LLMModelRoute) {
  isEditRoute.value = true;
  editingRouteId.value = route.id;
  routeForModelId.value = modelId;
  routeForm.value = {
    provider_id: route.provider_id,
    provider_model_id: route.provider_model_id,
    priority: route.priority,
    input_price_per_mtok: route.input_price_per_mtok,
    output_price_per_mtok: route.output_price_per_mtok,
    is_active: route.is_active,
  };
  routeModalVisible.value = true;
}

async function submitRouteForm() {
  if (processing.value) return;
  if (!routeForm.value.provider_id || !routeForm.value.provider_model_id) {
    toast.error("供应商和供应商模型名为必填项");
    return;
  }
  processing.value = true;
  try {
    const payload = {
      ...routeForm.value,
      provider_id: routeForm.value.provider_id ?? undefined,
    };
    if (isEditRoute.value) {
      await updateRouteApi(
        routeForModelId.value,
        editingRouteId.value,
        payload,
      );
      toast.success("路由已更新");
    } else {
      await createRouteApi(routeForModelId.value, payload);
      toast.success("路由已创建");
    }
    routeModalVisible.value = false;
    const res = await getRoutesApi(routeForModelId.value);
    routesMap.value[routeForModelId.value] = res.list ?? [];
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    processing.value = false;
  }
}

function confirmDeleteRoute(modelId: number, route: LLMModelRoute) {
  pendingDeleteId.value = route.id;
  pendingDeleteModelId.value = modelId;
  pendingDeleteName.value = `${route.provider?.display_name ?? String(route.provider_id)} / ${route.provider_model_id}`;
  pendingDeleteType.value = "route";
  confirmVisible.value = true;
}

async function toggleRouteActive(modelId: number, route: LLMModelRoute) {
  try {
    await updateRouteApi(modelId, route.id, { is_active: !route.is_active });
    route.is_active = !route.is_active;
    toast.success(route.is_active ? "已启用" : "已禁用");
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  }
}

async function executeDelete() {
  if (processing.value) return;
  processing.value = true;
  try {
    if (pendingDeleteType.value === "model") {
      await deleteModelApi(pendingDeleteId.value);
      confirmVisible.value = false;
      toast.success("模型已删除");
      await fetchModels();
    } else {
      await deleteRouteApi(pendingDeleteModelId.value, pendingDeleteId.value);
      confirmVisible.value = false;
      toast.success("路由已删除");
      const res = await getRoutesApi(pendingDeleteModelId.value);
      routesMap.value[pendingDeleteModelId.value] = res.list ?? [];
    }
  } catch (e) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    processing.value = false;
  }
}

function getProviderName(providerId: number): string {
  const p = providers.value.find((x) => x.id === providerId);
  return p ? p.display_name : String(providerId);
}

watch(page, fetchModels);
onMounted(() => {
  fetchModels();
  fetchProviders();
});
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">LLM 模型管理</h1>
      <AppButton variant="primary" @click="openCreateModel">
        <Plus :size="16" />
        新建模型
      </AppButton>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- Models Table -->
    <div class="table-card">
      <div class="table-scroll">
        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 40px"></th>
              <th>Model Key</th>
              <th style="width: 160px">显示名称</th>
              <th style="width: 90px">Thinking</th>
              <th style="width: 100px">支持Thinking</th>
              <th style="width: 70px; text-align: right">排序</th>
              <th style="width: 80px">状态</th>
              <th style="width: 120px">操作</th>
            </tr>
          </thead>
          <tbody v-if="loading">
            <tr v-for="i in 5" :key="i">
              <td v-for="j in 8" :key="j"><div class="skeleton" /></td>
            </tr>
          </tbody>
          <tbody v-else-if="models.length === 0">
            <tr>
              <td colspan="8" class="empty-cell">
                <div class="empty-state">
                  <Inbox :size="40" />
                  <p>暂无模型数据</p>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <template v-for="model in models" :key="model.id">
              <!-- Main row -->
              <tr
                class="model-row"
                :class="{ 'model-row--expanded': expandedModelId === model.id }"
              >
                <td>
                  <button class="expand-btn" @click="toggleRoutes(model)">
                    <ChevronDown
                      v-if="expandedModelId === model.id"
                      :size="16"
                    />
                    <ChevronRight v-else :size="16" />
                  </button>
                </td>
                <td>
                  <span class="text-mono">{{ model.model_key }}</span>
                </td>
                <td>{{ model.display_name }}</td>
                <td>
                  <span
                    class="badge"
                    :class="model.is_thinking ? 'badge--purple' : 'badge--gray'"
                  >
                    {{ model.is_thinking ? "Thinking" : "标准" }}
                  </span>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="
                      model.supports_thinking ? 'badge--blue' : 'badge--gray'
                    "
                  >
                    {{ model.supports_thinking ? "支持" : "—" }}
                  </span>
                </td>
                <td style="text-align: right">{{ model.sort_order }}</td>
                <td>
                  <button
                    class="toggle-btn"
                    :class="{ 'toggle-btn--active': model.is_active }"
                    @click="toggleModelActive(model)"
                  >
                    {{ model.is_active ? "启用" : "禁用" }}
                  </button>
                </td>
                <td>
                  <div class="action-buttons">
                    <AppButton
                      size="sm"
                      variant="ghost"
                      :disabled="processing"
                      @click="openEditModel(model)"
                    >
                      <Pencil :size="14" />
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      :disabled="processing"
                      @click="confirmDeleteModel(model)"
                    >
                      <Trash2 :size="14" style="color: var(--danger)" />
                    </AppButton>
                  </div>
                </td>
              </tr>

              <!-- Routes expansion row -->
              <tr v-if="expandedModelId === model.id" class="routes-row">
                <td colspan="8" class="routes-cell">
                  <div class="routes-panel">
                    <div class="routes-panel__header">
                      <span class="routes-panel__title"
                        >路由配置 — {{ model.display_name }}</span
                      >
                      <AppButton
                        size="sm"
                        variant="primary"
                        @click="openCreateRoute(model.id)"
                      >
                        <Plus :size="14" />
                        添加路由
                      </AppButton>
                    </div>

                    <div v-if="routesLoadingMap[model.id]" class="routes-empty">
                      加载中...
                    </div>
                    <div
                      v-else-if="!routesMap[model.id]?.length"
                      class="routes-empty"
                    >
                      暂无路由，点击「添加路由」创建
                    </div>
                    <table v-else class="routes-table">
                      <thead>
                        <tr>
                          <th>供应商</th>
                          <th>供应商模型名</th>
                          <th class="align-right">优先级</th>
                          <th class="align-right">输入价格 (分/MTok)</th>
                          <th class="align-right">输出价格 (分/MTok)</th>
                          <th>状态</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="route in routesMap[model.id]"
                          :key="route.id"
                        >
                          <td>
                            {{
                              route.provider?.display_name ??
                              getProviderName(route.provider_id)
                            }}
                          </td>
                          <td>
                            <span class="text-mono">{{
                              route.provider_model_id
                            }}</span>
                          </td>
                          <td class="align-right">{{ route.priority }}</td>
                          <td class="align-right text-mono">
                            {{ Number(route.input_price_per_mtok).toFixed(2) }}
                          </td>
                          <td class="align-right text-mono">
                            {{ Number(route.output_price_per_mtok).toFixed(2) }}
                          </td>
                          <td>
                            <button
                              class="toggle-btn"
                              :class="{ 'toggle-btn--active': route.is_active }"
                              @click="toggleRouteActive(model.id, route)"
                            >
                              {{ route.is_active ? "启用" : "禁用" }}
                            </button>
                          </td>
                          <td>
                            <div class="action-buttons">
                              <AppButton
                                size="sm"
                                variant="ghost"
                                :disabled="processing"
                                @click="openEditRoute(model.id, route)"
                              >
                                <Pencil :size="14" />
                              </AppButton>
                              <AppButton
                                size="sm"
                                variant="ghost"
                                :disabled="processing"
                                @click="confirmDeleteRoute(model.id, route)"
                              >
                                <Trash2
                                  :size="14"
                                  style="color: var(--danger)"
                                />
                              </AppButton>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="total > pageSize" class="pagination">
        <span class="pagination__info">共 {{ total }} 条</span>
        <div class="pagination__controls">
          <button class="pagination__btn" :disabled="page <= 1" @click="page--">
            上一页
          </button>
          <span class="pagination__page">{{ page }} / {{ totalPages() }}</span>
          <button
            class="pagination__btn"
            :disabled="page >= totalPages()"
            @click="page++"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <ConfirmModal
      :visible="confirmVisible"
      :title="pendingDeleteType === 'model' ? '删除模型' : '删除路由'"
      :message="`确定要删除「${pendingDeleteName}」吗？此操作不可撤销。`"
      :danger="true"
      @confirm="executeDelete"
      @cancel="confirmVisible = false"
    />

    <!-- Model Create/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="modelModalVisible"
          class="modal-overlay"
          @click.self="modelModalVisible = false"
          @keydown.esc="modelModalVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">
              {{ isEditModel ? "编辑模型" : "新建模型" }}
            </h3>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Model Key *</label>
                <AppInput
                  v-model="modelForm.model_key"
                  placeholder="如 gpt-4o、qwen-plus"
                  :disabled="isEditModel"
                />
              </div>
              <div class="form-group">
                <label class="form-label">显示名称 *</label>
                <AppInput
                  v-model="modelForm.display_name"
                  placeholder="如 GPT-4o"
                />
              </div>
              <div class="form-group">
                <label class="form-label">图标</label>
                <AppInput
                  v-model="modelForm.icon"
                  placeholder="emoji 或图标标识"
                />
              </div>
              <div class="form-group">
                <label class="form-label">排序</label>
                <input
                  v-model.number="modelForm.sort_order"
                  type="number"
                  class="num-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Base Model ID</label>
                <input
                  v-model.number="modelForm.base_model_id"
                  type="number"
                  class="num-input"
                  placeholder="Thinking 模型填父模型ID"
                />
              </div>
              <div class="form-group checkboxes">
                <label class="checkbox-label">
                  <input
                    v-model="modelForm.is_thinking"
                    type="checkbox"
                    class="checkbox"
                  />
                  是 Thinking 模型
                </label>
                <label class="checkbox-label">
                  <input
                    v-model="modelForm.supports_thinking"
                    type="checkbox"
                    class="checkbox"
                  />
                  支持 Thinking
                </label>
                <label class="checkbox-label">
                  <input
                    v-model="modelForm.is_active"
                    type="checkbox"
                    class="checkbox"
                  />
                  启用
                </label>
              </div>
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="modelModalVisible = false"
                >取消</AppButton
              >
              <AppButton
                variant="primary"
                :loading="processing"
                @click="submitModelForm"
              >
                {{ isEditModel ? "保存" : "创建" }}
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Route Create/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="routeModalVisible"
          class="modal-overlay"
          @click.self="routeModalVisible = false"
          @keydown.esc="routeModalVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">
              {{ isEditRoute ? "编辑路由" : "添加路由" }}
            </h3>

            <div class="form-grid">
              <div class="form-group form-group--full">
                <label class="form-label">供应商 *</label>
                <select
                  v-model.number="routeForm.provider_id"
                  class="select-input"
                >
                  <option :value="null" disabled>选择供应商</option>
                  <option v-for="p in providers" :key="p.id" :value="p.id">
                    {{ p.display_name }} ({{ p.name }})
                  </option>
                </select>
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">供应商模型名 *</label>
                <AppInput
                  v-model="routeForm.provider_model_id"
                  placeholder="如 qwen-plus、deepseek-v3"
                />
              </div>
              <div class="form-group">
                <label class="form-label">优先级</label>
                <input
                  v-model.number="routeForm.priority"
                  type="number"
                  class="num-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">输入价格 (分/MTok)</label>
                <input
                  v-model.number="routeForm.input_price_per_mtok"
                  type="number"
                  step="0.01"
                  class="num-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">输出价格 (分/MTok)</label>
                <input
                  v-model.number="routeForm.output_price_per_mtok"
                  type="number"
                  step="0.01"
                  class="num-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    v-model="routeForm.is_active"
                    type="checkbox"
                    class="checkbox"
                  />
                  启用此路由
                </label>
              </div>
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="routeModalVisible = false"
                >取消</AppButton
              >
              <AppButton
                variant="primary"
                :loading="processing"
                @click="submitRouteForm"
              >
                {{ isEditRoute ? "保存" : "添加" }}
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Table card */
.table-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.main-table {
  width: 100%;
  border-collapse: collapse;
}

.main-table th {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  background: var(--gray-50);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  text-align: left;
}

.main-table td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  color: var(--text);
  border-bottom: 1px solid var(--gray-100);
  vertical-align: middle;
}

.model-row {
  transition: background var(--transition-fast);
}

.model-row:hover {
  background: var(--gray-50);
}

.model-row--expanded {
  background: var(--gray-50);
}

/* Routes expansion */
.routes-row {
  background: #f8faff;
}

.routes-cell {
  padding: 0 !important;
  border-bottom: 2px solid var(--border) !important;
}

.routes-panel {
  padding: var(--space-4) var(--space-6);
}

.routes-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.routes-panel__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.routes-empty {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-3) 0;
}

.routes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.routes-table th {
  text-align: left;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: var(--text-xs);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}

.routes-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--gray-100);
  color: var(--text);
}

.routes-table th.align-right,
.routes-table td.align-right {
  text-align: right;
}

/* Misc */
.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

.badge--gray {
  background: var(--gray-100);
  color: var(--text-secondary);
}

.badge--purple {
  background: #ede9fe;
  color: #7c3aed;
}

.badge--blue {
  background: #dbeafe;
  color: #1d4ed8;
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
}

.expand-btn {
  color: var(--text-secondary);
  padding: 2px;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
}

.expand-btn:hover {
  color: var(--text);
}

.toggle-btn {
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--gray-100);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.toggle-btn--active {
  background: var(--success-light, #dcfce7);
  color: var(--success, #16a34a);
  border-color: var(--success, #16a34a);
}

.toggle-btn:hover {
  opacity: 0.8;
}

/* Skeleton */
.skeleton {
  height: 16px;
  background: linear-gradient(
    90deg,
    var(--gray-100) 25%,
    var(--gray-200) 50%,
    var(--gray-100) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Empty state */
.empty-cell {
  padding: 0 !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-6);
  color: var(--gray-400);
}

.empty-state p {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border);
}

.pagination__info {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.pagination__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.pagination__page {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pagination__btn {
  height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--surface);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination__btn:hover:not(:disabled) {
  background: var(--gray-50);
}

.pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Form */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.form-group--full {
  grid-column: 1 / -1;
}

.form-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.checkboxes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  justify-content: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
  color: var(--text);
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.num-input,
.select-input {
  width: 100%;
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--surface);
  font-family: var(--font-mono);
}

.select-input {
  font-family: inherit;
}

.num-input:focus,
.select-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
</style>
