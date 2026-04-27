<script setup lang="ts">
/**
 * ContextBudget.vue — Context Budget 管理页面
 *
 * Tabs:
 *   1. Token Profiles — list/create/update/deactivate，含 calibration metrics
 *   2. Budget Policies — 编辑 operation 级 policy（safe_ratio, reserved_output, fixed_overhead）
 *   3. Recent Events — 只读，列 context_budget_event 元数据（不含 prompt content）
 *   4. Preview — 发 preview 请求验证 service + policy 组合的可行性
 *
 * spec §7.1-7.4, §8.1
 */
import { ref, computed, onMounted, watch } from "vue";
import {
  listTokenProfilesApi,
  saveTokenProfileApi,
  updateTokenProfileApi,
  deleteTokenProfileApi,
  listTokenProfilesHistoryApi,
  listContextBudgetPoliciesApi,
  updateContextBudgetPolicyApi,
  listContextBudgetEventsApi,
  previewContextBudgetApi,
} from "@/api/ai";
import { listServicesApi } from "@/api/ai";
import type {
  TokenProfile,
  ContextBudgetPolicy,
  ContextBudgetEvent,
  PreviewContextBudgetResponse,
  AIService,
} from "@/types/ai";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";
import { History, Plus, Pencil, Trash2, X, Search } from "lucide-vue-next";

const toast = useToast();

// ====== Tab state ======
type TabKey = "profiles" | "policies" | "events" | "preview";
const activeTab = ref<TabKey>("profiles");
const tabs: { key: TabKey; label: string }[] = [
  { key: "profiles", label: "Token Profiles" },
  { key: "policies", label: "Budget Policies" },
  { key: "events", label: "Recent Events" },
  { key: "preview", label: "Preview" },
];

// ======================================================
// TAB 1: Token Profiles
// ======================================================

const profileLoading = ref(false);
const profileError = ref("");
const profiles = ref<TokenProfile[]>([]);
const profileTotal = ref(0);
const profilePage = ref(1);
const profilePageSize = 20;

// Filters
const profileFilterProvider = ref("");
const profileFilterModel = ref("");
const profileFilterServiceType = ref("");
const profileFilterActive = ref("active");

const profileColumns: Column[] = [
  { key: "provider", title: "Provider", width: "100px" },
  { key: "model", title: "Model", align: "left" },
  { key: "service_type", title: "类型", width: "110px" },
  { key: "version", title: "版本", width: "60px", align: "center" },
  {
    key: "safety_multiplier",
    title: "Safety ×",
    width: "90px",
    align: "right",
  },
  {
    key: "calibration_sample_count",
    title: "样本数",
    width: "80px",
    align: "right",
  },
  {
    key: "calibration_p50_abs_error",
    title: "P50 误差",
    width: "90px",
    align: "right",
  },
  {
    key: "calibration_p90_abs_error",
    title: "P90 误差",
    width: "90px",
    align: "right",
  },
  {
    key: "calibration_p99_under_ratio",
    title: "P99 低估率",
    width: "95px",
    align: "right",
  },
  { key: "is_active", title: "状态", width: "72px", align: "center" },
  { key: "updated_at", title: "更新时间", width: "150px" },
  { key: "actions", title: "操作", width: "130px", align: "right" },
];

const activeFilterOptions = [
  { label: "启用中", value: "active" },
  { label: "已停用", value: "inactive" },
  { label: "全部", value: "all" },
];

async function loadProfiles() {
  profileLoading.value = true;
  profileError.value = "";
  try {
    const res = await listTokenProfilesApi({
      provider: profileFilterProvider.value || undefined,
      model: profileFilterModel.value || undefined,
      service_type: profileFilterServiceType.value || undefined,
      is_active: profileFilterActive.value || undefined,
      page: profilePage.value,
      page_size: profilePageSize,
    });
    profiles.value =
      (res as unknown as { list: TokenProfile[]; total: number }).list ?? [];
    profileTotal.value =
      (res as unknown as { list: TokenProfile[]; total: number }).total ?? 0;
  } catch (e) {
    profileError.value = (e as Error).message || "加载失败";
    toast.error(profileError.value);
  } finally {
    profileLoading.value = false;
  }
}

function onProfilePageChange(p: number) {
  profilePage.value = p;
  loadProfiles();
}

// ---- Profile form modal (create / edit) ----
interface ProfileForm {
  provider: string;
  model: string;
  model_family: string;
  service_type: string;
  safety_multiplier: string;
  calibration_multiplier: string;
}

const profileModalVisible = ref(false);
const profileModalIsEdit = ref(false);
const profileEditingId = ref(0);
const profileForm = ref<ProfileForm>({
  provider: "",
  model: "",
  model_family: "",
  service_type: "llm_chat",
  safety_multiplier: "1.15",
  calibration_multiplier: "1.0",
});
const profileFormErrors = ref<Record<string, string>>({});
const profileSaving = ref(false);

const serviceTypeOptions = [
  { label: "llm_chat", value: "llm_chat" },
  { label: "llm_vision", value: "llm_vision" },
  { label: "llm_thinking", value: "llm_thinking" },
];

function openCreateProfile() {
  profileModalIsEdit.value = false;
  profileEditingId.value = 0;
  profileForm.value = {
    provider: "",
    model: "",
    model_family: "",
    service_type: "llm_chat",
    safety_multiplier: "1.15",
    calibration_multiplier: "1.0",
  };
  profileFormErrors.value = {};
  profileModalVisible.value = true;
}

