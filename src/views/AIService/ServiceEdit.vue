<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  getServiceApi,
  createServiceApi,
  updateServiceApi,
  getCapabilitySchemaApi,
} from "@/api/ai";
import type { AIService, AIServiceRoute, CapabilitySchema } from "@/types/ai";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import { useToast } from "@/composables/useToast";
import { ArrowLeft, Plus, Trash2 } from "lucide-vue-next";

const router = useRouter();
const route = useRoute();
const toast = useToast();

const isNew = computed(() => route.params.id === "new");
const serviceId = computed(() => (isNew.value ? 0 : Number(route.params.id)));

const loading = ref(false);
const saving = ref(false);
const error = ref("");
const capabilitySchema = ref<CapabilitySchema>({});

// ====== Form ======

interface RouteForm {
  environment: string;
  endpoint: string;
  api_key: string;
  extra_params_str: string;
}

interface ServiceForm {
  name: string;
  display_name: string;
  service_type: string;
  provider: string;
  model_id: string;
  capabilities: string[];
  routes: RouteForm[];
  is_active: boolean;
  meta: Record<string, unknown>;
}

const form = ref<ServiceForm>({
  name: "",
  display_name: "",
  service_type: "llm",
  provider: "",
  model_id: "",
  capabilities: [],
  routes: [
    {
      environment: "prod",
      endpoint: "",
      api_key: "",
      extra_params_str: "",
    },
  ],
  is_active: true,
  meta: {},
});

// Validation errors (blur-triggered)
const fieldErrors = ref<Record<string, string>>({});

// ====== Options ======

const serviceTypeOptions = [
  { label: "LLM (大语言模型)", value: "llm" },
  { label: "OCR (光学识别)", value: "ocr" },
  { label: "ASR (语音识别)", value: "asr" },
];

const environmentOptions = [
  { label: "生产 (prod)", value: "prod" },
  { label: "开发 (dev)", value: "dev" },
  { label: "测试 (qa)", value: "qa" },
];

// ====== Capability fields based on service_type ======

const currentCapabilityFields = computed(() => {
  const schema = capabilitySchema.value;
  if (!schema || Object.keys(schema).length === 0) return [];
  const relevant = Object.entries(schema).filter(([, def]) => {
    // Show fields relevant to current service_type
    const name = def.name ?? "";
    const type = form.value.service_type;
    if (type === "llm") return true;
    if (type === "ocr") return name.toLowerCase().includes("ocr");
    if (type === "asr") return name.toLowerCase().includes("asr");
    return true;
  });
  return relevant.map(([key, def]) => ({ key, ...def }));
});

function toggleCapability(cap: string) {
  const idx = form.value.capabilities.indexOf(cap);
  if (idx === -1) {
    form.value.capabilities.push(cap);
  } else {
    form.value.capabilities.splice(idx, 1);
  }
}

// ====== Dynamic meta fields for pricing ======

const metaInputPrice = computed({
  get: () => String(form.value.meta.input_price_per_mtok ?? ""),
  set: (v: string) => {
    form.value.meta = {
      ...form.value.meta,
      input_price_per_mtok: v ? Number(v) : undefined,
    };
  },
});

const metaOutputPrice = computed({
  get: () => String(form.value.meta.output_price_per_mtok ?? ""),
  set: (v: string) => {
    form.value.meta = {
      ...form.value.meta,
      output_price_per_mtok: v ? Number(v) : undefined,
    };
  },
});

// ====== Routes helpers ======

function addRoute() {
  form.value.routes.push({
    environment: "dev",
    endpoint: "",
    api_key: "",
    extra_params_str: "",
  });
}

function removeRoute(idx: number) {
  form.value.routes.splice(idx, 1);
}

// ====== Validation ======

