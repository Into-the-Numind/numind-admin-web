<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  getTaskApi,
  updateTaskApi,
  listServicesApi,
  validateAgainstApi,
} from "@/api/ai";
import type {
  TaskProfile,
  AIService,
  TaskBinding,
  MatchResult,
} from "@/types/ai";
import AppButton from "@/components/common/AppButton.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import { ArrowLeft, AlertTriangle, GripVertical } from "lucide-vue-next";

const router = useRouter();
const route = useRoute();
const toast = useToast();

const taskKey = computed(() => String(route.params.id));

const loading = ref(false);
const saving = ref(false);
const error = ref("");

const task = ref<TaskProfile | null>(null);
const services = ref<AIService[]>([]);

// Validation results per service id
const validationMap = ref<Record<number, MatchResult>>({});
const validating = ref<Record<number, boolean>>({});

// Form state
const selectedDefaultId = ref<number | null>(null);
const selectedFallbackId = ref<number | null>(null);
const selectedAllowedIds = ref<number[]>([]);

// Force override dialog
const forceDialogVisible = ref(false);
const overrideReason = ref("");
const incompatibleBindings = ref<string[]>([]);
const pendingForce = ref(false);

// Service options (all + none)
const serviceOptions = computed(() => [
  { label: "（无）", value: 0 },
  ...services.value.map((s) => ({
    label: s.display_name || s.name,
    value: s.id,
  })),
]);

function isCompatible(serviceId: number): boolean {
  const result = validationMap.value[serviceId];
  if (!result) return true; // not yet validated = optimistic
  return result.compatible;
}

function incompatibleReason(serviceId: number): string {
  const result = validationMap.value[serviceId];
  if (!result || result.compatible) return "";
  return `缺少能力: ${result.missing_capabilities.join(", ")}`;
}

async function validateService(serviceId: number) {
  if (!serviceId || !task.value) return;
  if (validationMap.value[serviceId] !== undefined) return; // already validated
  validating.value[serviceId] = true;
  try {
    const result = await validateAgainstApi(task.value.task_id, serviceId);
    validationMap.value[serviceId] = result;
  } catch {
    // ignore validation errors
  } finally {
    validating.value[serviceId] = false;
  }
}

async function onDefaultChange(val: number | string) {
  const id = Number(val);
  selectedDefaultId.value = id || null;
  if (id) await validateService(id);
}

async function onFallbackChange(val: number | string) {
  const id = Number(val);
  selectedFallbackId.value = id || null;
  if (id) await validateService(id);
}

async function toggleAllowed(serviceId: number) {
  const idx = selectedAllowedIds.value.indexOf(serviceId);
  if (idx === -1) {
    selectedAllowedIds.value.push(serviceId);
    await validateService(serviceId);
  } else {
    selectedAllowedIds.value.splice(idx, 1);
  }
}

function collectIncompatible(): string[] {
  const msgs: string[] = [];
  const check = (id: number | null, label: string) => {
    if (!id) return;
    const r = validationMap.value[id];
    if (r && !r.compatible) {
      msgs.push(`${label}: 缺少 ${r.missing_capabilities.join(", ")}`);
    }
  };
  check(selectedDefaultId.value, "默认服务");
  check(selectedFallbackId.value, "Fallback 服务");
  selectedAllowedIds.value.forEach((id) => check(id, `允许服务 #${id}`));
  return msgs;
}

async function save(force = false) {
  if (saving.value) return;

  // Check for incompatible bindings
  if (!force) {
    const incompatible = collectIncompatible();
    if (incompatible.length > 0) {
      incompatibleBindings.value = incompatible;
      forceDialogVisible.value = true;
      return;
    }
  }

  saving.value = true;
  pendingForce.value = false;
  try {
    const binding: TaskBinding = {
      default_service_id: selectedDefaultId.value,
      fallback_service_id: selectedFallbackId.value,
      allowed_service_ids: [...selectedAllowedIds.value],
      force_override: force,
      override_reason: force ? overrideReason.value : undefined,
    };
    await updateTaskApi(taskKey.value, {
      binding,
      override_reason: force ? overrideReason.value : undefined,
    });
    toast.success("任务配置已保存");
    router.push("/ai-tasks");
  } catch (e) {
    const err = e as Error & { code?: number };
    if (err.code === 41001) {
      // incompatible bindings from server
      incompatibleBindings.value = [err.message];
      forceDialogVisible.value = true;
    } else {
      toast.error(err.message || "保存失败");
    }
  } finally {
    saving.value = false;
  }
}