function openEditProfile(p: TokenProfile) {
  profileModalIsEdit.value = true;
  profileEditingId.value = p.id;
  profileForm.value = {
    provider: p.provider,
    model: p.model,
    model_family: p.model_family ?? "",
    service_type: p.service_type,
    safety_multiplier: String(p.safety_multiplier),
    calibration_multiplier: String(p.calibration_multiplier),
  };
  profileFormErrors.value = {};
  profileModalVisible.value = true;
}

function validateProfileForm(): boolean {
  const errs: Record<string, string> = {};
  if (!profileForm.value.provider.trim()) errs.provider = "Provider 必填";
  if (!profileForm.value.model.trim()) errs.model = "Model 必填";
  if (!profileForm.value.service_type) errs.service_type = "服务类型必填";
  const sm = Number(profileForm.value.safety_multiplier);
  if (!Number.isFinite(sm) || sm <= 0) errs.safety_multiplier = "必须大于 0";
  const cm = Number(profileForm.value.calibration_multiplier);
  if (!Number.isFinite(cm) || cm <= 0)
    errs.calibration_multiplier = "必须大于 0";
  profileFormErrors.value = errs;
  return Object.keys(errs).length === 0;
}

function validateProfileFieldOnBlur(field: keyof ProfileForm) {
  const errs = { ...profileFormErrors.value };
  const val = profileForm.value[field];
  if (field === "provider" || field === "model" || field === "service_type") {
    errs[field] = (val as string).trim() ? "" : `${field} 必填`;
  }
  if (field === "safety_multiplier" || field === "calibration_multiplier") {
    const n = Number(val);
    errs[field] = Number.isFinite(n) && n > 0 ? "" : "必须大于 0";
  }
  profileFormErrors.value = errs;
}

async function submitProfileForm() {
  if (!validateProfileForm()) {
    toast.error("请检查表单必填项");
    return;
  }
  if (profileSaving.value) return;
  profileSaving.value = true;
  try {
    const payload = {
      provider: profileForm.value.provider.trim(),
      model: profileForm.value.model.trim(),
      model_family: profileForm.value.model_family.trim() || undefined,
      service_type: profileForm.value.service_type,
      safety_multiplier: Number(profileForm.value.safety_multiplier),
      calibration_multiplier: Number(profileForm.value.calibration_multiplier),
    };
    if (profileModalIsEdit.value) {
      await updateTokenProfileApi(profileEditingId.value, payload);
      toast.success("Token Profile 已更新（新版本）");
    } else {
      await saveTokenProfileApi(payload);
      toast.success("Token Profile 已创建");
    }
    profileModalVisible.value = false;
    await loadProfiles();
  } catch (e) {
    toast.error((e as Error).message || "保存失败");
  } finally {
    profileSaving.value = false;
  }
}

// ---- Delete profile ----
const profileDeleteConfirm = ref(false);
const profileDeleteTarget = ref<number | null>(null);
const profileDeleteInProgress = ref(false);

function promptDeleteProfile(id: number) {
  profileDeleteTarget.value = id;
  profileDeleteConfirm.value = true;
}

async function confirmDeleteProfile() {
  if (profileDeleteTarget.value == null) return;
  profileDeleteInProgress.value = true;
  try {
    await deleteTokenProfileApi(profileDeleteTarget.value);
    toast.success("Token Profile 已停用");
    await loadProfiles();
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    profileDeleteInProgress.value = false;
    profileDeleteConfirm.value = false;
    profileDeleteTarget.value = null;
  }
}

// ---- History drawer ----
const historyDrawerVisible = ref(false);
const historyLoading = ref(false);
const historyItems = ref<TokenProfile[]>([]);
const historyTarget = ref<TokenProfile | null>(null);

async function openHistoryDrawer(p: TokenProfile) {
  historyTarget.value = p;
  historyDrawerVisible.value = true;
  historyLoading.value = true;
  try {
    const res = await listTokenProfilesHistoryApi(
      p.provider,
      p.model,
      p.service_type,
    );
    historyItems.value =
      (res as unknown as { list: TokenProfile[] }).list ?? [];
  } catch (e) {
    toast.error((e as Error).message || "加载历史失败");
  } finally {
    historyLoading.value = false;
  }
}

// ======================================================
// TAB 2: Budget Policies
// ======================================================

const policyLoading = ref(false);
const policyError = ref("");
const policies = ref<ContextBudgetPolicy[]>([]);

const policyColumns: Column[] = [
  { key: "operation", title: "Operation", align: "left" },
  {
    key: "fixed_overhead_tokens",
    title: "固定开销 tokens",
    width: "145px",
    align: "right",
  },
  {
    key: "reserved_output_tokens",
    title: "保留输出 tokens",
    width: "145px",
    align: "right",
  },
  { key: "safe_ratio", title: "Safe Ratio", width: "100px", align: "right" },
  { key: "version", title: "版本", width: "60px", align: "center" },
  { key: "updated_at", title: "更新时间", width: "150px" },
  { key: "actions", title: "操作", width: "80px", align: "right" },
];

async function loadPolicies() {
  policyLoading.value = true;
  policyError.value = "";
  try {
    const res = await listContextBudgetPoliciesApi();
    policies.value =
      (res as unknown as { list: ContextBudgetPolicy[]; total: number }).list ??
      [];
  } catch (e) {
    policyError.value = (e as Error).message || "加载失败";
    toast.error(policyError.value);
  } finally {
    policyLoading.value = false;
  }
}

// ---- Policy edit modal ----
interface PolicyForm {
  fixed_overhead_tokens: string;
  reserved_output_tokens: string;
  safe_ratio: string;
}

