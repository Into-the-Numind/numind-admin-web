<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  getPricingRulesApi, createPricingRuleApi, updatePricingRuleApi, deletePricingRuleApi,
  type PricingRule, type UpdatePricingRuleRequest
} from '@/api/billing'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { serviceTypeLabels, serviceTypeFormOptions, providerFormOptions } from '@/constants/billingMaps'

const toast = useToast()
const rules = ref<PricingRule[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')
const processing = ref(false)

// Modal
const modalVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
interface PricingForm {
  service_type: string
  provider: string
  model: string
  input_price_per_mtok: number
  output_price_per_mtok: number
  price_per_call: number
  price_per_gb: number
  is_active: boolean
}

const form = ref<PricingForm>({
  service_type: '',
  provider: '',
  model: '',
  input_price_per_mtok: 0,
  output_price_per_mtok: 0,
  price_per_call: 0,
  price_per_gb: 0,
  is_active: true
})

// Delete confirm
const confirmVisible = ref(false)
const pendingDeleteId = ref(0)
const pendingDeleteName = ref('')

const columns: Column[] = [
  { key: 'service_type', title: '服务类型', width: '110px' },
  { key: 'provider', title: '供应商', width: '100px' },
  { key: 'model', title: '模型', width: '160px' },
  { key: 'input_price_per_mtok', title: '输入价/百万Token', width: '140px', align: 'right' },
  { key: 'output_price_per_mtok', title: '输出价/百万Token', width: '140px', align: 'right' },
  { key: 'price_per_call', title: '单次价格(分)', width: '110px', align: 'right' },
  { key: 'price_per_gb', title: 'GB价格(分)', width: '110px', align: 'right' },
  { key: 'is_active', title: '状态', width: '80px' },
  { key: 'actions', title: '操作', width: '120px' }
]


async function fetchRules() {
  loading.value = true
  error.value = ''
  try {
    const res = await getPricingRulesApi({
      offset: (page.value - 1) * pageSize,
      limit: pageSize
    })
    rules.value = res.rules
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载定价规则失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEdit.value = false
  editingId.value = 0
  form.value = {
    service_type: '',
    provider: '',
    model: '',
    input_price_per_mtok: 0,
    output_price_per_mtok: 0,
    price_per_call: 0,
    price_per_gb: 0,
    is_active: true
  }
  modalVisible.value = true
}

function openEdit(rule: PricingRule) {
  isEdit.value = true
  editingId.value = rule.id
  form.value = {
    service_type: rule.service_type,
    provider: rule.provider,
    model: rule.model,
    input_price_per_mtok: rule.input_price_per_mtok,
    output_price_per_mtok: rule.output_price_per_mtok,
    price_per_call: rule.price_per_call,
    price_per_gb: rule.price_per_gb,
    is_active: rule.is_active
  }
  modalVisible.value = true
}

async function submitForm() {
  if (processing.value) return
  if (!form.value.service_type || !form.value.provider) {
    toast.error('服务类型和供应商为必填项')
    return
  }
  processing.value = true
  try {
    if (isEdit.value) {
      const updates: UpdatePricingRuleRequest = {
        service_type: form.value.service_type,
        provider: form.value.provider,
        model: form.value.model,
        input_price_per_mtok: form.value.input_price_per_mtok,
        output_price_per_mtok: form.value.output_price_per_mtok,
        price_per_call: form.value.price_per_call,
        price_per_gb: form.value.price_per_gb,
        is_active: form.value.is_active
      }
      await updatePricingRuleApi(editingId.value, updates)
      toast.success('定价规则已更新')
    } else {
      await createPricingRuleApi(form.value)
      toast.success('定价规则已创建')
    }
    modalVisible.value = false
    await fetchRules()
  } catch (e) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    processing.value = false
  }
}

function confirmDelete(rule: PricingRule) {
  pendingDeleteId.value = rule.id
  pendingDeleteName.value = `${serviceTypeLabels[rule.service_type] || rule.service_type} / ${rule.provider} / ${rule.model || '默认'}`
  confirmVisible.value = true
}

async function executeDelete() {
  if (processing.value) return
  processing.value = true
  try {
    await deletePricingRuleApi(pendingDeleteId.value)
    confirmVisible.value = false
    toast.success('定价规则已删除')
    await fetchRules()
  } catch (e) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    processing.value = false
  }
}

