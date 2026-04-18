<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  getProviderApi,
  createProviderApi,
  updateProviderApi,
  testProviderConnectionApi,
} from "@/api/ai";
import type {
  ProviderDTO,
  CreateProviderRequest,
  UpdateProviderRequest,
} from "@/types/ai";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import { useToast } from "@/composables/useToast";
import { ArrowLeft, RefreshCw, Wifi } from "lucide-vue-next";

const router = useRouter();
const route = useRoute();
const toast = useToast();

const isNew = computed(() => route.params.id === "new");
const providerId = computed(() => (isNew.value ? 0 : Number(route.params.id)));

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const error = ref("");

// Masked api_key from GET response — shown as placeholder in edit mode
const maskedApiKey = ref("");

// Reset Key inline state
const showResetKey = ref(false);
const resetKeyValue = ref("");

interface ProviderForm {
  name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  is_active: boolean;
}

const form = ref<ProviderForm>({
  name: "",
  display_name: "",
  base_url: "",
  api_key: "",
  is_active: true,
});

const fieldErrors = ref<Record<string, string>>({});

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
  if (field === "base_url") {
    if (!v.base_url.trim()) {
      fieldErrors.value.base_url = "Base URL 不能为空";
    } else if (!/^https?:\/\/.+/.test(v.base_url.trim())) {
      fieldErrors.value.base_url = "Base URL 必须以 http:// 或 https:// 开头";
    } else {
      fieldErrors.value.base_url = "";
    }
  }
  if (field === "api_key" && isNew.value) {
    fieldErrors.value.api_key = v.api_key.trim() ? "" : "API Key 不能为空";
  }
}

function validateAll(): boolean {
  validateField("name");
  validateField("display_name");
  validateField("base_url");
  if (isNew.value) validateField("api_key");
  return !Object.values(fieldErrors.value).some(Boolean);
}

function applyProvider(p: ProviderDTO) {
  form.value = {
    name: p.name,
    display_name: p.display_name,
    base_url: p.base_url,
    api_key: "",
    is_active: p.is_active,
  };
  maskedApiKey.value = p.api_key;
}