const policyModalVisible = ref(false);
const policyEditingOperation = ref("");
const policyForm = ref<PolicyForm>({
  fixed_overhead_tokens: "512",
  reserved_output_tokens: "4096",
  safe_ratio: "0.85",
});
const policyFormErrors = ref<Record<string, string>>({});
const policySaving = ref(false);

function openEditPolicy(p: ContextBudgetPolicy) {
  policyEditingOperation.value = p.operation;
  policyForm.value = {
    fixed_overhead_tokens: String(p.fixed_overhead_tokens),
    reserved_output_tokens: String(p.reserved_output_tokens),
    safe_ratio: String(p.safe_ratio),
  };
  policyFormErrors.value = {};
  policyModalVisible.value = true;
}

function validatePolicyFieldOnBlur(field: keyof PolicyForm) {
  const errs = { ...policyFormErrors.value };
  const val = Number(policyForm.value[field]);
  if (field === "fixed_overhead_tokens" || field === "reserved_output_tokens") {
    errs[field] = Number.isInteger(val) && val >= 0 ? "" : "必须为非负整数";
  }
  if (field === "safe_ratio") {
    errs[field] =
      Number.isFinite(val) && val > 0 && val <= 1 ? "" : "必须在 0~1 之间";
  }
  policyFormErrors.value = errs;
}

function validatePolicyForm(): boolean {
  const errs: Record<string, string> = {};
  const fot = Number(policyForm.value.fixed_overhead_tokens);
  if (!Number.isInteger(fot) || fot < 0)
    errs.fixed_overhead_tokens = "必须为非负整数";
  const rot = Number(policyForm.value.reserved_output_tokens);
  if (!Number.isInteger(rot) || rot < 0)
    errs.reserved_output_tokens = "必须为非负整数";
  const sr = Number(policyForm.value.safe_ratio);
  if (!Number.isFinite(sr) || sr <= 0 || sr > 1)
    errs.safe_ratio = "必须在 0~1 之间";
  policyFormErrors.value = errs;
  return Object.keys(errs).length === 0;
}

async function submitPolicyForm() {
  if (!validatePolicyForm()) {
    toast.error("请检查表单");
    return;
  }
  if (policySaving.value) return;
  policySaving.value = true;
  try {
    await updateContextBudgetPolicyApi(policyEditingOperation.value, {
      fixed_overhead_tokens: Number(policyForm.value.fixed_overhead_tokens),
      reserved_output_tokens: Number(policyForm.value.reserved_output_tokens),
      safe_ratio: Number(policyForm.value.safe_ratio),
    });
    toast.success(`Policy [${policyEditingOperation.value}] 已更新`);
    policyModalVisible.value = false;
    await loadPolicies();
  } catch (e) {
    toast.error((e as Error).message || "保存失败");
  } finally {
    policySaving.value = false;
  }
}

// ======================================================
// TAB 3: Recent Events
// ======================================================

const eventLoading = ref(false);
const eventError = ref("");
const events = ref<ContextBudgetEvent[]>([]);
const eventTotal = ref(0);
const eventPage = ref(1);
const eventPageSize = 20;

const eventFilterOperation = ref("");
const eventFilterStatus = ref("");
const eventFilterProvider = ref("");

const eventColumns: Column[] = [
  { key: "id", title: "ID", width: "72px", align: "right" },
  { key: "operation", title: "Operation", width: "150px" },
  { key: "provider", title: "Provider", width: "90px" },
  { key: "model", title: "Model", align: "left" },
  { key: "status", title: "状态", width: "90px", align: "center" },
  {
    key: "estimated_before",
    title: "压缩前 tokens",
    width: "115px",
    align: "right",
  },
  {
    key: "estimated_after",
    title: "压缩后 tokens",
    width: "115px",
    align: "right",
  },
  {
    key: "safe_input_budget",
    title: "安全预算",
    width: "100px",
    align: "right",
  },
  {
    key: "dropped_fragment_count",
    title: "丢弃片段",
    width: "85px",
    align: "right",
  },
  { key: "created_at", title: "时间", width: "150px" },
];

const eventStatusOptions = [
  { label: "全部状态", value: "" },
  { label: "ok", value: "ok" },
  { label: "compressed", value: "compressed" },
  { label: "failed", value: "failed" },
  { label: "skipped", value: "skipped" },
];

function eventStatusVariant(
  status: string,
): "success" | "warning" | "danger" | "info" {
  if (status === "ok") return "success";
  if (status === "compressed") return "warning";
  if (status === "failed") return "danger";
  return "info";
}

async function loadEvents() {
  eventLoading.value = true;
  eventError.value = "";
  try {
    const res = await listContextBudgetEventsApi({
      operation: eventFilterOperation.value || undefined,
      status: eventFilterStatus.value || undefined,
      provider: eventFilterProvider.value || undefined,
      page: eventPage.value,
      page_size: eventPageSize,
    });
    events.value =
      (res as unknown as { list: ContextBudgetEvent[]; total: number }).list ??
      [];
    eventTotal.value =
      (res as unknown as { list: ContextBudgetEvent[]; total: number }).total ??
      0;
  } catch (e) {
    eventError.value = (e as Error).message || "加载失败";
    toast.error(eventError.value);
  } finally {
    eventLoading.value = false;
  }
}

function onEventPageChange(p: number) {
  eventPage.value = p;
  loadEvents();
}

// ======================================================
// TAB 4: Preview
// ======================================================

const services = ref<AIService[]>([]);
const servicesLoading = ref(false);

const previewForm = ref({
  service_id: "" as string | number,
  operation: "sop_run",
  fixed_overhead_tokens: "512",
  reserved_output_tokens: "4096",
  safe_ratio: "0.85",
});
const previewFormErrors = ref<Record<string, string>>({});
const previewLoading = ref(false);
const previewResult = ref<PreviewContextBudgetResponse | null>(null);
const previewError = ref("");

