<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  getProvidersApi,
  createProviderApi,
  updateProviderApi,
  deleteProviderApi,
  type LLMProvider,
} from "@/api/llm";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { Plus, Pencil, Trash2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";

const toast = useToast();
const providers = ref<LLMProvider[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");
const processing = ref(false);

// Modal
const modalVisible = ref(false);
const isEdit = ref(false);
const editingId = ref(0);

interface ProviderForm {
  name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  is_active: boolean;
}

const defaultForm: ProviderForm = {
  name: "",
  display_name: "",
  base_url: "",
  api_key: "",
  is_active: true,
};

const form = ref<ProviderForm>({ ...defaultForm });

// Delete confirm
const confirmVisible = ref(false);
const pendingDeleteId = ref(0);
const pendingDeleteName = ref("");

const columns: Column[] = [
  { key: "name", title: "名称", width: "120px" },
  { key: "display_name", title: "显示名称", width: "140px" },
  { key: "base_url", title: "API 地址" },
  { key: "api_key_masked", title: "API Key", width: "180px" },
  { key: "is_active", title: "状态", width: "80px" },
  { key: "actions", title: "操作", width: "100px" },
];

async function fetchProviders() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getProvidersApi(page.value, pageSize);
    providers.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = (e as Error).message || "加载供应商失败";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  isEdit.value = false;
  editingId.value = 0;
  form.value = { ...defaultForm };
  modalVisible.value = true;
}

function openEdit(provider: LLMProvider) {
  isEdit.value = true;
  editingId.value = provider.id;
  form.value = {
    name: provider.name,
    display_name: provider.display_name,
    base_url: provider.base_url,
    api_key: "",
    is_active: provider.is_active,
  };
  modalVisible.value = true;
}

async function submitForm() {
  if (processing.value) return;
  if (!form.value.name || !form.value.display_name || !form.value.base_url) {
    toast.error("名称、显示名称和 API 地址为必填项");
    return;
  }
  if (!isEdit.value && !form.value.api_key) {
    toast.error("新建供应商必须填写 API Key");
    return;
  }
  processing.value = true;
  try {
    if (isEdit.value) {
      const updates: Partial<{
        display_name: string;
        base_url: string;
        api_key: string;
        is_active: boolean;
      }> = {
        display_name: form.value.display_name,
        base_url: form.value.base_url,
        is_active: form.value.is_active,
      };
      if (form.value.api_key) {
        updates.api_key = form.value.api_key;
      }
      await updateProviderApi(editingId.value, updates);
      toast.success("供应商已更新");
    } else {
      await createProviderApi({
        name: form.value.name,
        display_name: form.value.display_name,
        base_url: form.value.base_url,
        api_key: form.value.api_key,
      });
      toast.success("供应商已创建");
    }
    modalVisible.value = false;
    await fetchProviders();
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    processing.value = false;
  }
}

function confirmDelete(provider: LLMProvider) {
  pendingDeleteId.value = provider.id;
  pendingDeleteName.value = provider.display_name || provider.name;
  confirmVisible.value = true;
}

async function executeDelete() {
  if (processing.value) return;
  processing.value = true;
  try {
    await deleteProviderApi(pendingDeleteId.value);
    confirmVisible.value = false;
    toast.success("供应商已删除");
    await fetchProviders();
  } catch (e) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    processing.value = false;
  }
}

async function toggleActive(provider: LLMProvider) {
  try {
    await updateProviderApi(provider.id, { is_active: !provider.is_active });
    provider.is_active = !provider.is_active;
    toast.success(provider.is_active ? "已启用" : "已禁用");
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  }
}

watch(page, fetchProviders);
onMounted(fetchProviders);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">LLM 供应商</h1>
      <AppButton variant="primary" @click="openCreate">
        <Plus :size="16" />
        新建供应商
      </AppButton>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="providers"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event"
    >
      <template #cell-api_key_masked="{ value }">
        <span class="text-mono text-muted">{{ value || "—" }}</span>
      </template>

      <template #cell-is_active="{ row }">
        <button
          class="toggle-btn"
          :class="{ 'toggle-btn--active': (row as LLMProvider).is_active }"
          @click.stop="toggleActive(row as LLMProvider)"
        >
          {{ (row as LLMProvider).is_active ? "启用" : "禁用" }}
        </button>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            @click.stop="openEdit(row as LLMProvider)"
          >
            <Pencil :size="14" />
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            @click.stop="confirmDelete(row as LLMProvider)"
          >
            <Trash2 :size="14" style="color: var(--danger)" />
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Delete Confirm -->
    <ConfirmModal
      :visible="confirmVisible"
      title="删除供应商"
      :message="`确定要删除供应商「${pendingDeleteName}」吗？此操作不可撤销。`"
      :danger="true"
      @confirm="executeDelete"
      @cancel="confirmVisible = false"
    />

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="modalVisible"
          class="modal-overlay"
          @click.self="modalVisible = false"
          @keydown.esc="modalVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">
              {{ isEdit ? "编辑供应商" : "新建供应商" }}
            </h3>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">名称 *</label>
                <AppInput
                  v-model="form.name"
                  placeholder="如 ali、volc、openai"
                  :disabled="isEdit"
                />
              </div>
              <div class="form-group">
                <label class="form-label">显示名称 *</label>
                <AppInput
                  v-model="form.display_name"
                  placeholder="如 阿里云、火山引擎"
                />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">API 地址 *</label>
                <AppInput
                  v-model="form.base_url"
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">
                  API Key
                  <span v-if="isEdit" class="hint">（留空则不修改）</span>
                  <span v-else>*</span>
                </label>
                <AppInput
                  v-model="form.api_key"
                  type="password"
                  placeholder="sk-..."
                />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label checkbox-label">
                  <input
                    v-model="form.is_active"
                    type="checkbox"
                    class="checkbox"
                  />
                  启用此供应商
                </label>
              </div>
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="modalVisible = false"
                >取消</AppButton
              >
              <AppButton
                variant="primary"
                :loading="processing"
                @click="submitForm"
              >
                {{ isEdit ? "保存" : "创建" }}
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

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.text-muted {
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
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

.hint {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.checkbox-label {
  cursor: pointer;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}
</style>
