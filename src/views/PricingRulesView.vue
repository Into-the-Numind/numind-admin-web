<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import {
  getPricingRulesApi,
  createPricingRuleApi,
  updatePricingRuleApi,
  deletePricingRuleApi,
  getTiersApi,
  replaceTiersApi,
  type PricingRule,
  type UpdatePricingRuleRequest,
  type PricingRuleTier,
  type TierInput,
} from "@/api/billing";
import { listServicesApi } from "@/api/ai";
import type { AIService } from "@/types/ai";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { Plus, Pencil, Trash2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import {
  serviceTypeLabels,
  serviceTypeFormOptions,
  providerFormOptions,
  providerLabels,
  formatMarginRate,
} from "@/constants/billingMaps";

const toast = useToast();
const route = useRoute();
const rules = ref<PricingRule[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");
const processing = ref(false);

// ====== AI Services for association display & filter ======
const allServices = ref<AIService[]>([]);

/**
 * Coarse service_type mapping:
 *   ai_service.service_type is coarse: "llm" | "ocr" | "asr" | "embedding" | "rerank"
 *   pricing_rule.service_type is fine: "llm_chat" | "llm_vision" | "embedding" | "rerank" | "ocr" | "asr" | ...
 * For matching we map rule.service_type → coarse type, then match ai_service.service_type + model_key == rule.model
 * Provider matching is approximate (best-effort, no route data in list response).
 */
const FINE_TO_COARSE: Record<string, string> = {
  llm_chat: "llm",
  llm_vision: "llm",
  // Add future fine types here; others map 1:1 via fallback.
};

function ruleCoarseType(rule: PricingRule): string {
  return FINE_TO_COARSE[rule.service_type] ?? rule.service_type;
}

function getMatchedServices(rule: PricingRule): AIService[] {
  const coarse = ruleCoarseType(rule);
  return allServices.value.filter((svc) => {
    if (svc.service_type !== coarse) return false;
    // model_key match (empty rule.model = wildcard/default rule, matches all services of that type)
    if (!rule.model) return true;
    return svc.model_key === rule.model;
  });
}

// Filter: selected service id (0 = all)
const selectedServiceId = ref<number>(0);

const serviceFilterOptions = computed(() => {
  const opts: { label: string; value: number }[] = [
    { label: "全部 AI 服务", value: 0 },
  ];
  for (const svc of allServices.value) {
    opts.push({ label: svc.display_name, value: svc.id });
  }
  return opts;
});

const displayedRules = computed(() => {
  if (selectedServiceId.value === 0) return rules.value;
  const target = allServices.value.find(
    (s) => s.id === selectedServiceId.value,
  );
  if (!target) return rules.value;
  return rules.value.filter((rule) => {
    const matched = getMatchedServices(rule);
    return matched.some((s) => s.id === selectedServiceId.value);
  });
});

/**
 * Pre-computed Map<ruleId, AIService[]> so the template never calls
 * getMatchedServices() more than once per rule per render cycle.
 */
const matchedByRuleId = computed<Map<number, AIService[]>>(() => {
  const map = new Map<number, AIService[]>();
  for (const rule of rules.value) {
    map.set(rule.id, getMatchedServices(rule));
  }
  return map;
});

async function fetchServices() {
  try {
    const res = await listServicesApi({
      page: 1,
      page_size: 200,
      status: "active",
    });
    allServices.value = res.list ?? [];
  } catch {
    // non-critical — association display degrades gracefully
  }
}

// Modal
const modalVisible = ref(false);
const isEdit = ref(false);
const editingId = ref(0);
interface PricingForm {
  service_type: string;
  provider: string;
  model: string;
  billing_mode: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  price_per_call: number;
  price_per_gb: number;
  sell_input_price_per_mtok: number;
  sell_output_price_per_mtok: number;
  sell_price_per_call: number;
  sell_price_per_gb: number;
  is_active: boolean;
}

const billingModeOptions = [
  { label: "标准（固定单价）", value: "flat" },
  { label: "分段计费（阶梯价）", value: "tiered_token" },
];

const defaultForm: PricingForm = {
  service_type: "",
  provider: "",
  model: "",
  billing_mode: "flat",
  input_price_per_mtok: 0,
  output_price_per_mtok: 0,
  price_per_call: 0,
  price_per_gb: 0,
  sell_input_price_per_mtok: 0,
  sell_output_price_per_mtok: 0,
  sell_price_per_call: 0,
  sell_price_per_gb: 0,
  is_active: true,
};

const form = ref<PricingForm>({ ...defaultForm });

// Delete confirm
const confirmVisible = ref(false);
const pendingDeleteId = ref(0);
const pendingDeleteName = ref("");

const columns: Column[] = [
  { key: "service_type", title: "服务类型", width: "100px" },
  { key: "provider", title: "供应商", width: "100px" },
  { key: "model", title: "模型", width: "140px" },
  { key: "billing_mode", title: "计费模式", width: "100px" },
  {
    key: "input_price_per_mtok",
    title: "成本(输入/M)",
    width: "110px",
    align: "right",
  },
  {
    key: "output_price_per_mtok",
    title: "成本(输出/M)",
    width: "110px",
    align: "right",
  },
  { key: "price_per_call", title: "成本(每次)", width: "90px", align: "right" },
  { key: "price_per_gb", title: "成本(每GB)", width: "90px", align: "right" },
  {
    key: "sell_input_price_per_mtok",
    title: "售价(输入/M)",
    width: "110px",
    align: "right",
  },
  {
    key: "sell_output_price_per_mtok",
    title: "售价(输出/M)",
    width: "110px",
    align: "right",
  },
  {
    key: "sell_price_per_call",
    title: "售价(每次)",
    width: "90px",
    align: "right",
  },
  {
    key: "sell_price_per_gb",
    title: "售价(每GB)",
    width: "90px",
    align: "right",
  },
  { key: "margin", title: "毛利率", width: "80px", align: "right" },
  { key: "associated_services", title: "关联 AI 服务", width: "180px" },
  { key: "is_active", title: "状态", width: "70px" },
  { key: "actions", title: "操作", width: "100px" },
];

function ruleMargin(rule: PricingRule): string {
  // Use token-based margin if available, otherwise per-call
  if (rule.input_price_per_mtok > 0 && rule.sell_input_price_per_mtok > 0) {
    return formatMarginRate(
      rule.input_price_per_mtok,
      rule.sell_input_price_per_mtok,
    );
  }
  if (rule.price_per_call > 0 && rule.sell_price_per_call > 0) {
    return formatMarginRate(rule.price_per_call, rule.sell_price_per_call);
  }
  if (rule.price_per_gb > 0 && rule.sell_price_per_gb > 0) {
    return formatMarginRate(rule.price_per_gb, rule.sell_price_per_gb);
  }
  return "—";
}

async function fetchRules() {
  loading.value = true;
  error.value = "";
  try {
    const res = await getPricingRulesApi({
      offset: (page.value - 1) * pageSize,
      limit: pageSize,
    });
    rules.value = res.rules;
    total.value = res.total;
  } catch (e) {
    error.value = (e as Error).message || "加载定价规则失败";
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

function openEdit(rule: PricingRule) {
  isEdit.value = true;
  editingId.value = rule.id;
  form.value = {
    service_type: rule.service_type,
    provider: rule.provider,
    model: rule.model,
    billing_mode: (rule as any).billing_mode || "flat",
    input_price_per_mtok: rule.input_price_per_mtok,
    output_price_per_mtok: rule.output_price_per_mtok,
    price_per_call: rule.price_per_call,
    price_per_gb: rule.price_per_gb,
    sell_input_price_per_mtok: rule.sell_input_price_per_mtok,
    sell_output_price_per_mtok: rule.sell_output_price_per_mtok,
    sell_price_per_call: rule.sell_price_per_call,
    sell_price_per_gb: rule.sell_price_per_gb,
    is_active: rule.is_active,
  };
  modalVisible.value = true;
}

async function submitForm() {
  if (processing.value) return;
  if (!form.value.service_type || !form.value.provider) {
    toast.error("服务类型和供应商为必填项");
    return;
  }
  processing.value = true;
  try {
    if (isEdit.value) {
      const updates: UpdatePricingRuleRequest = {
        service_type: form.value.service_type,
        provider: form.value.provider,
        model: form.value.model,
        billing_mode: form.value.billing_mode,
        input_price_per_mtok: form.value.input_price_per_mtok,
        output_price_per_mtok: form.value.output_price_per_mtok,
        price_per_call: form.value.price_per_call,
        price_per_gb: form.value.price_per_gb,
        sell_input_price_per_mtok: form.value.sell_input_price_per_mtok,
        sell_output_price_per_mtok: form.value.sell_output_price_per_mtok,
        sell_price_per_call: form.value.sell_price_per_call,
        sell_price_per_gb: form.value.sell_price_per_gb,
        is_active: form.value.is_active,
      };
      await updatePricingRuleApi(editingId.value, updates);
      toast.success("定价规则已更新");
    } else {
      await createPricingRuleApi(form.value);
      toast.success("定价规则已创建");
    }
    modalVisible.value = false;
    await fetchRules();
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    processing.value = false;
  }
}

function confirmDelete(rule: PricingRule) {
  pendingDeleteId.value = rule.id;
  pendingDeleteName.value = `${serviceTypeLabels[rule.service_type] || rule.service_type} / ${providerLabels[rule.provider] || rule.provider} / ${rule.model || "默认"}`;
  confirmVisible.value = true;
}

async function executeDelete() {
  if (processing.value) return;
  processing.value = true;
  try {
    await deletePricingRuleApi(pendingDeleteId.value);
    confirmVisible.value = false;
    toast.success("定价规则已删除");
    await fetchRules();
  } catch (e) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    processing.value = false;
  }
}

async function toggleActive(rule: PricingRule) {
  try {
    await updatePricingRuleApi(rule.id, { is_active: !rule.is_active });
    rule.is_active = !rule.is_active;
    toast.success(rule.is_active ? "已启用" : "已禁用");
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  }
}

watch(page, fetchRules);
onMounted(async () => {
  await Promise.all([fetchRules(), fetchServices()]);
  // Support ?service_id=X deep-link from ServiceEdit pricing rule card
  const qsid = route.query.service_id;
  if (qsid) {
    const parsed = Number(qsid);
    if (!Number.isNaN(parsed) && parsed > 0) {
      selectedServiceId.value = parsed;
    }
  }
});

// 分段配置抽屉
const tierDrawerVisible = ref(false);
const tierRuleId = ref<number | null>(null);
const tierRuleName = ref("");
const tiers = ref<PricingRuleTier[]>([]);
const tierLoading = ref(false);
const tierSaving = ref(false);

async function openTierDrawer(rule: PricingRule) {
  tierRuleId.value = rule.id;
  tierRuleName.value = `${rule.provider} / ${rule.model || rule.service_type}`;
  tierDrawerVisible.value = true;
  tierLoading.value = true;
  try {
    tiers.value = await getTiersApi(rule.id);
  } catch (e) {
    toast.error("加载分段失败");
  } finally {
    tierLoading.value = false;
  }
}

function addTierRow(tokenType: "input" | "output") {
  tiers.value.push({
    id: 0,
    rule_id: tierRuleId.value!,
    token_type: tokenType,
    min_tokens: 0,
    max_tokens: null,
    cost_per_mtok: 0,
    sell_per_mtok: 0,
  });
}

function removeTierRow(index: number) {
  tiers.value.splice(index, 1);
}

async function saveTiers() {
  if (!tierRuleId.value || tierSaving.value) return;
  tierSaving.value = true;
  try {
    const payload: TierInput[] = tiers.value.map((t) => ({
      token_type: t.token_type,
      min_tokens: t.min_tokens,
      max_tokens: t.max_tokens,
      cost_per_mtok: t.cost_per_mtok,
      sell_per_mtok: t.sell_per_mtok,
    }));
    await replaceTiersApi(tierRuleId.value, payload);
    toast.success("分段配置已保存");
    tierDrawerVisible.value = false;
  } catch (e) {
    toast.error("保存失败");
  } finally {
    tierSaving.value = false;
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <p class="page-breadcrumb">Billing / Pricing Rules</p>
      <h1 class="page-title">定价管理</h1>
      <div class="page-header-actions">
        <div class="filter-group">
          <label class="sr-only">按 AI 服务筛选</label>
          <AppSelect
            v-model="selectedServiceId"
            :options="serviceFilterOptions"
            placeholder="按 AI 服务筛选"
            size="sm"
          />
          <p
            v-if="selectedServiceId > 0 && total > rules.length"
            class="form-hint"
          >
            注：当前筛选仅对本页 {{ rules.length }} 条生效，其他页未加载
          </p>
        </div>
        <AppButton variant="primary" @click="openCreate">
          <Plus :size="16" />
          新建规则
        </AppButton>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="displayedRules"
      :loading="loading"
      :total="selectedServiceId > 0 ? displayedRules.length : total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event"
    >
      <template #cell-service_type="{ row }">
        <span class="label-badge">{{
          serviceTypeLabels[(row as PricingRule).service_type] ||
          (row as PricingRule).service_type
        }}</span>
      </template>

      <template #cell-billing_mode="{ row }">
        <span
          v-if="(row as any).billing_mode === 'tiered_token'"
          class="label-badge label-badge--accent"
          >分段计费</span
        >
        <span v-else class="label-badge">标准</span>
      </template>

      <template #cell-provider="{ row }">
        <span>{{
          providerLabels[(row as PricingRule).provider] ||
          (row as PricingRule).provider
        }}</span>
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
        <span class="text-mono text-margin">{{
          ruleMargin(row as PricingRule)
        }}</span>
      </template>

      <template #cell-associated_services="{ row }">
        <div class="assoc-services">
          <template
            v-if="
              (matchedByRuleId.get((row as PricingRule).id) ?? []).length === 0
            "
          >
            <span class="assoc-empty">— 无关联服务</span>
          </template>
          <template v-else>
            <span
              v-for="svc in (
                matchedByRuleId.get((row as PricingRule).id) ?? []
              ).slice(0, 3)"
              :key="svc.id"
              class="assoc-badge"
              :title="svc.model_key"
              >{{ svc.display_name }}</span
            >
            <span
              v-if="
                (matchedByRuleId.get((row as PricingRule).id) ?? []).length > 3
              "
              class="assoc-more"
              :title="
                (matchedByRuleId.get((row as PricingRule).id) ?? [])
                  .slice(3)
                  .map((s) => s.display_name)
                  .join(', ')
              "
              >+{{
                (matchedByRuleId.get((row as PricingRule).id) ?? []).length - 3
              }}
              更多</span
            >
          </template>
        </div>
      </template>

      <template #cell-is_active="{ row }">
        <button
          class="toggle-btn"
          :class="{ 'toggle-btn--active': (row as PricingRule).is_active }"
          @click.stop="toggleActive(row as PricingRule)"
        >
          {{ (row as PricingRule).is_active ? "启用" : "禁用" }}
        </button>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            v-if="(row as any).billing_mode === 'tiered_token'"
            size="sm"
            variant="ghost"
            @click.stop="openTierDrawer(row as PricingRule)"
          >
            分段配置
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            @click.stop="openEdit(row as PricingRule)"
          >
            <Pencil :size="14" />
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            @click.stop="confirmDelete(row as PricingRule)"
          >
            <Trash2 :size="14" style="color: var(--danger)" />
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
          <div
            class="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
          >
            <h3 class="modal-title">
              {{ isEdit ? "编辑定价规则" : "新建定价规则" }}
            </h3>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">服务类型 *</label>
                <AppSelect
                  v-model="form.service_type"
                  :options="serviceTypeFormOptions"
                  placeholder="选择服务类型"
                />
              </div>
              <div class="form-group">
                <label class="form-label">供应商 *</label>
                <AppSelect
                  v-model="form.provider"
                  :options="providerFormOptions"
                  placeholder="选择供应商"
                />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">模型</label>
                <AppInput
                  v-model="form.model"
                  placeholder="模型名称（留空为默认规则）"
                />
              </div>
              <div class="form-group form-group--full">
                <label class="form-label">计费模式</label>
                <AppSelect
                  v-model="form.billing_mode"
                  :options="billingModeOptions"
                />
                <p
                  v-if="form.billing_mode === 'tiered_token'"
                  class="form-hint"
                >
                  选择分段计费后，保存规则，然后在列表中点击「分段配置」按钮设置各区间价格。
                </p>
              </div>

              <!-- 成本价 Section -->
              <div class="form-group form-group--full">
                <div class="form-section-header">成本价</div>
              </div>
              <div class="form-group">
                <label class="form-label">输入价格 (分/百万Token)</label>
                <AppInput
                  v-model="form.input_price_per_mtok"
                  type="number"
                  step="0.01"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">输出价格 (分/百万Token)</label>
                <AppInput
                  v-model="form.output_price_per_mtok"
                  type="number"
                  step="0.01"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">单次调用价格 (分)</label>
                <AppInput
                  v-model="form.price_per_call"
                  type="number"
                  step="0.0001"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">GB 价格 (分)</label>
                <AppInput
                  v-model="form.price_per_gb"
                  type="number"
                  step="0.01"
                  placeholder="0"
                />
              </div>

              <!-- 售价 Section -->
              <div class="form-group form-group--full">
                <div class="form-section-header">售价</div>
              </div>
              <div class="form-group">
                <label class="form-label">输入售价 (分/百万Token)</label>
                <AppInput
                  v-model="form.sell_input_price_per_mtok"
                  type="number"
                  step="0.01"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">输出售价 (分/百万Token)</label>
                <AppInput
                  v-model="form.sell_output_price_per_mtok"
                  type="number"
                  step="0.01"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">单次调用售价 (分)</label>
                <AppInput
                  v-model="form.sell_price_per_call"
                  type="number"
                  step="0.0001"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">GB 售价 (分)</label>
                <AppInput
                  v-model="form.sell_price_per_gb"
                  type="number"
                  step="0.01"
                  placeholder="0"
                />
              </div>

              <div class="form-group form-group--full">
                <label class="form-label">
                  <input
                    v-model="form.is_active"
                    type="checkbox"
                    class="checkbox"
                  />
                  启用此规则
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

    <!-- 分段配置抽屉 -->
    <Teleport to="body">
      <div v-if="tierDrawerVisible" class="drawer-overlay">
        <div class="drawer-backdrop" @click="tierDrawerVisible = false" />
        <div class="drawer-panel">
          <div class="drawer-header">
            <div>
              <div class="drawer-title">分段定价配置</div>
              <div class="drawer-subtitle">{{ tierRuleName }}</div>
            </div>
            <button class="drawer-close" @click="tierDrawerVisible = false">
              ✕
            </button>
          </div>

          <div class="drawer-body">
            <div v-if="tierLoading" class="drawer-loading">加载中...</div>
            <template v-else>
              <!-- 输入分段 -->
              <div class="tier-section">
                <div class="tier-section-header">
                  <h3 class="tier-section-title">输入 Token 分段</h3>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    @click="addTierRow('input')"
                  >
                    + 添加区间
                  </AppButton>
                </div>
                <table class="tier-table">
                  <thead>
                    <tr>
                      <th>最小 Token（含）</th>
                      <th>最大 Token（含，空=不限）</th>
                      <th>成本价（元/MTok）</th>
                      <th>售价（元/MTok）</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="t in tiers.filter((x) => x.token_type === 'input')"
                      :key="tiers.indexOf(t)"
                    >
                      <td>
                        <AppInput
                          v-model="t.min_tokens"
                          type="number"
                          size="sm"
                        />
                      </td>
                      <td>
                        <AppInput
                          v-model="t.max_tokens"
                          type="number"
                          size="sm"
                          placeholder="不限"
                        />
                      </td>
                      <td>
                        <AppInput
                          v-model="t.cost_per_mtok"
                          type="number"
                          step="0.0001"
                          size="sm"
                        />
                      </td>
                      <td>
                        <AppInput
                          v-model="t.sell_per_mtok"
                          type="number"
                          step="0.0001"
                          size="sm"
                        />
                      </td>
                      <td>
                        <AppButton
                          size="sm"
                          variant="ghost"
                          @click="removeTierRow(tiers.indexOf(t))"
                        >
                          <Trash2 :size="14" style="color: var(--danger)" />
                        </AppButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 输出分段 -->
              <div class="tier-section">
                <div class="tier-section-header">
                  <h3 class="tier-section-title">输出 Token 分段</h3>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    @click="addTierRow('output')"
                  >
                    + 添加区间
                  </AppButton>
                </div>
                <table class="tier-table">
                  <thead>
                    <tr>
                      <th>最小 Token（含）</th>
                      <th>最大 Token（含，空=不限）</th>
                      <th>成本价（元/MTok）</th>
                      <th>售价（元/MTok）</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="t in tiers.filter(
                        (x) => x.token_type === 'output',
                      )"
                      :key="tiers.indexOf(t)"
                    >
                      <td>
                        <AppInput
                          v-model="t.min_tokens"
                          type="number"
                          size="sm"
                        />
                      </td>
                      <td>
                        <AppInput
                          v-model="t.max_tokens"
                          type="number"
                          size="sm"
                          placeholder="不限"
                        />
                      </td>
                      <td>
                        <AppInput
                          v-model="t.cost_per_mtok"
                          type="number"
                          step="0.0001"
                          size="sm"
                        />
                      </td>
                      <td>
                        <AppInput
                          v-model="t.sell_per_mtok"
                          type="number"
                          step="0.0001"
                          size="sm"
                        />
                      </td>
                      <td>
                        <AppButton
                          size="sm"
                          variant="ghost"
                          @click="removeTierRow(tiers.indexOf(t))"
                        >
                          <Trash2 :size="14" style="color: var(--danger)" />
                        </AppButton>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>

          <div class="drawer-footer">
            <AppButton variant="secondary" @click="tierDrawerVisible = false">
              取消
            </AppButton>
            <AppButton
              variant="primary"
              :loading="tierSaving"
              @click="saveTiers"
            >
              保存分段
            </AppButton>
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
  flex-wrap: wrap;
  gap: var(--space-3);
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Associated services column */
.assoc-services {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.assoc-empty {
  font-size: var(--text-xs);
  color: var(--text-tertiary, var(--text-secondary));
  font-style: italic;
}

.assoc-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(
    --primary-container,
    color-mix(in srgb, var(--primary) 12%, transparent)
  );
  color: var(--on-primary-container, var(--primary));
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.assoc-more {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(--surface-low);
  color: var(--text-secondary);
  white-space: nowrap;
  cursor: default;
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

.label-badge--accent {
  background: var(--tertiary-container, var(--surface-low));
  color: var(--on-tertiary-container, var(--primary));
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

.form-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
}

.form-section-header {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
  margin-top: var(--space-2);
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

/* Drawer */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.drawer-panel {
  position: relative;
  width: 640px;
  max-width: 100vw;
  height: 100%;
  background: var(--surface-lowest);
  box-shadow: var(--shadow-xl, -4px 0 24px rgba(0, 0, 0, 0.15));
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border);
}

.drawer-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
}

.drawer-subtitle {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.drawer-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.drawer-close:hover {
  background: var(--surface-low);
  color: var(--text);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.drawer-loading {
  text-align: center;
  padding: var(--space-12) 0;
  color: var(--text-secondary);
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border);
}

/* Tier table */
.tier-section {
  margin-bottom: var(--space-6);
}

.tier-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.tier-section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.tier-table {
  width: 100%;
  font-size: var(--text-sm);
  border-collapse: collapse;
}

.tier-table th {
  text-align: left;
  padding-bottom: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tier-table td {
  padding: var(--space-2) var(--space-2) var(--space-2) 0;
  vertical-align: middle;
}

.tier-table tbody tr {
  border-top: 1px solid var(--border);
}
</style>