const operationOptions = [
  { label: "sop_run", value: "sop_run" },
  { label: "sop_chat", value: "sop_chat" },
  { label: "chatbot_chat", value: "chatbot_chat" },
  { label: "salesrag_chat", value: "salesrag_chat" },
  { label: "context_compression", value: "context_compression" },
  { label: "default_llm_chat", value: "default_llm_chat" },
];

const serviceOptions = computed(() =>
  services.value.map((s) => ({
    label: `[${s.id}] ${s.display_name} (${s.service_type})`,
    value: s.id,
  })),
);

async function loadServices() {
  servicesLoading.value = true;
  try {
    const res = await listServicesApi({
      page: 1,
      page_size: 200,
      service_type: "llm",
    });
    services.value =
      (res as unknown as { list: AIService[]; total: number }).list ?? [];
  } catch {
    // non-blocking
  } finally {
    servicesLoading.value = false;
  }
}

function validatePreviewFieldOnBlur(field: keyof typeof previewForm.value) {
  const errs = { ...previewFormErrors.value };
  if (field === "service_id") {
    errs.service_id = previewForm.value.service_id ? "" : "必须选择服务";
  }
  if (field === "fixed_overhead_tokens" || field === "reserved_output_tokens") {
    const n = Number(previewForm.value[field]);
    errs[field as string] =
      Number.isInteger(n) && n >= 0 ? "" : "必须为非负整数";
  }
  if (field === "safe_ratio") {
    const n = Number(previewForm.value.safe_ratio);
    errs.safe_ratio =
      Number.isFinite(n) && n > 0 && n <= 1 ? "" : "必须在 0~1 之间";
  }
  previewFormErrors.value = errs;
}

function validatePreviewForm(): boolean {
  const errs: Record<string, string> = {};
  if (!previewForm.value.service_id) errs.service_id = "必须选择服务";
  const fot = Number(previewForm.value.fixed_overhead_tokens);
  if (!Number.isInteger(fot) || fot < 0)
    errs.fixed_overhead_tokens = "必须为非负整数";
  const rot = Number(previewForm.value.reserved_output_tokens);
  if (!Number.isInteger(rot) || rot < 0)
    errs.reserved_output_tokens = "必须为非负整数";
  const sr = Number(previewForm.value.safe_ratio);
  if (!Number.isFinite(sr) || sr <= 0 || sr > 1)
    errs.safe_ratio = "必须在 0~1 之间";
  previewFormErrors.value = errs;
  return Object.keys(errs).length === 0;
}

async function runPreview() {
  if (!validatePreviewForm()) {
    toast.error("请检查表单");
    return;
  }
  if (previewLoading.value) return;
  previewLoading.value = true;
  previewResult.value = null;
  previewError.value = "";
  try {
    const res = await previewContextBudgetApi({
      service_id: Number(previewForm.value.service_id),
      operation: previewForm.value.operation,
      fixed_overhead_tokens: Number(previewForm.value.fixed_overhead_tokens),
      reserved_output_tokens: Number(previewForm.value.reserved_output_tokens),
      safe_ratio: Number(previewForm.value.safe_ratio),
    });
    previewResult.value = res as unknown as PreviewContextBudgetResponse;
  } catch (e) {
    previewError.value = (e as Error).message || "Preview 请求失败";
    toast.error(previewError.value);
  } finally {
    previewLoading.value = false;
  }
}

// ======================================================
// Lifecycle
// ======================================================

function onTabChange(key: TabKey) {
  activeTab.value = key;
  if (key === "profiles" && profiles.value.length === 0) loadProfiles();
  if (key === "policies" && policies.value.length === 0) loadPolicies();
  if (key === "events" && events.value.length === 0) loadEvents();
  if (key === "preview" && services.value.length === 0) loadServices();
}

onMounted(() => {
  loadProfiles();
});

// Reset page on filter change
watch(
  [
    profileFilterProvider,
    profileFilterModel,
    profileFilterServiceType,
    profileFilterActive,
  ],
  () => {
    profilePage.value = 1;
    loadProfiles();
  },
);
watch([eventFilterOperation, eventFilterStatus, eventFilterProvider], () => {
  eventPage.value = 1;
  loadEvents();
});

