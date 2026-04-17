<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  getServiceApi,
  createServiceApi,
  updateServiceApi,
  getCapabilitySchemaApi,
} from "@/api/ai";
import type {
  AIServiceDetail,
  AIServiceRoute,
  CapabilityField,
  CapabilitySchemaMap,
  CreateServiceRequest,
  UpdateServiceRequest,
} from "@/types/ai";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import { useToast } from "@/composables/useToast";
import { ArrowLeft } from "lucide-vue-next";

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

const routes = ref<AIServiceRoute[]>([]);

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
  // Preserve values that are not in EnumValues so schema evolution (or a stored
  // value the UI doesn't render as a checkbox) doesn't get silently dropped.
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

async function loadData() {
  loading.value = true;
  error.value = "";
  try {
    const [schemaRes] = await Promise.all([getCapabilitySchemaApi()]);
    capabilitySchemaMap.value = schemaRes ?? {};

    if (!isNew.value) {
      const svc = await getServiceApi(serviceId.value);
      applyService(svc);
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

async function save() {
  if (!validateAll()) {
    toast.error("请检查必填项");
    return;
  }
  if (Object.entries(fieldErrors.value).some(([, v]) => v)) {
    toast.error("请修正表单错误后再保存");
    return;
  }
  if (saving.value) return;
  saving.value = true;
  try {
    if (isNew.value) {
      const payload: CreateServiceRequest = buildPayloadBase();
      await createServiceApi(payload);
      toast.success("服务已创建");
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

      <!-- Routes (read-only) -->
      <section v-if="!isNew" class="form-section">
        <h2 class="section-title">路由配置（只读）</h2>
        <p class="section-desc">
          路由（provider / 定价）请在「LLM 供应商」页面维护。
        </p>
        <div v-if="routes.length === 0" class="empty-hint">暂无路由</div>
        <div v-else class="routes-list">
          <div v-for="r in routes" :key="r.id" class="route-row">
            <span class="route-provider">{{ r.provider_name }}</span>
            <span class="route-model">{{ r.provider_model_id }}</span>
            <span class="route-priority">优先级 {{ r.priority }}</span>
            <span class="route-pricing">
              <template v-if="r.pricing_unit === 'per_call'">
                ¥{{ r.price_per_call ?? 0 }} / 次
              </template>
              <template v-else-if="r.pricing_unit === 'per_second'">
                ¥{{ r.price_per_second ?? 0 }} / 秒
              </template>
              <template v-else>
                ¥{{ r.input_price_per_mtok }} /
                {{ r.output_price_per_mtok }} /Mtok
              </template>
            </span>
            <span
              class="route-status"
              :class="{ 'route-status--off': !r.is_active }"
            >
              {{ r.is_active ? "启用" : "禁用" }}
            </span>
          </div>
        </div>
      </section>
    </template>
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

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.section-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
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

.routes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr auto 1.5fr auto;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.route-provider {
  font-weight: 600;
  color: var(--text);
}

.route-model {
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.route-priority,
.route-pricing {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.route-status {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--success);
}

.route-status--off {
  color: var(--text-secondary);
}
</style>