async function loadData() {
  loading.value = true;
  error.value = "";
  try {
    if (!isNew.value) {
      const p = await getProviderApi(providerId.value);
      applyProvider(p);
    }
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!validateAll()) {
    toast.error("请检查必填项");
    return;
  }
  if (saving.value) return;
  saving.value = true;
  try {
    if (isNew.value) {
      const payload: CreateProviderRequest = {
        name: form.value.name.trim(),
        display_name: form.value.display_name.trim(),
        base_url: form.value.base_url.trim(),
        api_key: form.value.api_key.trim(),
        is_active: form.value.is_active,
      };
      await createProviderApi(payload);
      toast.success("供应商已创建");
    } else {
      const payload: UpdateProviderRequest = {
        display_name: form.value.display_name.trim(),
        base_url: form.value.base_url.trim(),
        is_active: form.value.is_active,
      };
      // Only send api_key if user explicitly set a new one via reset
      if (showResetKey.value && resetKeyValue.value.trim()) {
        payload.api_key = resetKeyValue.value.trim();
      }
      await updateProviderApi(providerId.value, payload);
      toast.success("供应商已更新");
    }
    router.push("/ai-providers");
  } catch (e) {
    toast.error((e as Error).message || "保存失败");
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  if (testing.value) return;
  testing.value = true;
  try {
    const result = await testProviderConnectionApi(providerId.value);
    if (result.success) {
      const latencyStr =
        result.latency_ms != null ? `（${result.latency_ms}ms）` : "";
      toast.success(`连接成功${latencyStr}`);
    } else {
      toast.error(`连接失败：${result.error ?? "未知错误"}`);
    }
  } catch (e) {
    toast.error((e as Error).message || "测试连接失败");
  } finally {
    testing.value = false;
  }
}

function toggleResetKey() {
  showResetKey.value = !showResetKey.value;
  if (!showResetKey.value) {
    resetKeyValue.value = "";
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
          @click="router.push('/ai-providers')"
        >
          <ArrowLeft :size="16" />
        </AppButton>
        <h1 class="page-title">
          {{ isNew ? "新增 AI 供应商" : "编辑 AI 供应商" }}
        </h1>
      </div>
      <AppButton variant="primary" :loading="saving" @click="save">
        {{ isNew ? "创建" : "保存" }}
      </AppButton>
    </div>

    <div v-if="loading" class="skeleton-block" />

    <div v-else-if="error" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="loadData">
        重试
      </AppButton>
    </div>

    <template v-else>
      <!-- Basic Info -->
      <section class="form-section">
        <h2 class="section-title">基本信息</h2>
        <div class="form-grid">
          <!-- Name -->
          <div class="form-group">
            <label class="form-label">
              标识 (name) *
              <span v-if="!isNew" class="field-hint">（创建后不可修改）</span>
            </label>
            <AppInput
              v-model="form.name"
              placeholder="如 aliyun-dashscope"
              :disabled="!isNew"
              @blur="validateField('name')"
            />
            <p v-if="fieldErrors.name" class="field-error">
              {{ fieldErrors.name }}
            </p>
          </div>

          <!-- Display Name -->
          <div class="form-group">
            <label class="form-label">显示名称 *</label>
            <AppInput
              v-model="form.display_name"
              placeholder="如 阿里云 DashScope"
              @blur="validateField('display_name')"
            />
            <p v-if="fieldErrors.display_name" class="field-error">
              {{ fieldErrors.display_name }}
            </p>
          </div>

          <!-- Base URL -->
          <div class="form-group form-group--full">
            <label class="form-label">Base URL *</label>
            <AppInput
              v-model="form.base_url"
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
              @blur="validateField('base_url')"
            />
            <p v-if="fieldErrors.base_url" class="field-error">
              {{ fieldErrors.base_url }}
            </p>
          </div>

          <!-- API Key (create mode) -->
          <div v-if="isNew" class="form-group form-group--full">
            <label class="form-label">API Key *</label>
            <AppInput
              v-model="form.api_key"
              placeholder="sk-..."
              @blur="validateField('api_key')"
            />
            <p v-if="fieldErrors.api_key" class="field-error">
              {{ fieldErrors.api_key }}
            </p>
          </div>

          <!-- API Key (edit mode) -->
          <div v-else class="form-group form-group--full">
            <label class="form-label">API Key</label>
            <div class="api-key-row">
              <span class="api-key-masked">{{
                maskedApiKey || "••••••••"
              }}</span>
              <span class="api-key-hint">留空保留原值</span>
              <AppButton
                size="sm"
                variant="secondary"
                class="reset-key-btn"
                @click="toggleResetKey"
              >
                <RefreshCw :size="13" />
                {{ showResetKey ? "取消重置" : "重置 Key" }}
              </AppButton>
            </div>
            <div v-if="showResetKey" class="reset-key-field">
              <AppInput
                v-model="resetKeyValue"
                placeholder="输入新的 API Key"
                class="reset-key-input"
              />
              <p class="reset-key-desc">保存后新 Key 将替换当前值</p>
            </div>
          </div>

          <!-- Is Active -->
          <div class="form-group">
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
      </section>

      <!-- Test Connection (edit mode only) -->
      <section v-if="!isNew" class="form-section form-section--actions">
        <h2 class="section-title">连接测试</h2>
        <p class="section-desc">
          使用当前保存的 API Key 和 Base URL 发起连通性测试。
        </p>
        <AppButton
          variant="secondary"
          :loading="testing"
          @click="testConnection"
        >
          <Wifi :size="16" />
          测试连接
        </AppButton>
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

.form-section--actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
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

.field-hint {
  font-size: var(--text-xs);
  font-weight: 400;
  color: var(--on-surface-variant);
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

.api-key-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-low, var(--gray-50));
}

.api-key-masked {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text);
  flex: 1;
  letter-spacing: 0.05em;
}

.api-key-hint {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  white-space: nowrap;
}

.reset-key-btn {
  flex-shrink: 0;
}

.reset-key-field {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.reset-key-input {
  width: 100%;
}

.reset-key-desc {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
}
</style>