function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | undefined | null): string {
  if (n == null) return "—";
  return (n * 100).toFixed(2) + "%";
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  return formatDate(iso);
}
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">Context Budget 管理</h1>
    </div>

    <!-- Tabs -->
    <div class="tab-bar" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        role="tab"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === tab.key }"
        @click="onTabChange(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ============================================================
         TAB 1: Token Profiles
    ============================================================ -->
    <div v-if="activeTab === 'profiles'" class="tab-content">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar__filters">
          <AppInput
            v-model="profileFilterProvider"
            placeholder="Provider 过滤"
            class="filter-input"
          />
          <AppInput
            v-model="profileFilterModel"
            placeholder="Model 过滤"
            class="filter-input"
          />
          <AppSelect
            v-model="profileFilterActive"
            :options="activeFilterOptions"
            class="filter-select"
          />
        </div>
        <AppButton
          variant="primary"
          size="sm"
          data-test="open-create-profile"
          @click="openCreateProfile"
        >
          <Plus :size="14" />
          新增 Profile
        </AppButton>
      </div>

      <!-- Error state -->
      <div v-if="profileError" class="error-alert">
        <span>{{ profileError }}</span>
        <AppButton size="sm" variant="secondary" @click="loadProfiles"
          >重试</AppButton
        >
      </div>

      <!-- Table -->
      <DataTable
        :columns="profileColumns"
        :data="profiles"
        :loading="profileLoading"
        :total="profileTotal"
        :page="profilePage"
        :page-size="profilePageSize"
        empty-text="暂无 Token Profiles"
        @update:page="onProfilePageChange"
      >
        <template #cell-provider="{ row }">
          <span class="mono-text">{{ row.provider }}</span>
        </template>
        <template #cell-model="{ row }">
          <span class="mono-text">{{ row.model }}</span>
          <span v-if="row.model_family" class="tag-pill">{{
            row.model_family
          }}</span>
        </template>
        <template #cell-service_type="{ row }">
          <span class="service-type-badge">{{ row.service_type }}</span>
        </template>
        <template #cell-version="{ row }">
          <span class="version-label">v{{ row.version }}</span>
        </template>
        <template #cell-safety_multiplier="{ row }">
          {{ row.safety_multiplier.toFixed(3) }}
        </template>
        <template #cell-calibration_sample_count="{ row }">
          {{ formatNumber(row.calibration_sample_count) }}
        </template>
        <template #cell-calibration_p50_abs_error="{ row }">
          {{ formatPercent(row.calibration_p50_abs_error) }}
        </template>
        <template #cell-calibration_p90_abs_error="{ row }">
          {{ formatPercent(row.calibration_p90_abs_error) }}
        </template>
        <template #cell-calibration_p99_under_ratio="{ row }">
          {{ formatPercent(row.calibration_p99_under_ratio) }}
        </template>
        <template #cell-is_active="{ row }">
          <StatusBadge :status="row.is_active ? 'active' : 'inactive'" />
        </template>
        <template #cell-updated_at="{ row }">
          {{ formatDateTime(row.updated_at) }}
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <AppButton
              variant="ghost"
              size="sm"
              :data-test="`row-history-${row.id}`"
              title="查看历史版本"
              @click="openHistoryDrawer(row)"
            >
              <History :size="14" />
            </AppButton>
            <AppButton
              variant="ghost"
              size="sm"
              :data-test="`row-edit-${row.id}`"
              title="编辑（新版本）"
              @click="openEditProfile(row)"
            >
              <Pencil :size="14" />
            </AppButton>
            <AppButton
              v-if="row.is_active"
              variant="ghost"
              size="sm"
              class="btn-danger"
              :data-test="`row-delete-${row.id}`"
              title="停用"
              @click="promptDeleteProfile(row.id)"
            >
              <Trash2 :size="14" />
            </AppButton>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- ============================================================
         TAB 2: Budget Policies
    ============================================================ -->
    <div v-else-if="activeTab === 'policies'" class="tab-content">
      <!-- Error state -->
      <div v-if="policyError" class="error-alert">
        <span>{{ policyError }}</span>
        <AppButton size="sm" variant="secondary" @click="loadPolicies"
          >重试</AppButton
        >
      </div>

      <!-- Table -->
      <DataTable
        :columns="policyColumns"
        :data="policies"
        :loading="policyLoading"
        :total="policies.length"
        empty-text="暂无 Budget Policies"
      >
        <template #cell-operation="{ row }">
          <span class="mono-text bold-text">{{ row.operation }}</span>
        </template>
        <template #cell-fixed_overhead_tokens="{ row }">
          {{ formatNumber(row.fixed_overhead_tokens) }}
        </template>
        <template #cell-reserved_output_tokens="{ row }">
          {{ formatNumber(row.reserved_output_tokens) }}
        </template>
        <template #cell-safe_ratio="{ row }">
          {{ row.safe_ratio }}
        </template>
        <template #cell-version="{ row }">
          <span class="version-label">v{{ row.version }}</span>
        </template>
        <template #cell-updated_at="{ row }">
          {{ formatDateTime(row.updated_at) }}
        </template>
        <template #cell-actions="{ row }">
          <AppButton
            variant="ghost"
            size="sm"
            :data-test="`policy-edit-${row.operation}`"
            @click="openEditPolicy(row)"
          >
            <Pencil :size="14" />
          </AppButton>
        </template>
      </DataTable>
    </div>

    <!-- ============================================================
         TAB 3: Recent Events
    ============================================================ -->
    <div v-else-if="activeTab === 'events'" class="tab-content">
      <!-- Filters -->
      <div class="toolbar">
        <div class="toolbar__filters">
          <AppInput
            v-model="eventFilterOperation"
            placeholder="Operation 过滤"
            class="filter-input"
          />
          <AppSelect
            v-model="eventFilterStatus"
            :options="eventStatusOptions"
            class="filter-select"
          />
          <AppInput
            v-model="eventFilterProvider"
            placeholder="Provider 过滤"
            class="filter-input"
          />
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          :loading="eventLoading"
          @click="loadEvents"
        >
          <Search :size="14" />
          搜索
        </AppButton>
      </div>

      <!-- Error state -->
      <div v-if="eventError" class="error-alert">
        <span>{{ eventError }}</span>
        <AppButton size="sm" variant="secondary" @click="loadEvents"
          >重试</AppButton
        >
      </div>

      <!-- Table -->
      <DataTable
        :columns="eventColumns"
        :data="events"
        :loading="eventLoading"
        :total="eventTotal"
        :page="eventPage"
        :page-size="eventPageSize"
        empty-text="暂无 Context Budget Events"
        @update:page="onEventPageChange"
      >
        <template #cell-operation="{ row }">
          <span class="mono-text">{{ row.operation }}</span>
        </template>
        <template #cell-provider="{ row }">
          <span class="mono-text">{{ row.provider }}</span>
        </template>
        <template #cell-model="{ row }">
          <span class="mono-text">{{ row.model }}</span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge
            :status="eventStatusVariant(row.status)"
            :label="row.status"
          />
        </template>
        <template #cell-estimated_before="{ row }">
          {{ formatNumber(row.estimated_before) }}
        </template>
        <template #cell-estimated_after="{ row }">
          {{ formatNumber(row.estimated_after) }}
        </template>
        <template #cell-safe_input_budget="{ row }">
          {{ formatNumber(row.safe_input_budget) }}
        </template>
        <template #cell-dropped_fragment_count="{ row }">
          <span :class="{ 'warn-text': row.dropped_fragment_count > 0 }">
            {{ row.dropped_fragment_count }}
          </span>
        </template>
        <template #cell-created_at="{ row }">
          {{ formatDateTime(row.created_at) }}
        </template>
      </DataTable>
    </div>

    <!-- ============================================================
         TAB 4: Preview
    ============================================================ -->
    <div v-else-if="activeTab === 'preview'" class="tab-content">
      <div class="preview-layout">
        <!-- Form -->
        <div class="preview-form-card">
          <h3 class="card-title">Preview 配置</h3>
          <p class="card-desc">
            选择一个 LLM 服务和 Operation Policy 参数，验证 context
            预算是否合法。
          </p>

          <div class="form-group">
            <label class="form-label">LLM Service *</label>
            <AppSelect
              :model-value="
                previewForm.service_id === ''
                  ? ''
                  : String(previewForm.service_id)
              "
              :options="serviceOptions"
              placeholder="选择 LLM 服务"
              :disabled="servicesLoading"
              @update:model-value="
                (v: string | number) => {
                  previewForm.service_id = v === '' ? '' : Number(v);
                }
              "
              @blur="validatePreviewFieldOnBlur('service_id')"
            />
            <p v-if="previewFormErrors.service_id" class="field-error">
              {{ previewFormErrors.service_id }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Operation *</label>
            <AppSelect
              v-model="previewForm.operation"
              :options="operationOptions"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Fixed Overhead Tokens</label>
            <AppInput
              v-model="previewForm.fixed_overhead_tokens"
              type="number"
              placeholder="512"
              @blur="validatePreviewFieldOnBlur('fixed_overhead_tokens')"
            />
            <p
              v-if="previewFormErrors.fixed_overhead_tokens"
              class="field-error"
            >
              {{ previewFormErrors.fixed_overhead_tokens }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Reserved Output Tokens</label>
            <AppInput
              v-model="previewForm.reserved_output_tokens"
              type="number"
              placeholder="4096"
              @blur="validatePreviewFieldOnBlur('reserved_output_tokens')"
            />
            <p
              v-if="previewFormErrors.reserved_output_tokens"
              class="field-error"
            >
              {{ previewFormErrors.reserved_output_tokens }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Safe Ratio (0–1)</label>
            <AppInput
              v-model="previewForm.safe_ratio"
              type="number"
              placeholder="0.85"
              @blur="validatePreviewFieldOnBlur('safe_ratio')"
            />
            <p v-if="previewFormErrors.safe_ratio" class="field-error">
              {{ previewFormErrors.safe_ratio }}
            </p>
          </div>

          <AppButton
            variant="primary"
            :loading="previewLoading"
            class="preview-submit-btn"
            data-test="preview-submit"
            @click="runPreview"
          >
            运行 Preview
          </AppButton>
        </div>

        <!-- Result -->
        <div class="preview-result-card">
          <h3 class="card-title">Preview 结果</h3>

          <div
            v-if="!previewResult && !previewError && !previewLoading"
            class="empty-hint"
          >
            配置参数后点击「运行 Preview」查看结果
          </div>

          <div
            v-if="previewLoading"
            class="skeleton-block skeleton-block--sm"
          />

          <div v-if="previewError && !previewLoading" class="error-alert">
            {{ previewError }}
          </div>

          <div
            v-if="previewResult && !previewLoading"
            class="preview-result-body"
          >
            <!-- Valid badge -->
            <div class="result-valid-row">
              <span
                class="result-valid-badge"
                :class="
                  previewResult.valid
                    ? 'result-valid-badge--ok'
                    : 'result-valid-badge--fail'
                "
              >
                {{ previewResult.valid ? "VALID" : "INVALID" }}
              </span>
            </div>

            <!-- Metrics grid -->
            <div class="result-grid">
              <div class="result-metric">
                <span class="result-metric__label">Context Window</span>
                <span class="result-metric__value">{{
                  formatNumber(previewResult.context_window)
                }}</span>
              </div>
              <div class="result-metric">
                <span class="result-metric__label">Max Output Tokens</span>
                <span class="result-metric__value">{{
                  formatNumber(previewResult.max_output_tokens)
                }}</span>
              </div>
              <div class="result-metric">
                <span class="result-metric__label">Reserved Output</span>
                <span class="result-metric__value">{{
                  formatNumber(previewResult.reserved_output_tokens)
                }}</span>
              </div>
              <div class="result-metric result-metric--highlight">
                <span class="result-metric__label">Safe Input Budget</span>
                <span class="result-metric__value">{{
                  formatNumber(previewResult.safe_input_budget)
                }}</span>
              </div>
            </div>

            <!-- Warnings -->
            <div
              v-if="previewResult.warnings && previewResult.warnings.length > 0"
              class="result-warnings"
            >
              <p class="result-warnings__title">警告</p>
              <ul class="result-warnings__list">
                <li v-for="(w, i) in previewResult.warnings" :key="i">
                  {{ w }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================
         Profile Create/Edit Modal
    ============================================================ -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="profileModalVisible"
          class="modal-overlay"
          @click.self="profileModalVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">
              {{
                profileModalIsEdit
                  ? "编辑 Token Profile（新版本）"
                  : "新增 Token Profile"
              }}
            </h3>
            <div class="modal-form">
              <div class="form-group" data-test="form-provider">
                <label class="form-label">Provider *</label>
                <AppInput
                  v-model="profileForm.provider"
                  placeholder="如 dmxapi"
                  @blur="validateProfileFieldOnBlur('provider')"
                />
                <p v-if="profileFormErrors.provider" class="field-error">
                  {{ profileFormErrors.provider }}
                </p>
              </div>
              <div class="form-group" data-test="form-model">
                <label class="form-label">Model *</label>
                <AppInput
                  v-model="profileForm.model"
                  placeholder="如 deepseek-v3"
                  @blur="validateProfileFieldOnBlur('model')"
                />
                <p v-if="profileFormErrors.model" class="field-error">
                  {{ profileFormErrors.model }}
                </p>
              </div>
              <div class="form-group" data-test="form-model-family">
                <label class="form-label">Model Family</label>
                <AppInput
                  v-model="profileForm.model_family"
                  placeholder="如 deepseek"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Service Type *</label>
                <AppSelect
                  v-model="profileForm.service_type"
                  :options="serviceTypeOptions"
                />
                <p v-if="profileFormErrors.service_type" class="field-error">
                  {{ profileFormErrors.service_type }}
                </p>
              </div>
              <div class="form-group" data-test="form-safety-multiplier">
                <label class="form-label">Safety Multiplier *</label>
                <AppInput
                  v-model="profileForm.safety_multiplier"
                  type="number"
                  placeholder="1.15"
                  @blur="validateProfileFieldOnBlur('safety_multiplier')"
                />
                <p
                  v-if="profileFormErrors.safety_multiplier"
                  class="field-error"
                >
                  {{ profileFormErrors.safety_multiplier }}
                </p>
              </div>
              <div class="form-group" data-test="form-calibration-multiplier">
                <label class="form-label">Calibration Multiplier *</label>
                <AppInput
                  v-model="profileForm.calibration_multiplier"
                  type="number"
                  placeholder="1.0"
                  @blur="validateProfileFieldOnBlur('calibration_multiplier')"
                />
                <p
                  v-if="profileFormErrors.calibration_multiplier"
                  class="field-error"
                >
                  {{ profileFormErrors.calibration_multiplier }}
                </p>
              </div>
            </div>
            <div class="modal-actions">
              <AppButton
                variant="ghost"
                size="sm"
                @click="profileModalVisible = false"
                >取消</AppButton
              >
              <AppButton
                variant="primary"
                size="sm"
                :loading="profileSaving"
                data-test="submit-profile-form"
                @click="submitProfileForm"
              >
                {{ profileModalIsEdit ? "保存（新版本）" : "创建" }}
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============================================================
         Policy Edit Modal
    ============================================================ -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="policyModalVisible"
          class="modal-overlay"
          @click.self="policyModalVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">
              编辑 Policy：{{ policyEditingOperation }}
            </h3>
            <div class="modal-form">
              <div class="form-group">
                <label class="form-label">Fixed Overhead Tokens *</label>
                <AppInput
                  v-model="policyForm.fixed_overhead_tokens"
                  type="number"
                  placeholder="512"
                  @blur="validatePolicyFieldOnBlur('fixed_overhead_tokens')"
                />
                <p
                  v-if="policyFormErrors.fixed_overhead_tokens"
                  class="field-error"
                >
                  {{ policyFormErrors.fixed_overhead_tokens }}
                </p>
              </div>
              <div class="form-group">
                <label class="form-label">Reserved Output Tokens *</label>
                <AppInput
                  v-model="policyForm.reserved_output_tokens"
                  type="number"
                  placeholder="4096"
                  @blur="validatePolicyFieldOnBlur('reserved_output_tokens')"
                />
                <p
                  v-if="policyFormErrors.reserved_output_tokens"
                  class="field-error"
                >
                  {{ policyFormErrors.reserved_output_tokens }}
                </p>
              </div>
              <div class="form-group">
                <label class="form-label">Safe Ratio *</label>
                <AppInput
                  v-model="policyForm.safe_ratio"
                  type="number"
                  placeholder="0.85"
                  @blur="validatePolicyFieldOnBlur('safe_ratio')"
                />
                <p v-if="policyFormErrors.safe_ratio" class="field-error">
                  {{ policyFormErrors.safe_ratio }}
                </p>
              </div>
            </div>
            <div class="modal-actions">
              <AppButton
                variant="ghost"
                size="sm"
                @click="policyModalVisible = false"
                >取消</AppButton
              >
              <AppButton
                variant="primary"
                size="sm"
                :loading="policySaving"
                data-test="submit-policy-form"
                @click="submitPolicyForm"
              >
                保存（新版本）
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============================================================
         History Drawer
    ============================================================ -->
    <Teleport to="body">
      <Transition name="drawer">
        <div
          v-if="historyDrawerVisible"
          class="drawer-overlay"
          data-test="history-drawer"
          @click.self="historyDrawerVisible = false"
        >
          <div class="drawer-panel" role="dialog" aria-modal="true">
            <div class="drawer-header">
              <div>
                <h3 class="drawer-title">历史版本</h3>
                <p v-if="historyTarget" class="drawer-subtitle">
                  {{ historyTarget.provider }} / {{ historyTarget.model }} /
                  {{ historyTarget.service_type }}
                </p>
              </div>
              <button
                class="drawer-close"
                @click="historyDrawerVisible = false"
              >
                <X :size="18" />
              </button>
            </div>
            <div class="drawer-body">
              <div v-if="historyLoading" class="skeleton-block" />
              <div v-else-if="historyItems.length === 0" class="empty-hint">
                暂无历史版本
              </div>
              <div v-else class="history-list">
                <div
                  v-for="h in historyItems"
                  :key="h.id"
                  class="history-item"
                  :class="{ 'history-item--active': h.is_active }"
                >
                  <div class="history-item__header">
                    <span class="version-label">v{{ h.version }}</span>
                    <StatusBadge
                      :status="h.is_active ? 'active' : 'inactive'"
                    />
                    <span class="history-date">{{
                      formatDateTime(h.updated_at)
                    }}</span>
                    <span class="history-by">by {{ h.updated_by }}</span>
                  </div>
                  <div class="history-item__metrics">
                    <span>Safety ×{{ h.safety_multiplier }}</span>
                    <span>Calibration ×{{ h.calibration_multiplier }}</span>
                    <span>样本 {{ h.calibration_sample_count }}</span>
                    <span
                      >P50
                      {{ formatPercent(h.calibration_p50_abs_error) }}</span
                    >
                    <span
                      >P90
                      {{ formatPercent(h.calibration_p90_abs_error) }}</span
                    >
                    <span
                      >P99低估
                      {{ formatPercent(h.calibration_p99_under_ratio) }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ============================================================
         Delete Confirm Modal
    ============================================================ -->
    <ConfirmModal
      :visible="profileDeleteConfirm"
      title="停用 Token Profile"
      message="确定停用此 Token Profile？停用后该版本将不再被系统使用。"
      confirm-text="停用"
      :danger="true"
      @confirm="confirmDeleteProfile"
      @cancel="profileDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
/* ---- Page header ---- */
.page-header {
  margin-bottom: var(--space-5);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text);
}

/* ---- Tab bar ---- */
.tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: var(--space-5);
}

.tab-btn {
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* ---- Toolbar ---- */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.toolbar__filters {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  flex: 1;
}

.filter-input {
  width: 160px;
}

.filter-select {
  width: 130px;
}

/* ---- Error alert ---- */
.error-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-light, #fee2e2);
  color: #991b1b;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

/* ---- Cell helpers ---- */
.mono-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.bold-text {
  font-weight: 600;
  color: var(--text);
}

.tag-pill {
  display: inline-block;
  margin-left: var(--space-2);
  padding: 1px 6px;
  background: var(--gray-100, #f3f4f6);
  color: var(--text-secondary);
  border-radius: var(--radius-full, 9999px);
  font-size: 11px;
}

.service-type-badge {
  padding: 2px 8px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs);
  font-weight: 500;
}

.version-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.warn-text {
  color: var(--warning, #d97706);
  font-weight: 600;
}

/* ---- Row actions ---- */
.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}

.btn-danger {
  color: var(--danger);
}

/* ---- Preview layout ---- */
.preview-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: var(--space-5);
  align-items: start;
}

@media (max-width: 900px) {
  .preview-layout {
    grid-template-columns: 1fr;
  }
}

.preview-form-card,
.preview-result-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.card-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.card-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-4);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.field-error {
  font-size: var(--text-xs);
  color: var(--danger);
  margin-top: var(--space-1);
}

.preview-submit-btn {
  width: 100%;
  margin-top: var(--space-2);
}

/* ---- Preview result ---- */
.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-6);
  text-align: center;
}

