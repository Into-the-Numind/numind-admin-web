<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  getPricingRulesApi, createPricingRuleApi, updatePricingRuleApi, deletePricingRuleApi,
  getTiersApi, replaceTiersApi,
  type PricingRule, type UpdatePricingRuleRequest, type PricingRuleTier, type TierInput
} from '@/api/billing'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import {
  serviceTypeLabels, serviceTypeFormOptions, providerFormOptions, providerLabels,
  formatMarginRate
} from '@/constants/billingMaps'

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
  sell_input_price_per_mtok: number
  sell_output_price_per_mtok: number
  sell_price_per_call: number
  sell_price_per_gb: number
  is_active: boolean
}

const defaultForm: PricingForm = {
  service_type: '',
  provider: '',
  model: '',
  input_price_per_mtok: 0,
  output_price_per_mtok: 0,
  price_per_call: 0,
  price_per_gb: 0,
  sell_input_price_per_mtok: 0,
  sell_output_price_per_mtok: 0,
  sell_price_per_call: 0,
  sell_price_per_gb: 0,
  is_active: true
}

const form = ref<PricingForm>({ ...defaultForm })

// Delete confirm
const confirmVisible = ref(false)
const pendingDeleteId = ref(0)
const pendingDeleteName = ref('')

const columns: Column[] = [
  { key: 'service_type', title: '服务类型', width: '100px' },
  { key: 'provider', title: '供应商', width: '100px' },
  { key: 'model', title: '模型', width: '140px' },
  { key: 'billing_mode', title: '计费模式', width: '100px' },
  { key: 'input_price_per_mtok', title: '成本(输入/M)', width: '110px', align: 'right' },
  { key: 'output_price_per_mtok', title: '成本(输出/M)', width: '110px', align: 'right' },
  { key: 'price_per_call', title: '成本(每次)', width: '90px', align: 'right' },
  { key: 'price_per_gb', title: '成本(每GB)', width: '90px', align: 'right' },
  { key: 'sell_input_price_per_mtok', title: '售价(输入/M)', width: '110px', align: 'right' },
  { key: 'sell_output_price_per_mtok', title: '售价(输出/M)', width: '110px', align: 'right' },
  { key: 'sell_price_per_call', title: '售价(每次)', width: '90px', align: 'right' },
  { key: 'sell_price_per_gb', title: '售价(每GB)', width: '90px', align: 'right' },
  { key: 'margin', title: '毛利率', width: '80px', align: 'right' },
  { key: 'is_active', title: '状态', width: '70px' },
  { key: 'actions', title: '操作', width: '100px' }
]

function ruleMargin(rule: PricingRule): string {
  // Use token-based margin if available, otherwise per-call
  if (rule.input_price_per_mtok > 0 && rule.sell_input_price_per_mtok > 0) {
    return formatMarginRate(rule.input_price_per_mtok, rule.sell_input_price_per_mtok)
  }
  if (rule.price_per_call > 0 && rule.sell_price_per_call > 0) {
    return formatMarginRate(rule.price_per_call, rule.sell_price_per_call)
  }
  if (rule.price_per_gb > 0 && rule.sell_price_per_gb > 0) {
    return formatMarginRate(rule.price_per_gb, rule.sell_price_per_gb)
  }
  return '—'
}

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
  form.value = { ...defaultForm }
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
    sell_input_price_per_mtok: rule.sell_input_price_per_mtok,
    sell_output_price_per_mtok: rule.sell_output_price_per_mtok,
    sell_price_per_call: rule.sell_price_per_call,
    sell_price_per_gb: rule.sell_price_per_gb,
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
        sell_input_price_per_mtok: form.value.sell_input_price_per_mtok,
        sell_output_price_per_mtok: form.value.sell_output_price_per_mtok,
        sell_price_per_call: form.value.sell_price_per_call,
        sell_price_per_gb: form.value.sell_price_per_gb,
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
  pendingDeleteName.value = `${serviceTypeLabels[rule.service_type] || rule.service_type} / ${providerLabels[rule.provider] || rule.provider} / ${rule.model || '默认'}`
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

