<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  getServiceApi,
  createServiceWithRouteApi,
  updateServiceApi,
  getCapabilitySchemaApi,
  createRouteApi,
  updateRouteApi,
  deleteRouteApi,
  toggleRouteApi,
  listProvidersApi,
} from "@/api/ai";
import type { ProviderDTO } from "@/types/ai";
import { getPricingRulesApi, type PricingRule } from "@/api/billing";
import type {
  AIServiceDetail,
  RouteDTO,
  CapabilityField,
  CapabilitySchemaMap,
  CreateServiceRequest,
  CreateServiceWithRouteRequest,
  UpdateServiceRequest,
  CreateRouteRequest,
  UpdateRouteRequest,
} from "@/types/ai";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
} from "lucide-vue-next";

const router = useRouter();
const route = useRoute();
const toast = useToast();

const isNew = computed(() => route.params.id === "new");
const serviceId = computed(() => (isNew.value ? 0 : Number(route.params.id)));

const loading = ref(false);
const saving = ref(false);
const error = ref("");

interface ServiceForm {
  model_key: string;
  display_name: string;
  service_type: string;
  capability_json: Record<string, unknown>;
  latency_tier: string;
  quality_tier: string;
  tags_input: string;
  is_thinking: boolean;
  supports_thinking: boolean;
  thinking_only: boolean;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

const form = ref<ServiceForm>({
  model_key: "",
  display_name: "",
  service_type: "llm",
  capability_json: {},
  latency_tier: "standard",
  quality_tier: "standard",
  tags_input: "",
  is_thinking: false,
  supports_thinking: false,
  thinking_only: false,
  icon: "",
  sort_order: 0,
  is_active: true,
});

const fieldErrors = ref<Record<string, string>>({});

const capabilitySchemaMap = ref<CapabilitySchemaMap>({});
const currentFields = computed<CapabilityField[]>(
  () => capabilitySchemaMap.value[form.value.service_type]?.fields ?? [],
);

// Routes — local working copy; RouteDTO is the canonical shape for all route data
const routes = ref<RouteDTO[]>([]);
// Track per-route saving state
const routeSaving = ref<Record<number, boolean>>({});

// Route editing: each row can be in "editing" mode
interface RouteEditState {
  provider_model_id: string;
  priority: string;
}
const routeEditState = ref<Record<number, RouteEditState>>({});
const routeEditing = ref<Set<number>>(new Set());

// Add route modal
const addRouteVisible = ref(false);
const addRouteForm = ref<{
  provider_id: number | null;
  provider_model_id: string;
  priority: string;
  is_active: boolean;
}>({
  provider_id: null,
  provider_model_id: "",
  priority: "0",
  is_active: true,
});
const addRouteErrors = ref<Record<string, string>>({});
const addRouteSaving = ref(false);

// Delete confirm
const deleteConfirmVisible = ref(false);
const deleteTargetId = ref<number | null>(null);
const deleteInProgress = ref(false);

// Inline Route form used ONLY in create mode. In edit mode, routes are managed
// in the existing routes table further down the page.
// Kept separate from addRouteForm (used by the add-route modal in edit mode)
// so the two flows don't leak state into each other.
const createRouteForm = ref<{
  provider_id: number | null;
  provider_model_id: string;
  priority: string;
  is_active: boolean;
}>({
  provider_id: null,
  provider_model_id: "",
  priority: "5",
  is_active: true,
});
const createRouteErrors = ref<Record<string, string>>({});

// Providers
const providers = ref<ProviderDTO[]>([]);
const providerOptions = computed(() =>
  providers.value.map((p) => ({
    label: p.display_name || p.name,
    value: p.id,
  })),
);

// Pricing rules
const pricingRules = ref<PricingRule[]>([]);
const pricingLoading = ref(false);
// Map: routeId -> matched PricingRule[]
const routePricingMap = computed(() => {
  const map: Record<number, PricingRule[]> = {};
  for (const r of routes.value) {
    const matched = pricingRules.value.filter(
      (pr) =>
        pr.provider === r.provider_name &&
        (pr.model === form.value.model_key || pr.model === r.provider_model_id),
    );
    map[r.id] = matched;
  }
  return map;
});

const serviceTypeOptions = [
  { label: "LLM", value: "llm" },
  { label: "OCR", value: "ocr" },
  { label: "ASR", value: "asr" },
];

const tierOptions = [
  { label: "fast", value: "fast" },
  { label: "standard", value: "standard" },
  { label: "high", value: "high" },
];

function getCapValue(name: string): unknown {
  return form.value.capability_json[name];
}

function setCapValue(name: string, value: unknown) {
  form.value.capability_json = {
    ...form.value.capability_json,
    [name]: value,
  };
}

function toggleEnumMember(field: CapabilityField, enumValue: string) {
  const cur = (getCapValue(field.name) as string[] | undefined) ?? [];
  const enumSet = new Set(field.enum_values ?? []);
  const extras = cur.filter((v) => typeof v === "string" && !enumSet.has(v));
  const enumMembers = cur.filter(
    (v) => typeof v === "string" && enumSet.has(v),
  );
  const nextEnum = enumMembers.includes(enumValue)
    ? enumMembers.filter((v) => v !== enumValue)
    : [...enumMembers, enumValue];
  setCapValue(field.name, [...nextEnum, ...extras]);
}

function isEnumMember(fieldName: string, enumValue: string): boolean {
  const cur = getCapValue(fieldName);
  return Array.isArray(cur) && cur.includes(enumValue);
}

function unknownEnumValues(field: CapabilityField): string[] {
  const cur = getCapValue(field.name);
  if (!Array.isArray(cur)) return [];
  const enumSet = new Set(field.enum_values ?? []);
  return cur.filter(
    (v): v is string => typeof v === "string" && !enumSet.has(v),
  );
}

function capListText(fieldName: string): string {
  const v = getCapValue(fieldName);
  return Array.isArray(v) ? v.join(", ") : "";
}

function setCapListFromText(fieldName: string, text: string) {
  const arr = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  setCapValue(fieldName, arr);
}

function capIntValue(fieldName: string): string {
  const v = getCapValue(fieldName);
  return typeof v === "number" ? String(v) : "";
}

function setCapInt(fieldName: string, text: string) {
  const n = text === "" ? undefined : Number(text);
  if (n === undefined || Number.isNaN(n)) {
    const next = { ...form.value.capability_json };
    delete next[fieldName];
    form.value.capability_json = next;
  } else {
    setCapValue(fieldName, n);
  }
}

function capBoolValue(fieldName: string): boolean {
  return getCapValue(fieldName) === true;
}

function featureMapText(fieldName: string): string {
  const v = getCapValue(fieldName);
  return v ? JSON.stringify(v, null, 2) : "{}";
}

function setFeatureMapFromText(fieldName: string, text: string) {
  try {
    const parsed = JSON.parse(text || "{}");
    if (parsed && typeof parsed === "object") {
      setCapValue(fieldName, parsed);
      fieldErrors.value[`cap.${fieldName}`] = "";
    }
  } catch {
    fieldErrors.value[`cap.${fieldName}`] = "JSON 格式错误";
  }
}

function validateField(field: string) {
  const v = form.value;
  if (field === "model_key") {
    fieldErrors.value.model_key = v.model_key.trim() ? "" : "标识不能为空";
  }
  if (field === "display_name") {
    fieldErrors.value.display_name = v.display_name.trim()
      ? ""
      : "显示名称不能为空";
  }
}

function validateAll(): boolean {
  validateField("model_key");
  validateField("display_name");
  return !Object.values(fieldErrors.value).some(Boolean);
}

function applyService(s: AIServiceDetail) {
  form.value = {
    model_key: s.model_key,
    display_name: s.display_name,
    service_type: s.service_type,
    capability_json: { ...(s.capability_json ?? {}) },
    latency_tier: s.latency_tier || "standard",
    quality_tier: s.quality_tier || "standard",
    tags_input: (s.tags ?? []).join(", "),
    is_thinking: s.is_thinking,
    supports_thinking: s.supports_thinking,
    thinking_only: s.thinking_only,
    icon: s.icon || "",
    sort_order: s.sort_order ?? 0,
    is_active: s.is_active,
  };
  routes.value = s.routes ?? [];
}

async function loadPricingRules() {
  if (isNew.value || routes.value.length === 0) return;
  pricingLoading.value = true;
  try {
    const res = await getPricingRulesApi({ offset: 0, limit: 200 });
    pricingRules.value = res.rules ?? [];
  } catch {
    // pricing rules are informational; don't block the page on failure
  } finally {
    pricingLoading.value = false;
  }
}

async function loadData() {
  loading.value = true;
  error.value = "";
  try {
    // Providers are needed in both modes now:
    // - create mode: for the mandatory inline Route form
    // - edit mode: for the add-route modal + display
    const [schemaRes, provRes] = await Promise.all([
      getCapabilitySchemaApi(),
      listProvidersApi().catch(() => ({
        list: [] as ProviderDTO[],
        total: 0,
      })),
    ]);
    capabilitySchemaMap.value = schemaRes ?? {};
    providers.value = provRes.list ?? [];

    if (isNew.value) {
      // Pre-select first provider so the dropdown has a sane default.
      if (
        providers.value.length > 0 &&
        createRouteForm.value.provider_id == null
      ) {
        createRouteForm.value.provider_id = providers.value[0].id;
      }
    } else {
      const svc = await getServiceApi(serviceId.value);
      applyService(svc);
      await loadPricingRules();
    }
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

function buildPayloadBase() {
  const tags = form.value.tags_input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    model_key: form.value.model_key,
    display_name: form.value.display_name,
    service_type: form.value.service_type,
    capability_json: form.value.capability_json,
    latency_tier: form.value.latency_tier,
    quality_tier: form.value.quality_tier,
    tags,
    is_thinking: form.value.is_thinking,
    supports_thinking: form.value.supports_thinking,
    thinking_only: form.value.thinking_only,
    icon: form.value.icon,
    sort_order: form.value.sort_order,
    is_active: form.value.is_active,
  };
}

// Validate the inline Route form used only in create mode.
// Returns true iff all required fields are present and numerically valid.
function validateCreateRoute(): boolean {
  createRouteErrors.value = {};
  if (!createRouteForm.value.provider_id) {
    createRouteErrors.value.provider_id = "Provider 必填";
  }
  if (!createRouteForm.value.provider_model_id.trim()) {
    createRouteErrors.value.provider_model_id = "Provider Model ID 必填";
  }
  const p = Number(createRouteForm.value.priority);
  if (createRouteForm.value.priority === "" || Number.isNaN(p)) {
    createRouteErrors.value.priority = "优先级必须是数字";
  }
  return Object.keys(createRouteErrors.value).length === 0;
}

async function save() {
  if (!validateAll()) {
    toast.error("请检查必填项");
    return;
  }
  if (Object.entries(fieldErrors.value).some(([, v]) => v)) {
    toast.error("请修正表单错误后再保存");
    return;
  }
  // In create mode, the route sub-form is mandatory. This is the UI-level
  // enforcement of the fix: no Service gets created without a Route.
  if (isNew.value && !validateCreateRoute()) {
    toast.error("请完整填写 Route 配置");
    return;
  }
  if (saving.value) return;
  saving.value = true;
  try {
    if (isNew.value) {
      const servicePayload: CreateServiceRequest = buildPayloadBase();
      const routePayload: CreateRouteRequest = {
        provider_id: createRouteForm.value.provider_id!,
        provider_model_id: createRouteForm.value.provider_model_id.trim(),
        priority: Number(createRouteForm.value.priority),
        is_active: createRouteForm.value.is_active,
      };
      const payload: CreateServiceWithRouteRequest = {
        service: servicePayload,
        route: routePayload,
      };
      await createServiceWithRouteApi(payload);
      toast.success("服务及路由已创建");
    } else {
      const payload: UpdateServiceRequest = buildPayloadBase();
      await updateServiceApi(serviceId.value, payload);
      toast.success("服务已更新");
    }
    router.push("/ai-services");
  } catch (e) {
    toast.error((e as Error).message || "保存失败");
  } finally {
    saving.value = false;
  }
}

// ====== Route editing ======

function startEditRoute(r: RouteDTO) {
  routeEditState.value[r.id] = {
    provider_model_id: r.provider_model_id,
    priority: String(r.priority),
  };
  routeEditing.value = new Set([...routeEditing.value, r.id]);
}

function cancelEditRoute(id: number) {
  routeEditing.value = new Set([...routeEditing.value].filter((x) => x !== id));
  delete routeEditState.value[id];
}

async function saveRoute(r: RouteDTO) {
  const state = routeEditState.value[r.id];
  if (!state) return;
  const priority = Number(state.priority);
  if (Number.isNaN(priority)) {
    toast.error("优先级必须是数字");
    return;
  }
  routeSaving.value[r.id] = true;
  try {
    const payload: UpdateRouteRequest = {
      provider_model_id: state.provider_model_id,
      priority,
    };
    const res = await updateRouteApi(r.id, payload);
    // Update local state
    const idx = routes.value.findIndex((x) => x.id === r.id);
    if (idx > -1) {
      routes.value[idx] = { ...routes.value[idx], ...res.route };
    }
    cancelEditRoute(r.id);
    if (res.warnings && res.warnings.length > 0) {
      toast.info(`路由已保存（提示：${res.warnings.join("；")}）`);
    } else {
      toast.success("路由已更新");
    }
  } catch (e) {
    toast.error((e as Error).message || "保存路由失败");
  } finally {
    routeSaving.value[r.id] = false;
  }
}

async function toggleRoute(r: RouteDTO) {
  routeSaving.value[r.id] = true;
  try {
    const res = await toggleRouteApi(r.id);
    const idx = routes.value.findIndex((x) => x.id === r.id);
    if (idx > -1) {
      routes.value[idx] = { ...routes.value[idx], ...res.route };
    }
    toast.success(res.route.is_active ? "路由已启用" : "路由已禁用");
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    routeSaving.value[r.id] = false;
  }
}

function promptDelete(id: number) {
  deleteTargetId.value = id;
  deleteConfirmVisible.value = true;
}

async function confirmDelete() {
  if (deleteTargetId.value == null) return;
  const id = deleteTargetId.value;
  deleteInProgress.value = true;
  try {
    await deleteRouteApi(id);
    routes.value = routes.value.filter((r) => r.id !== id);
    cancelEditRoute(id);
    toast.success("路由已删除");
  } catch (e) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    deleteInProgress.value = false;
    deleteConfirmVisible.value = false;
    deleteTargetId.value = null;
  }
}

// ====== Add route ======

function openAddRoute() {
  addRouteForm.value = {
    provider_id: providers.value[0]?.id ?? null,
    provider_model_id: "",
    priority: "0",
    is_active: true,
  };
  addRouteErrors.value = {};
  addRouteVisible.value = true;
}

function validateAddRoute(): boolean {
  addRouteErrors.value = {};
  if (!addRouteForm.value.provider_id) {
    addRouteErrors.value.provider_id = "请选择供应商";
  }
  if (!addRouteForm.value.provider_model_id.trim()) {
    addRouteErrors.value.provider_model_id = "模型 ID 不能为空";
  }
  const p = Number(addRouteForm.value.priority);
  if (Number.isNaN(p)) {
    addRouteErrors.value.priority = "优先级必须是数字";
  }
  return Object.keys(addRouteErrors.value).length === 0;
}

async function submitAddRoute() {
  if (!validateAddRoute()) return;
  if (addRouteSaving.value) return;
  addRouteSaving.value = true;
  try {
    const payload: CreateRouteRequest = {
      provider_id: addRouteForm.value.provider_id!,
      provider_model_id: addRouteForm.value.provider_model_id.trim(),
      priority: Number(addRouteForm.value.priority),
      is_active: addRouteForm.value.is_active,
    };
    const res = await createRouteApi(serviceId.value, payload);
    routes.value = [...routes.value, res.route];
    addRouteVisible.value = false;
    if (res.warnings && res.warnings.length > 0) {
      toast.info(`路由已创建（提示：${res.warnings.join("；")}）`);
    } else {
      toast.success("路由已创建");
    }
    await loadPricingRules();
  } catch (e) {
    toast.error((e as Error).message || "创建路由失败");
  } finally {
    addRouteSaving.value = false;
  }
}

// ====== Pricing helpers ======

function formatPrice(rule: PricingRule): string {
  if (rule.price_per_call && rule.price_per_call > 0) {
    return `¥${rule.price_per_call} / 次`;
  }
  const inp = rule.input_price_per_mtok ?? 0;
  const out = rule.output_price_per_mtok ?? 0;
  if (inp > 0 || out > 0) {
    return `输入 ¥${inp} / 输出 ¥${out} (per Mtok)`;
  }
  if (rule.price_per_gb && rule.price_per_gb > 0) {
    return `¥${rule.price_per_gb} / GB`;
  }
  return "—";
}

/** Returns the billing mode label based on which price fields are non-zero. */
function billingModeLabel(rule: PricingRule): string {
  if (
    (rule.input_price_per_mtok ?? 0) > 0 ||
    (rule.output_price_per_mtok ?? 0) > 0
  ) {
    return "按量计费";
  }
  if ((rule.price_per_call ?? 0) > 0) {
    return "按次计费";
  }
  if ((rule.price_per_gb ?? 0) > 0) {
    return "按量计费";
  }
  return "未配置";
}

function billingModeCss(rule: PricingRule): string {
  if (
    (rule.input_price_per_mtok ?? 0) > 0 ||
    (rule.output_price_per_mtok ?? 0) > 0
  ) {
    return "pricing-badge--token";
  }
  if ((rule.price_per_call ?? 0) > 0) {
    return "pricing-badge--call";
  }
  return "pricing-badge--flat";
}

watch(() => route.params.id, loadData);
onMounted(loadData);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__left">
        <AppButton
          variant="ghost"
          size="sm"
          @click="router.push('/ai-services')"
        >
          <ArrowLeft :size="16" />
        </AppButton>
        <h1 class="page-title">
          {{ isNew ? "新建 AI 服务" : "编辑 AI 服务" }}
        </h1>
      </div>
      <AppButton variant="primary" :loading="saving" @click="save">
        {{ isNew ? "创建" : "保存" }}
      </AppButton>
    </div>

