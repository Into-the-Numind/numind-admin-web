<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  listCreditUserTypeConfigsApi,
  updateCreditUserTypeConfigApi,
  type CreditUserTypeConfig,
  type UpdateCreditUserTypeConfigRequest,
} from "@/api/billing";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import { Pencil } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";

const toast = useToast();

const items = ref<CreditUserTypeConfig[]>([]);
const loading = ref(false);
const error = ref("");
const processing = ref(false);

const userTypeLabels: Record<string, string> = {
  trial: "体验用户",
  subscription: "订阅用户",
};

const columns: Column[] = [
  { key: "user_type", title: "用户类型" },
  { key: "credit_multiplier", title: "积分倍率" },
  { key: "description", title: "说明" },
  { key: "is_active", title: "状态" },
  { key: "actions", title: "操作", align: "right" },
];

async function fetchItems() {
  loading.value = true;
  error.value = "";
  try {
    const resp = await listCreditUserTypeConfigsApi();
    // Defensive filter: subscription users are always 1.0× by code rule (see
    // store/credit.go GetUserTypeCreditMultiplier). Even if a 'subscription'
    // row were ever seeded, surfacing it here would invite confusion ("why
    // can't I edit it?"). Hide it from the admin UI.
    items.value = resp.items.filter((i) => i.user_type !== "subscription");
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

// ====== Edit modal ======
const modalVisible = ref(false);
const editingType = ref<string>("");
const form = ref<{
  credit_multiplier: number;
  description: string;
  is_active: boolean;
}>({
  credit_multiplier: 1.0,
  description: "",
  is_active: true,
});

function openEdit(item: CreditUserTypeConfig) {
  editingType.value = item.user_type;
  form.value = {
    credit_multiplier: item.credit_multiplier,
    description: item.description,
    is_active: item.is_active,
  };
  modalVisible.value = true;
}

async function submitForm() {
  if (processing.value) return;
  // Client-side guard mirrors server validation: (0, 100].
  const m = Number(form.value.credit_multiplier);
  if (!Number.isFinite(m) || m <= 0 || m > 100) {
    toast.error("积分倍率必须在 0.01 到 100 之间");
    return;
  }

  processing.value = true;
  try {
    const payload: UpdateCreditUserTypeConfigRequest = {
      credit_multiplier: m,
      description: form.value.description,
      is_active: form.value.is_active,
    };
    await updateCreditUserTypeConfigApi(editingType.value, payload);
    toast.success("已保存");
    modalVisible.value = false;
    await fetchItems();
  } catch (e) {
    toast.error((e as Error).message || "保存失败");
  } finally {
    processing.value = false;
  }
}

async function toggleActive(item: CreditUserTypeConfig) {
  try {
    await updateCreditUserTypeConfigApi(item.user_type, {
      is_active: !item.is_active,
    });
    item.is_active = !item.is_active;
    toast.success(item.is_active ? "已启用" : "已禁用");
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  }
}

onMounted(fetchItems);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">用户类型积分倍率</h1>
        <p class="page-subtitle">
          按用户类型设置积分消耗倍率（&lt; 1 减慢消耗，1.00 = 正常，&gt; 1
          加快消耗）。订阅用户始终按 1.0 倍率扣费，无需配置。
        </p>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      empty-text="暂无用户类型倍率配置"
    >
      <template #cell-user_type="{ row }">
        <span class="label-badge">{{
          userTypeLabels[(row as CreditUserTypeConfig).user_type] ||
          (row as CreditUserTypeConfig).user_type
        }}</span>
      </template>

      <template #cell-credit_multiplier="{ value }">
        <span class="text-mono">{{ Number(value).toFixed(2) }}x</span>
      </template>

      <template #cell-description="{ value }">
        <span class="desc-cell">{{ value || "—" }}</span>
      </template>

      <template #cell-is_active="{ row }">
        <button
          class="toggle-btn"
          :class="{
            'toggle-btn--active': (row as CreditUserTypeConfig).is_active,
          }"
          :disabled="processing"
          @click.stop="toggleActive(row as CreditUserTypeConfig)"
        >
          {{ (row as CreditUserTypeConfig).is_active ? "已启用" : "已禁用" }}
        </button>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            @click.stop="openEdit(row as CreditUserTypeConfig)"
          >
            <Pencil :size="14" />
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Edit Modal -->
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
              编辑用户类型倍率 ·
              {{ userTypeLabels[editingType] || editingType }}
            </h3>

            <div class="form-stack">
              <div class="form-group">
                <label class="form-label">积分消耗倍率</label>
                <AppInput
                  v-model="form.credit_multiplier"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  placeholder="1.00"
                />
                <p class="form-hint">
                  例：体验用户填 0.5，让他们更慢消耗积分以充分体验产品
                </p>
              </div>

              <div class="form-group">
                <label class="form-label">说明</label>
                <AppInput v-model="form.description" placeholder="简要说明" />
              </div>

              <div class="form-group">
                <label class="form-label">
                  <input
                    v-model="form.is_active"
                    type="checkbox"
                    class="checkbox"
                  />
                  启用此倍率
                </label>
                <p class="form-hint">
                  禁用后该用户类型按 1.0 倍率扣费（与订阅用户一致）
                </p>
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
                保存
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.page {
  padding: var(--space-6);
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  margin: 0 0 var(--space-2) 0;
}

.page-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  max-width: 720px;
}

.error-alert {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-soft, var(--surface-low));
  color: var(--danger);
  border-radius: var(--radius-md);
}

.label-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(--surface-low);
  color: var(--text-secondary);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.desc-cell {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.toggle-btn {
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface-low);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.toggle-btn--active {
  background: var(--success-soft);
  color: var(--success);
  border-color: var(--success);
}

.toggle-btn:hover {
  opacity: 0.8;
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--space-4);
}

.modal-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0 0 var(--space-5) 0;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0;
}

.checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