.skeleton-block {
  height: 200px;
  background: linear-gradient(
    90deg,
    var(--gray-100) 25%,
    var(--gray-200) 50%,
    var(--gray-100) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-md);
  animation: shimmer 1.5s infinite;
}

.skeleton-block--sm {
  height: 100px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.preview-result-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.result-valid-row {
  display: flex;
  align-items: center;
}

.result-valid-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.result-valid-badge--ok {
  background: #dcfce7;
  color: #166534;
}

.result-valid-badge--fail {
  background: var(--danger-light, #fee2e2);
  color: #991b1b;
}

.result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.result-metric {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--surface-low, var(--gray-50));
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.result-metric--highlight {
  background: var(--primary-light, #eff6ff);
  border-color: var(--primary);
}

.result-metric__label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 500;
}

.result-metric__value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text);
  font-family: var(--font-mono);
}

.result-warnings {
  padding: var(--space-3) var(--space-4);
  background: #fef3c7;
  border-radius: var(--radius-md);
  border: 1px solid #fde68a;
}

.result-warnings__title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: #92400e;
  margin-bottom: var(--space-2);
}

.result-warnings__list {
  list-style: disc;
  padding-left: var(--space-4);
  font-size: var(--text-sm);
  color: #92400e;
}

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 90%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-4);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

/* ---- History drawer ---- */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 480px;
  max-width: 90vw;
  height: 100%;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--border);
}

.drawer-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
}

.drawer-subtitle {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  margin-top: var(--space-1);
}

.drawer-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--space-1);
  line-height: 0;
  transition: color var(--transition-fast);
}

.drawer-close:hover {
  color: var(--text);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.history-item {
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.history-item--active {
  border-color: var(--primary);
  background: var(--primary-light, #eff6ff);
}

.history-item__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
}

.history-date {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.history-by {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin-left: auto;
}

.history-item__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

/* ---- Transitions ---- */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card {
  transform: scale(0.95);
}

.modal-leave-to .modal-card {
  transform: scale(0.95);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 200ms ease;
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 200ms ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel {
  transform: translateX(100%);
}

.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