    <div v-if="loading" class="skeleton-block" />

    <div v-else-if="error" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="loadData"
        >重试</AppButton
      >
    </div>

    <template v-else>
      <!-- Basic Info -->
      <section class="form-section">
        <h2 class="section-title">基本信息</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">标识 (model_key) *</label>
            <AppInput
              v-model="form.model_key"
              placeholder="如 ali-qwen-turbo"
              :disabled="!isNew"
              @blur="validateField('model_key')"
            />
            <p v-if="fieldErrors.model_key" class="field-error">
              {{ fieldErrors.model_key }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">显示名称 *</label>
            <AppInput
              v-model="form.display_name"
              placeholder="如 通义千问 Turbo"
              @blur="validateField('display_name')"
            />
            <p v-if="fieldErrors.display_name" class="field-error">
              {{ fieldErrors.display_name }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">服务类型 *</label>
            <AppSelect
              v-model="form.service_type"
              :options="serviceTypeOptions"
              :disabled="!isNew"
            />
          </div>

          <div class="form-group">
            <label class="form-label checkbox-label">
              <input
                v-model="form.is_active"
                type="checkbox"
                class="checkbox"
              />
              启用此服务
            </label>
          </div>
        </div>
      </section>

      <!-- Capability JSON -->
      <section class="form-section">
        <h2 class="section-title">能力配置</h2>
        <p class="section-desc">
          根据服务类型 {{ form.service_type.toUpperCase() }} 的 schema
          填写能力描述。
        </p>
        <div v-if="currentFields.length === 0" class="empty-hint">
          未找到 {{ form.service_type }} 的 schema 定义
        </div>
        <div v-else class="cap-fields">
          <div
            v-for="field in currentFields"
            :key="field.name"
            class="form-group form-group--full"
          >
            <label class="form-label">
              <span class="cap-key">{{ field.name }}</span>
              <span v-if="field.required" class="cap-required">*</span>
            </label>
            <p class="cap-desc">{{ field.description }}</p>

            <div
              v-if="
                (field.type === 'modalities' || field.type === 'string_list') &&
                field.enum_values &&
                field.enum_values.length > 0
              "
              class="enum-grid"
            >
              <label
                v-for="ev in field.enum_values"
                :key="ev"
                class="enum-item"
                :class="{ 'enum-item--active': isEnumMember(field.name, ev) }"
              >
                <input
                  type="checkbox"
                  :checked="isEnumMember(field.name, ev)"
                  @change="toggleEnumMember(field, ev)"
                />
                <span>{{ ev }}</span>
              </label>
              <span
                v-for="extra in unknownEnumValues(field)"
                :key="extra"
                class="enum-extra"
                title="schema 未识别的值；会被保留但不可在此取消勾选"
              >
                {{ extra }}
              </span>
            </div>

            <AppInput
              v-else-if="field.type === 'string_list'"
              :model-value="capListText(field.name)"
              placeholder="逗号分隔，如 zh, en"
              @update:model-value="
                (v: string | number | null) =>
                  setCapListFromText(field.name, String(v ?? ''))
              "
            />

            <AppInput
              v-else-if="field.type === 'int'"
              :model-value="capIntValue(field.name)"
              type="number"
              placeholder="0"
              @update:model-value="
                (v: string | number | null) =>
                  setCapInt(field.name, v == null ? '' : String(v))
              "
            />

            <label v-else-if="field.type === 'bool'" class="checkbox-label">
              <input
                type="checkbox"
                class="checkbox"
                :checked="capBoolValue(field.name)"
                @change="
                  setCapValue(
                    field.name,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              {{ field.description }}
            </label>

            <template v-else-if="field.type === 'feature_map'">
              <textarea
                class="json-textarea"
                :value="featureMapText(field.name)"
                rows="4"
                @change="
                  setFeatureMapFromText(
                    field.name,
                    ($event.target as HTMLTextAreaElement).value,
                  )
                "
              />
              <p v-if="fieldErrors[`cap.${field.name}`]" class="field-error">
                {{ fieldErrors[`cap.${field.name}`] }}
              </p>
            </template>

            <AppInput
              v-else
              :model-value="String(getCapValue(field.name) ?? '')"
              @update:model-value="
                (v: string | number | null) =>
                  setCapValue(field.name, String(v ?? ''))
              "
            />
          </div>
        </div>
      </section>

      <!-- Tiers, tags, display -->
      <section class="form-section">
        <h2 class="section-title">档位与属性</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">延迟档位</label>
            <AppSelect v-model="form.latency_tier" :options="tierOptions" />
          </div>
          <div class="form-group">
            <label class="form-label">质量档位</label>
            <AppSelect v-model="form.quality_tier" :options="tierOptions" />
          </div>
          <div class="form-group">
            <label class="form-label">图标 (icon key)</label>
            <AppInput v-model="form.icon" placeholder="如 qwen, doubao" />
          </div>
          <div class="form-group">
            <label class="form-label">排序权重</label>
            <AppInput
              :model-value="form.sort_order"
              type="number"
              placeholder="0"
              @update:model-value="
                (v: string | number | null) => {
                  form.sort_order = typeof v === 'number' ? v : Number(v ?? 0);
                }
              "
            />
          </div>
          <div class="form-group form-group--full">
            <label class="form-label">标签 (tags)</label>
            <AppInput
              v-model="form.tags_input"
              placeholder="逗号分隔，如 推荐, vision"
            />
          </div>
        </div>
      </section>

      <!-- Thinking flags -->
      <section class="form-section">
        <h2 class="section-title">Thinking 配置</h2>
        <div class="form-grid">
          <label class="form-label checkbox-label">
            <input
              v-model="form.is_thinking"
              type="checkbox"
              class="checkbox"
            />
            is_thinking（当前记录代表一个 thinking 变体）
          </label>
          <label class="form-label checkbox-label">
            <input
              v-model="form.supports_thinking"
              type="checkbox"
              class="checkbox"
            />
            supports_thinking（支持开启 thinking 模式）
          </label>
          <label class="form-label checkbox-label">
            <input
              v-model="form.thinking_only"
              type="checkbox"
              class="checkbox"
            />
            thinking_only（仅 thinking 模式可用）
          </label>
        </div>
      </section>

      <!-- Route 配置 (create mode only) -->
      <!-- Plugs the orphan-service hole: a Service can't be created without a Route. -->
      <section v-if="isNew" class="form-section">
        <h2 class="section-title">Route 配置</h2>
        <p class="section-desc">
          新建服务必须同时配置至少一条路由，否则调用会因无可用路由直接失败。
        </p>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Provider *</label>
            <AppSelect
              :model-value="createRouteForm.provider_id ?? ''"
              :options="providerOptions"
              placeholder="选择供应商"
              @update:model-value="
                (v: string | number) => {
                  createRouteForm.provider_id = v === '' ? null : Number(v);
                }
              "
            />
            <p v-if="createRouteErrors.provider_id" class="field-error">
              {{ createRouteErrors.provider_id }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">Provider Model ID *</label>
            <AppInput
              v-model="createRouteForm.provider_model_id"
              placeholder="如 qwen-turbo"
              @blur="validateCreateRoute()"
            />
            <p v-if="createRouteErrors.provider_model_id" class="field-error">
              {{ createRouteErrors.provider_model_id }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label">优先级</label>
            <AppInput
              v-model="createRouteForm.priority"
              type="number"
              placeholder="5"
            />
            <p v-if="createRouteErrors.priority" class="field-error">
              {{ createRouteErrors.priority }}
            </p>
          </div>

          <div class="form-group">
            <label class="form-label checkbox-label">
              <input
                v-model="createRouteForm.is_active"
                type="checkbox"
                class="checkbox"
              />
              启用此路由
            </label>
          </div>
        </div>
      </section>

      <!-- Routes (editable) -->
      <section v-if="!isNew" class="form-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">路由配置</h2>
            <p class="section-desc">
              管理此服务的供应商路由。至少保留一条激活路由。
            </p>
          </div>
          <AppButton variant="secondary" size="sm" @click="openAddRoute">
            <Plus :size="14" />
            新增路由
          </AppButton>
        </div>

        <div v-if="routes.length === 0" class="empty-hint">暂无路由</div>
        <div v-else class="routes-table">
          <!-- Header -->
          <div class="route-header">
            <span>供应商</span>
            <span>模型 ID</span>
            <span>优先级</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          <!-- Rows -->
          <div
            v-for="r in routes"
            :key="r.id"
            class="route-row"
            :class="{ 'route-row--editing': routeEditing.has(r.id) }"
          >
            <span class="route-provider">{{ r.provider_name }}</span>

            <!-- Model ID: editable when in edit mode -->
            <span v-if="!routeEditing.has(r.id)" class="route-model">
              {{ r.provider_model_id }}
            </span>
            <AppInput
              v-else
              v-model="routeEditState[r.id].provider_model_id"
              size="sm"
              placeholder="provider model id"
              class="route-input"
            />

            <!-- Priority: editable when in edit mode -->
            <span v-if="!routeEditing.has(r.id)" class="route-priority">
              {{ r.priority }}
            </span>
            <AppInput
              v-else
              v-model="routeEditState[r.id].priority"
              type="number"
              size="sm"
              placeholder="0"
              class="route-input route-input--sm"
            />

            <!-- Status toggle -->
            <span class="route-status">
              <button
                class="toggle-btn"
                :class="{ 'toggle-btn--active': r.is_active }"
                :disabled="!!routeSaving[r.id]"
                :title="r.is_active ? '点击禁用' : '点击启用'"
                @click="toggleRoute(r)"
              >
                {{ r.is_active ? "启用" : "禁用" }}
              </button>
            </span>

            <!-- Actions -->
            <span class="route-actions">
              <template v-if="!routeEditing.has(r.id)">
                <AppButton
                  variant="ghost"
                  size="sm"
                  :disabled="!!routeSaving[r.id]"
                  @click="startEditRoute(r)"
                >
                  编辑
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="btn-danger"
                  :disabled="!!routeSaving[r.id]"
                  @click="promptDelete(r.id)"
                >
                  <Trash2 :size="14" />
                </AppButton>
              </template>
              <template v-else>
                <AppButton
                  variant="primary"
                  size="sm"
                  :loading="!!routeSaving[r.id]"
                  @click="saveRoute(r)"
                >
                  保存
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  @click="cancelEditRoute(r.id)"
                >
                  取消
                </AppButton>
              </template>
            </span>
          </div>
        </div>
      </section>

      <!-- Pricing Rules Card -->
      <section v-if="!isNew && routes.length > 0" class="form-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">计费规则</h2>
            <p class="section-desc">
              各路由对应的计费规则（来自 pricing_rule 表，按供应商 +
              模型匹配）。
            </p>
          </div>
          <AppButton
            variant="ghost"
            size="sm"
            :loading="pricingLoading"
            @click="loadPricingRules"
          >
            <RefreshCw :size="14" />
            刷新
          </AppButton>
        </div>

        <div v-if="pricingLoading" class="pricing-skeleton" />
        <div v-else class="pricing-list">
          <div v-for="r in routes" :key="r.id" class="pricing-row">
            <div class="pricing-row__route">
              <span class="route-provider">{{ r.provider_name }}</span>
              <span class="route-model">{{ r.provider_model_id }}</span>
            </div>
            <div
              v-if="routePricingMap[r.id] && routePricingMap[r.id].length > 0"
              class="pricing-row__rules"
            >
              <div
                v-for="pr in routePricingMap[r.id]"
                :key="pr.id"
                class="pricing-rule-item"
              >
                <span class="pricing-badge" :class="billingModeCss(pr)">
                  {{ billingModeLabel(pr) }}
                </span>
                <span class="pricing-summary">{{ formatPrice(pr) }}</span>
                <span class="pricing-type">{{ pr.service_type }}</span>
              </div>
            </div>
            <div v-else class="pricing-row__missing">
              <span class="pricing-warn">未找到计费规则 — 调用将不扣费</span>
              <a
                class="pricing-link"
                @click.prevent="router.push('/billing/pricing')"
              >
                编辑计费规则 <ExternalLink :size="12" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Add Route Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="addRouteVisible"
          class="modal-overlay"
          @click.self="addRouteVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">新增路由</h3>
            <div class="modal-form">
              <div class="form-group">
                <label class="form-label">供应商 *</label>
                <AppSelect
                  :model-value="addRouteForm.provider_id ?? ''"
                  :options="providerOptions"
                  placeholder="选择供应商"
                  @update:model-value="
                    (v: string | number) => {
                      addRouteForm.provider_id = v === '' ? null : Number(v);
                    }
                  "
                />
                <p v-if="addRouteErrors.provider_id" class="field-error">
                  {{ addRouteErrors.provider_id }}
                </p>
              </div>
              <div class="form-group">
                <label class="form-label">模型 ID (provider_model_id) *</label>
                <AppInput
                  v-model="addRouteForm.provider_model_id"
                  placeholder="如 qwen-turbo"
                  @blur="validateAddRoute()"
                />
                <p v-if="addRouteErrors.provider_model_id" class="field-error">
                  {{ addRouteErrors.provider_model_id }}
                </p>
              </div>
              <div class="form-group">
                <label class="form-label">优先级</label>
                <AppInput
                  v-model="addRouteForm.priority"
                  type="number"
                  placeholder="0"
                />
                <p v-if="addRouteErrors.priority" class="field-error">
                  {{ addRouteErrors.priority }}
                </p>
              </div>
              <label class="form-label checkbox-label">
                <input
                  v-model="addRouteForm.is_active"
                  type="checkbox"
                  class="checkbox"
                />
                启用此路由
              </label>
            </div>
            <div class="modal-actions">
              <AppButton
                variant="ghost"
                size="sm"
                @click="addRouteVisible = false"
              >
                取消
              </AppButton>
              <AppButton
                variant="primary"
                size="sm"
                :loading="addRouteSaving"
                @click="submitAddRoute"
              >
                创建
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirm Modal -->
    <ConfirmModal
      :visible="deleteConfirmVisible"
      title="确认删除路由"
      message="确定删除此路由？如果这是最后一条激活路由，操作将被拒绝。"
      confirm-text="删除"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="deleteConfirmVisible = false"
    />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.error-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-light);
  color: #991b1b;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.skeleton-block {
  height: 400px;
  background: linear-gradient(
    90deg,
    var(--gray-100) 25%,
    var(--gray-200) 50%,
    var(--gray-100) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-lg);
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

.form-section {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  padding: var(--space-6);
  margin-bottom: var(--space-4);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  gap: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.section-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group--full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.field-error {
  font-size: var(--text-xs);
  color: var(--danger);
  margin-top: var(--space-1);
}

.checkbox-label {
  cursor: pointer;
  flex-direction: row;
  align-items: center;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.cap-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.cap-key {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text);
}

.cap-required {
  color: var(--danger);
  font-weight: 700;
}

.cap-desc {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  margin: 0 0 var(--space-2);
}

.enum-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.enum-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--surface);
  font-size: var(--text-sm);
}

.enum-item--active {
  background: var(--primary-light, #eff6ff);
  border-color: var(--primary);
}

.enum-item input {
  accent-color: var(--primary);
}

.enum-extra {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-low, var(--gray-50));
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
}

.json-textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  color: var(--text);
  background: var(--surface);
  resize: vertical;
  box-sizing: border-box;
}

.json-textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-4);
  text-align: center;
}

/* Routes table */
.routes-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.route-header {
  display: grid;
  grid-template-columns: 1fr 2fr 80px 80px 160px;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--gray-50, var(--surface-low));
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.route-row {
  display: grid;
  grid-template-columns: 1fr 2fr 80px 80px 160px;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border);
  font-size: var(--text-sm);
  transition: background var(--transition-fast);
}