async function confirmForceOverride() {
  if (!overrideReason.value.trim()) {
    toast.error("请填写强制覆盖原因");
    return;
  }
  forceDialogVisible.value = false;
  await save(true);
}

async function loadData() {
  loading.value = true;
  error.value = "";
  try {
    const [taskRes, servicesRes] = await Promise.all([
      getTaskApi(taskKey.value),
      listServicesApi({ page: 1, page_size: 100 }),
    ]);
    task.value = taskRes;
    services.value = servicesRes.list ?? [];

    // Wait for Vue to render the service options before setting selected values
    await nextTick();

    // Populate form from API response (top-level fields, not nested binding)
    const data = taskRes as any;
    selectedDefaultId.value = data.default_service_id ?? null;
    // fallbacks is an array of service objects; take first one's id
    const fallbackArr = data.fallbacks as any[] | null;
    selectedFallbackId.value =
      fallbackArr && fallbackArr.length > 0 ? fallbackArr[0].id : null;
    // allowed is an array of service objects; extract ids
    const allowedArr = data.allowed as any[] | null;
    selectedAllowedIds.value = (allowedArr ?? []).map((s: any) => s.id);

    // Force another tick to ensure select elements reflect the new values
    await nextTick();

    // Pre-validate existing selections
    const toValidate = [
      selectedDefaultId.value,
      selectedFallbackId.value,
      ...selectedAllowedIds.value,
    ].filter((id): id is number => !!id);
    await Promise.all(toValidate.map(validateService));
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

watch(taskKey, loadData);
onMounted(loadData);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__left">
        <AppButton variant="ghost" size="sm" @click="router.push('/ai-tasks')">
          <ArrowLeft :size="16" />
        </AppButton>
        <div>
          <h1 class="page-title">{{ task?.display_name ?? "任务配置" }}</h1>
          <p v-if="task?.task_id" class="task-key">{{ task.task_id }}</p>
        </div>
      </div>
      <AppButton variant="primary" :loading="saving" @click="save(false)">
        保存
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

    <template v-else-if="task">
      <!-- Task info -->
      <section class="form-section">
        <h2 class="section-title">任务信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">任务描述</span>
            <span class="info-value">{{ task.description || "—" }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">服务类型</span>
            <span class="info-value">{{
              (task as any).service_type?.toUpperCase() || "—"
            }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">能力要求</span>
            <div class="cap-tags">
              <template v-if="(task as any).requirements">
                <span
                  v-for="(val, key) in (task as any).requirements"
                  :key="String(key)"
                  class="cap-tag"
                >
                  {{ key }}: {{ Array.isArray(val) ? val.join(", ") : val }}
                </span>
              </template>
              <span v-else class="info-value">—</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Service binding -->
      <section class="form-section">
        <h2 class="section-title">服务绑定</h2>

        <!-- Default service -->
        <div class="binding-row">
          <label class="binding-label">默认服务</label>
          <div class="binding-control">
            <AppSelect
              :model-value="selectedDefaultId ?? 0"
              :options="serviceOptions"
              @update:model-value="onDefaultChange"
            />
            <div
              v-if="selectedDefaultId && !isCompatible(selectedDefaultId)"
              class="compat-warning"
            >
              <AlertTriangle :size="14" />
              {{ incompatibleReason(selectedDefaultId) }}
            </div>
          </div>
        </div>

        <!-- Fallback service -->
        <div class="binding-row">
          <label class="binding-label">Fallback 服务</label>
          <div class="binding-control">
            <AppSelect
              :model-value="selectedFallbackId ?? 0"
              :options="serviceOptions"
              @update:model-value="onFallbackChange"
            />
            <div
              v-if="selectedFallbackId && !isCompatible(selectedFallbackId)"
              class="compat-warning"
            >
              <AlertTriangle :size="14" />
              {{ incompatibleReason(selectedFallbackId) }}
            </div>
          </div>
        </div>

        <!-- Allowed services -->
        <div class="binding-row binding-row--top">
          <label class="binding-label">允许服务</label>
          <div class="binding-control">
            <div class="allowed-list">
              <label
                v-for="svc in services"
                :key="svc.id"
                class="allowed-item"
                :class="{
                  'allowed-item--selected': selectedAllowedIds.includes(svc.id),
                  'allowed-item--incompatible':
                    selectedAllowedIds.includes(svc.id) &&
                    !isCompatible(svc.id),
                }"
                :title="
                  selectedAllowedIds.includes(svc.id) && !isCompatible(svc.id)
                    ? incompatibleReason(svc.id)
                    : undefined
                "
              >
                <input
                  type="checkbox"
                  :checked="selectedAllowedIds.includes(svc.id)"
                  @change="toggleAllowed(svc.id)"
                />
                <GripVertical :size="12" class="grip-icon" />
                <span class="svc-name">{{ svc.display_name || svc.name }}</span>
                <span class="svc-type">{{
                  svc.service_type.toUpperCase()
                }}</span>
                <AlertTriangle
                  v-if="
                    selectedAllowedIds.includes(svc.id) && !isCompatible(svc.id)
                  "
                  :size="12"
                  class="incompat-icon"
                />
              </label>
            </div>
            <p v-if="services.length === 0" class="empty-hint">暂无可用服务</p>
          </div>
        </div>
      </section>
    </template>

    <!-- Force override dialog -->
    <ConfirmModal
      :visible="forceDialogVisible"
      title="检测到不兼容绑定"
      confirm-text="强制保存"
      cancel-text="返回修改"
      :danger="true"
      @confirm="confirmForceOverride"
      @cancel="forceDialogVisible = false"
    >
      <div class="force-dialog-body">
        <p class="force-desc">以下绑定存在能力不匹配问题：</p>
        <ul class="incompat-list">
          <li v-for="(msg, i) in incompatibleBindings" :key="i">{{ msg }}</li>
        </ul>
        <div class="reason-group">
          <label class="form-label">强制覆盖原因 *</label>
          <textarea
            v-model="overrideReason"
            class="reason-textarea"
            placeholder="请说明为什么要强制绑定不兼容的服务..."
            rows="3"
          />
        </div>
      </div>
    </ConfirmModal>
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

.task-key {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  margin-top: 2px;
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
  margin-bottom: var(--space-4);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.info-item {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.info-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 80px;
}

.info-value {
  font-size: var(--text-sm);
  color: var(--text);
}

.cap-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.cap-tag {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  background: var(--gray-100);
  color: var(--text-secondary);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.binding-row {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  margin-bottom: var(--space-4);
}

.binding-row--top {
  align-items: flex-start;
}

.binding-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
  min-width: 100px;
  flex-shrink: 0;
}

.binding-control {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.compat-warning {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--warning, #d97706);
}

.allowed-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}

.allowed-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  border: 1px solid transparent;
}

.allowed-item:hover {
  background: var(--gray-50);
}

.allowed-item--selected {
  background: var(--primary-light, #eff6ff);
  border-color: var(--primary);
}

.allowed-item--incompatible {
  background: var(--warning-light, #fffbeb);
  border-color: var(--warning, #d97706);
}

.allowed-item input {
  accent-color: var(--primary);
  flex-shrink: 0;
}

.grip-icon {
  color: var(--gray-300);
  flex-shrink: 0;
}

.svc-name {
  font-size: var(--text-sm);
  color: var(--text);
  flex: 1;
}

.svc-type {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--gray-100);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
}

.incompat-icon {
  color: var(--warning, #d97706);
  flex-shrink: 0;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-align: center;
  padding: var(--space-4);
}

.form-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
  margin-bottom: var(--space-2);
  display: block;
}

.force-dialog-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.force-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.incompat-list {
  padding-left: var(--space-4);
  font-size: var(--text-sm);
  color: var(--danger);
}

.incompat-list li {
  margin-bottom: var(--space-1);
}

.reason-group {
  display: flex;
  flex-direction: column;
}

.reason-textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--surface);
  resize: vertical;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.reason-textarea:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