async function toggleActive(rule: PricingRule) {
  try {
    await updatePricingRuleApi(rule.id, { is_active: !rule.is_active })
    rule.is_active = !rule.is_active
    toast.success(rule.is_active ? '已启用' : '已禁用')
  } catch (e) {
    toast.error((e as Error).message || '操作失败')
  }
}

watch(page, fetchRules)
onMounted(fetchRules)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">定价管理</h1>
      <AppButton variant="primary" @click="openCreate">
        <Plus :size="16" />
        新建规则
      </AppButton>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="rules"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event"
    >
      <template #cell-service_type="{ row }">
        <span class="label-badge">{{ serviceTypeLabels[(row as PricingRule).service_type] || (row as PricingRule).service_type }}</span>
      </template>

      <template #cell-input_price_per_mtok="{ value }">
        <span class="text-mono">{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #cell-output_price_per_mtok="{ value }">
        <span class="text-mono">{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #cell-price_per_call="{ value }">
        <span class="text-mono">{{ Number(value).toFixed(4) }}</span>
      </template>

      <template #cell-price_per_gb="{ value }">
        <span class="text-mono">{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #cell-is_active="{ row }">
        <button
          class="toggle-btn"
          :class="{ 'toggle-btn--active': (row as PricingRule).is_active }"
          @click.stop="toggleActive(row as PricingRule)"
        >
          {{ (row as PricingRule).is_active ? '启用' : '禁用' }}
        </button>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton size="sm" variant="ghost" :disabled="processing" @click.stop="openEdit(row as PricingRule)">
            <Pencil :size="14" />
          </AppButton>
          <AppButton size="sm" variant="ghost" :disabled="processing" @click.stop="confirmDelete(row as PricingRule)">
            <Trash2 :size="14" style="color: var(--danger);" />
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Delete Confirm -->
    <ConfirmModal
      :visible="confirmVisible"
      title="删除定价规则"
      :message="`确定要删除定价规则「${pendingDeleteName}」吗？此操作不可撤销。`"
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
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <h3 class="modal-title">{{ isEdit ? '编辑定价规则' : '新建定价规则' }}</h3>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">服务类型 *</label>
                <AppSelect v-model="form.service_type" :options="serviceTypeFormOptions" placeholder="选择服务类型" />
              </div>
              <div class="form-group">
                <label class="form-label">供应商 *</label>
                <AppSelect v-model="form.provider" :options="providerFormOptions" placeholder="选择供应商" />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">模型</label>
                <AppInput v-model="form.model" placeholder="模型名称（留空为默认规则）" />
              </div>
              <div class="form-group">
                <label class="form-label">输入价格 (分/百万Token)</label>
                <input v-model.number="form.input_price_per_mtok" type="number" step="0.01" class="num-input" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">输出价格 (分/百万Token)</label>
                <input v-model.number="form.output_price_per_mtok" type="number" step="0.01" class="num-input" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">单次调用价格 (分)</label>
                <input v-model.number="form.price_per_call" type="number" step="0.0001" class="num-input" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">GB 价格 (分)</label>
                <input v-model.number="form.price_per_gb" type="number" step="0.01" class="num-input" placeholder="0" />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">
                  <input v-model="form.is_active" type="checkbox" class="checkbox" />
                  启用此规则
                </label>
              </div>
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="modalVisible = false">取消</AppButton>
              <AppButton variant="primary" :loading="processing" @click="submitForm">
                {{ isEdit ? '保存' : '创建' }}
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

.label-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(--gray-100);
  color: var(--text-secondary);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
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
  background: var(--success-light, #DCFCE7);
  color: var(--success, #16A34A);
  border-color: var(--success, #16A34A);
}

.toggle-btn:hover {
  opacity: 0.8;
}

.modal-card--wide {
  max-width: 560px;
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

.num-input {
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

.num-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}
</style>