function validateField(field: string) {
  const v = form.value;
  if (field === "name") {
    fieldErrors.value.name = v.name.trim() ? "" : "标识不能为空";
  }
  if (field === "display_name") {
    fieldErrors.value.display_name = v.display_name.trim()
      ? ""
      : "显示名称不能为空";
  }
  if (field === "provider") {
    fieldErrors.value.provider = v.provider.trim() ? "" : "供应商不能为空";
  }
  if (field === "model_id") {
    fieldErrors.value.model_id = v.model_id.trim() ? "" : "模型 ID 不能为空";
  }
}

function validateAll(): boolean {
  validateField("name");
  validateField("display_name");
  validateField("provider");
  validateField("model_id");
  return !Object.values(fieldErrors.value).some(Boolean);
}

// ====== Load ======

function applyService(s: AIService) {
  form.value = {
    name: s.name,
    display_name: s.display_name,
    service_type: s.service_type,
    provider: s.provider,
    model_id: s.model_id,
    capabilities: [...(s.capabilities ?? [])],
    routes: (s.routes ?? []).map((r: AIServiceRoute) => ({
      environment: r.environment,
      endpoint: r.endpoint,
      api_key: "",
      extra_params_str: r.extra_params
        ? JSON.stringify(r.extra_params, null, 2)
        : "",
    })),
    is_active: s.is_active,
    meta: { ...(s.meta ?? {}) },
  };
}