// 分段配置抽屉
const tierDrawerVisible = ref(false)
const tierRuleId = ref<number | null>(null)
const tierRuleName = ref('')
const tiers = ref<PricingRuleTier[]>([])
const tierLoading = ref(false)
const tierSaving = ref(false)

async function openTierDrawer(rule: PricingRule) {
  tierRuleId.value = rule.id
  tierRuleName.value = `${rule.provider} / ${rule.model || rule.service_type}`
  tierDrawerVisible.value = true
  tierLoading.value = true
  try {
    tiers.value = await getTiersApi(rule.id)
  } catch (e) {
    toast.error('加载分段失败')
  } finally {
    tierLoading.value = false
  }
}

function addTierRow(tokenType: 'input' | 'output') {
  tiers.value.push({
    id: 0, rule_id: tierRuleId.value!, token_type: tokenType,
    min_tokens: 0, max_tokens: null, cost_per_mtok: 0, sell_per_mtok: 0
  })
}

function removeTierRow(index: number) {
  tiers.value.splice(index, 1)
}

async function saveTiers() {
  if (!tierRuleId.value || tierSaving.value) return
  tierSaving.value = true
  try {
    const payload: TierInput[] = tiers.value.map(t => ({
      token_type: t.token_type, min_tokens: t.min_tokens,
      max_tokens: t.max_tokens, cost_per_mtok: t.cost_per_mtok, sell_per_mtok: t.sell_per_mtok
    }))
    await replaceTiersApi(tierRuleId.value, payload)
    toast.success('分段配置已保存')
    tierDrawerVisible.value = false
  } catch (e) {
    toast.error('保存失败')
  } finally {
    tierSaving.value = false
  }
}
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

      <template #cell-billing_mode="{ row }">
        <span v-if="(row as any).billing_mode === 'tiered_token'" class="label-badge label-badge--purple">分段计费</span>
        <span v-else class="label-badge">标准</span>
      </template>

      <template #cell-provider="{ row }">
        <span>{{ providerLabels[(row as PricingRule).provider] || (row as PricingRule).provider }}</span>
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

      <template #cell-sell_input_price_per_mtok="{ value }">
        <span class="text-mono text-sell">{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #cell-sell_output_price_per_mtok="{ value }">
        <span class="text-mono text-sell">{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #cell-sell_price_per_call="{ value }">
        <span class="text-mono text-sell">{{ Number(value).toFixed(4) }}</span>
      </template>

      <template #cell-sell_price_per_gb="{ value }">
        <span class="text-mono text-sell">{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #cell-margin="{ row }">
        <span class="text-mono text-margin">{{ ruleMargin(row as PricingRule) }}</span>
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
          <button
            v-if="(row as any).billing_mode === 'tiered_token'"
            @click.stop="openTierDrawer(row as PricingRule)"
            class="text-purple-600 hover:text-purple-800 text-sm"
          >
            分段配置
          </button>
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

              <!-- 成本价 Section -->
              <div class="form-group form-group--full">
                <div class="form-section-header">成本价</div>
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

              <!-- 售价 Section -->
              <div class="form-group form-group--full">
                <div class="form-section-header">售价</div>
              </div>
              <div class="form-group">
                <label class="form-label">输入售价 (分/百万Token)</label>
                <input v-model.number="form.sell_input_price_per_mtok" type="number" step="0.01" class="num-input" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">输出售价 (分/百万Token)</label>
                <input v-model.number="form.sell_output_price_per_mtok" type="number" step="0.01" class="num-input" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">单次调用售价 (分)</label>
                <input v-model.number="form.sell_price_per_call" type="number" step="0.0001" class="num-input" placeholder="0" />
              </div>
              <div class="form-group">
                <label class="form-label">GB 售价 (分)</label>
                <input v-model.number="form.sell_price_per_gb" type="number" step="0.01" class="num-input" placeholder="0" />
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

    <!-- 分段配置抽屉 -->
    <Teleport to="body">
      <div v-if="tierDrawerVisible" class="fixed inset-0 z-50 flex justify-end">
        <div class="fixed inset-0 bg-black/40" @click="tierDrawerVisible = false" />
        <div class="relative w-[640px] bg-white h-full shadow-xl flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <div class="font-semibold">分段定价配置</div>
              <div class="text-sm text-gray-500">{{ tierRuleName }}</div>
            </div>
            <button @click="tierDrawerVisible = false" class="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="tierLoading" class="text-center py-12 text-gray-400">加载中...</div>
            <template v-else>
              <!-- 输入分段 -->
              <div class="mb-6">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-medium text-sm">输入 Token 分段</h3>
                  <button @click="addTierRow('input')" class="text-sm text-blue-600 hover:underline">+ 添加区间</button>
                </div>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-gray-500 text-xs">
                      <th class="text-left pb-2">最小 Token（含）</th>
                      <th class="text-left pb-2">最大 Token（含，空=不限）</th>
                      <th class="text-left pb-2">成本价（元/MTok）</th>
                      <th class="text-left pb-2">售价（元/MTok）</th>
                      <th class="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in tiers.filter(x => x.token_type === 'input')" :key="tiers.indexOf(t)" class="border-t">
                      <td class="py-2 pr-2"><input type="number" v-model.number="t.min_tokens" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2 pr-2"><input type="number" v-model.number="t.max_tokens" placeholder="不限" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2 pr-2"><input type="number" step="0.0001" v-model.number="t.cost_per_mtok" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2 pr-2"><input type="number" step="0.0001" v-model.number="t.sell_per_mtok" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2"><button @click="removeTierRow(tiers.indexOf(t))" class="text-red-400 hover:text-red-600">删除</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 输出分段 -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-medium text-sm">输出 Token 分段</h3>
                  <button @click="addTierRow('output')" class="text-sm text-blue-600 hover:underline">+ 添加区间</button>
                </div>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-gray-500 text-xs">
                      <th class="text-left pb-2">最小 Token（含）</th>
                      <th class="text-left pb-2">最大 Token（含，空=不限）</th>
                      <th class="text-left pb-2">成本价（元/MTok）</th>
                      <th class="text-left pb-2">售价（元/MTok）</th>
                      <th class="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in tiers.filter(x => x.token_type === 'output')" :key="tiers.indexOf(t)" class="border-t">
                      <td class="py-2 pr-2"><input type="number" v-model.number="t.min_tokens" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2 pr-2"><input type="number" v-model.number="t.max_tokens" placeholder="不限" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2 pr-2"><input type="number" step="0.0001" v-model.number="t.cost_per_mtok" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2 pr-2"><input type="number" step="0.0001" v-model.number="t.sell_per_mtok" class="w-full border rounded px-2 py-1" /></td>
                      <td class="py-2"><button @click="removeTierRow(tiers.indexOf(t))" class="text-red-400 hover:text-red-600">删除</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>

          <div class="px-6 py-4 border-t flex justify-end gap-3">
            <button @click="tierDrawerVisible = false" class="px-4 py-2 border rounded text-sm">取消</button>
            <button @click="saveTiers" :disabled="tierSaving" class="px-4 py-2 bg-purple-600 text-white rounded text-sm disabled:opacity-50">
              {{ tierSaving ? '保存中...' : '保存分段' }}
            </button>
          </div>
        </div>
      </div>
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

.label-badge--purple {
  background: #EDE9FE;
  color: #7C3AED;
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.text-sell {
  color: var(--primary);
}

.text-margin {
  color: var(--success);
  font-weight: 600;
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
  max-width: 600px;
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

.form-section-header {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--gray-200);
  margin-top: var(--space-2);
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