.route-row:hover {
  background: var(--surface-low, var(--gray-50));
}

.route-row--editing {
  background: var(--primary-light, #eff6ff);
}

.route-provider {
  font-weight: 600;
  color: var(--text);
}

.route-model {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.route-priority {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  text-align: center;
}

.route-status {
  display: flex;
  align-items: center;
}

.toggle-btn {
  padding: 2px 10px;
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-btn--active {
  background: var(--success-light, #dcfce7);
  color: #166534;
  border-color: #86efac;
}

.route-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.route-input {
  width: 100%;
}

.route-input--sm {
  max-width: 72px;
}

.btn-danger {
  color: var(--danger);
}

/* Pricing */
.pricing-skeleton {
  height: 80px;
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

.pricing-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pricing-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.pricing-row__route {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 160px;
}

.pricing-row__rules {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}

.pricing-rule-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.pricing-badge {
  padding: 2px 8px;
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.pricing-badge--flat {
  background: var(--gray-100, #f3f4f6);
  color: var(--text-secondary);
}

.pricing-badge--token {
  background: #dbeafe;
  color: #1e40af;
}

.pricing-badge--call {
  background: #fef3c7;
  color: #92400e;
}

.pricing-summary {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text);
}

.pricing-type {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.pricing-row__missing {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
}

.pricing-warn {
  font-size: var(--text-sm);
  color: var(--warning, #d97706);
}

.pricing-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
}

/* Add route modal */
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
</style>