async function loadData() {
  loading.value = true;
  error.value = "";
  try {
    const [schemaRes] = await Promise.all([getCapabilitySchemaApi()]);
    capabilitySchema.value = schemaRes ?? {};

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

// ====== Save ======

async function save() {
  if (!validateAll()) {
    toast.error("请检查必填项");
    return;
  }
  if (saving.value) return;
  saving.value = true;
  try {
    const routes: AIServiceRoute[] = form.value.routes
      .filter((r) => r.endpoint.trim())
      .map((r) => {
        let extra: Record<string, unknown> | undefined;
        if (r.extra_params_str.trim()) {
          try {
            extra = JSON.parse(r.extra_params_str);
          } catch {
            // ignore malformed JSON
          }
        }
        const route: AIServiceRoute = {
          environment: r.environment,
          endpoint: r.endpoint,
          extra_params: extra,
        };
        if (r.api_key.trim()) {
          (route as AIServiceRoute & { api_key?: string }).api_key = r.api_key;
        }
        return route;
      });

    const payload = {
      name: form.value.name,
      display_name: form.value.display_name,
      service_type: form.value.service_type,
      provider: form.value.provider,
      model_id: form.value.model_id,
      capabilities: form.value.capabilities,
      routes,
      meta: form.value.meta,
    };

    if (isNew.value) {
      await createServiceApi(payload);
      toast.success("服务已创建");
    } else {
      await updateServiceApi(serviceId.value, {
        ...payload,
        is_active: form.value.is_active,
      });
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

    <!-- Loading skeleton -->
    <div v-if="loading" class="skeleton-block" />

    <!-- Error state -->
    <div v-else-if="error" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="loadData"
        >重试</AppButton
      >
    </div>

    <!-- Form -->
    <template v-else>
      <!-- Basic Info -->
      <section class="form-section">
        <h2 class="section-title">基本信息</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">标识 (name) *</label>
            <AppInput
              v-model="form.name"
              placeholder="如 ali-qwen-turbo"
              :disabled="!isNew"
              @blur="validateField('name')"
            />
            <p v-if="fieldErrors.name" class="field-error">
              {{ fieldErrors.name }}
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
            />
          </div>

          <div class="form-group">
            <label class="form-label">供应商 *</label>
            <AppInput
              v-model="form.provider"
              placeholder="如 ali、volc、baidu"
              @blur="validateField('provider')"
            />
            <p v-if="fieldErrors.provider" class="field-error">
              {{ fieldErrors.provider }}
            </p>
          </div>

          <div class="form-group form-group--full">
            <label class="form-label">模型 ID *</label>
            <AppInput
              v-model="form.model_id"
              placeholder="如 qwen-turbo"
              @blur="validateField('model_id')"
            />
            <p v-if="fieldErrors.model_id" class="field-error">
              {{ fieldErrors.model_id }}
            </p>
          </div>

          <div v-if="!isNew" class="form-group form-group--full">
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

      <!-- Capabilities -->
      <section class="form-section">
        <h2 class="section-title">能力标签</h2>
        <p class="section-desc">选择此服务具备的能力，用于任务匹配。</p>
        <div v-if="currentCapabilityFields.length > 0" class="capability-grid">
          <label
            v-for="cap in currentCapabilityFields"
            :key="cap.key"
            class="capability-item"
            :class="{
              'capability-item--active': form.capabilities.includes(cap.key),
            }"
          >
            <input
              type="checkbox"
              :checked="form.capabilities.includes(cap.key)"
              @change="toggleCapability(cap.key)"
            />
            <span class="cap-key">{{ cap.key }}</span>
            <span class="cap-label">{{ cap.label }}</span>
          </label>
        </div>
        <div v-else class="capability-manual">
          <label class="form-label">能力列表（逗号分隔）</label>
          <AppInput
            :model-value="form.capabilities.join(', ')"
            placeholder="如 chat, function_calling, vision"
            @update:model-value="
              (v: string | number | null) => {
                form.capabilities = String(v ?? '')
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean);
              }
            "
          />
        </div>
      </section>

      <!-- Pricing -->
      <section class="form-section">
        <h2 class="section-title">计费信息</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">输入价格 (¥/Mtok)</label>
            <AppInput
              v-model="metaInputPrice"
              type="number"
              placeholder="0.00"
            />
          </div>
          <div class="form-group">
            <label class="form-label">输出价格 (¥/Mtok)</label>
            <AppInput
              v-model="metaOutputPrice"
              type="number"
              placeholder="0.00"
            />
          </div>
        </div>
      </section>

      <!-- Routes -->
      <section class="form-section">
        <div class="section-header">
          <h2 class="section-title">路由配置</h2>
          <AppButton size="sm" variant="secondary" @click="addRoute">
            <Plus :size="14" />
            添加路由
          </AppButton>
        </div>

        <div
          v-for="(routeItem, idx) in form.routes"
          :key="idx"
          class="route-card"
        >
          <div class="route-card__header">
            <span class="route-index">路由 #{{ idx + 1 }}</span>
            <AppButton
              v-if="form.routes.length > 1"
              size="sm"
              variant="ghost"
              @click="removeRoute(idx)"
            >
              <Trash2 :size="14" style="color: var(--danger)" />
            </AppButton>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">环境</label>
              <AppSelect
                v-model="routeItem.environment"
                :options="environmentOptions"
              />
            </div>
            <div class="form-group">
              <label class="form-label">端点 URL</label>
              <AppInput
                v-model="routeItem.endpoint"
                placeholder="https://..."
              />
            </div>
            <div class="form-group form-group--full">
              <label class="form-label">
                API Key
                <span v-if="!isNew" class="hint">（留空则不修改）</span>
              </label>
              <AppInput
                v-model="routeItem.api_key"
                type="password"
                placeholder="sk-..."
              />
            </div>
            <div class="form-group form-group--full">
              <label class="form-label">额外参数 (JSON)</label>
              <textarea
                v-model="routeItem.extra_params_str"
                class="json-textarea"
                placeholder='{"temperature": 0.7}'
                rows="3"
              />
            </div>
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

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-4);
}

.section-header .section-title {
  margin-bottom: 0;
}

.section-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
  margin-top: calc(-1 * var(--space-2));
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

.hint {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: var(--text-xs);
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

.capability-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.capability-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--surface);
}

.capability-item--active {
  background: var(--primary-light, #eff6ff);
  border-color: var(--primary);
}

.capability-item input {
  accent-color: var(--primary);
}

.cap-key {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--text);
}

.cap-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.capability-manual {
  display: flex;
  flex-direction: column;
}

.route-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  margin-bottom: var(--space-3);
}

.route-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.route-index {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
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
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.json-textarea:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
