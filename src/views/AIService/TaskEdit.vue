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
  TaskDetailResponse,
  AIService,
  UpdateTaskRequest,
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

const taskId = computed(() => String(route.params.id));

const loading = ref(false);
const saving = ref(false);
const error = ref("");

const task = ref<TaskDetailResponse | null>(null);
const services = ref<AIService[]>([]);

// Validation results per service id
const validationMap = ref<Record<number, MatchResult>>({});
const validating = ref<Record<number, boolean>>({});

// Form state
const selectedDefaultId = ref<number | null>(null);
const selectedFallbackIds = ref<number[]>([]);
const selectedAllowedIds = ref<number[]>([]);

// Force override dialog
const forceDialogVisible = ref(false);
const overrideReason = ref("");
const incompatibleBindings = ref<string[]>([]);

// Options for AppSelect (default service only)
const serviceSelectOptions = computed(() => [
  { label: "（无）", value: "" },
  ...services.value.map((svc) => ({
    label: svc.display_name || svc.model_key,
    value: String(svc.id),
  })),
]);

const defaultSelectValue = computed({
  get: () => String(selectedDefaultId.value ?? ""),
  set: (v: string | number | null) => {
    selectedDefaultId.value = v ? Number(v) : null;
  },
});

// All active services available for multi-select fallback picker
const availableServices = computed(() => services.value);

function isCompatible(serviceId: number): boolean {
  const result = validationMap.value[serviceId];
  if (!result) return true; // not yet validated = optimistic
  return result.compatible;
}

function incompatibleReason(serviceId: number): string {
  const result = validationMap.value[serviceId];
  if (!result || result.compatible) return "";
  return `缺少能力: ${result.reasons.join(", ")}`;
}

async function validateService(serviceId: number) {
  if (!serviceId || !task.value) return;
  if (validationMap.value[serviceId] !== undefined) return; // already validated
  validating.value[serviceId] = true;
  try {
    const result = await validateAgainstApi(taskId.value, serviceId);
    validationMap.value[serviceId] = result;
  } catch {
    // ignore validation errors
  } finally {
    validating.value[serviceId] = false;
  }
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
      msgs.push(`${label}: 缺少 ${r.reasons.join(", ")}`);
    }
  };
  check(selectedDefaultId.value, "默认服务");
  selectedFallbackIds.value.forEach((id, i) =>
    check(id, `Fallback 服务 #${i + 1}`),
  );
  selectedAllowedIds.value.forEach((id) => check(id, `允许服务 #${id}`));
  return msgs;
}

async function save(force = false) {
  if (saving.value) return;

  if (!force) {
    const incompatible = collectIncompatible();
    if (incompatible.length > 0) {
      incompatibleBindings.value = incompatible;
      forceDialogVisible.value = true;
      return;
    }
  }

  saving.value = true;
  try {
    const payload: UpdateTaskRequest = {
      default_service_id: selectedDefaultId.value,
      fallback_service_ids: [...selectedFallbackIds.value],
      allowed_service_ids: [...selectedAllowedIds.value],
      reason: force ? overrideReason.value : undefined,
    };
    await updateTaskApi(taskId.value, payload, force);
    toast.success("任务配置已保存");
    router.push("/ai-tasks");
  } catch (e) {
    const err = e as Error & { code?: number | string };
    if (err.code === "AIService.CapabilityMismatch") {
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
      getTaskApi(taskId.value),
      listServicesApi({ page: 1, page_size: 100 }),
    ]);
    task.value = taskRes;
    services.value = servicesRes.list ?? [];

    await nextTick();

    selectedDefaultId.value = taskRes.default_service_id ?? null;
    selectedFallbackIds.value = (taskRes.fallbacks ?? []).map((s) => s.id);
    selectedAllowedIds.value = (taskRes.allowed ?? []).map((s) => s.id);

    await nextTick();

    const toValidate = [
      selectedDefaultId.value,
      ...selectedFallbackIds.value,
      ...selectedAllowedIds.value,
    ].filter((id): id is number => !!id);
    await Promise.all(toValidate.map(validateService));
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

watch(taskId, loadData);
onMounted(loadData);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <p class="page-breadcrumb">AI Services / Task Edit</p>
      <div class="page-header__row">
        <div class="page-header__left">
          <AppButton
            variant="ghost"
            size="sm"
            @click="router.push('/ai-tasks')"
          >
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
              task.service_type?.toUpperCase() || "—"
            }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">能力要求</span>
            <div class="cap-tags">
              <template v-if="task.requirements">
                <span
                  v-for="(val, key) in task.requirements"
                  :key="String(key)"
                  class="cap-tag"
                >
                  {{ key }}:
                  {{
                    Array.isArray(val)
                      ? val.join(", ")
                      : typeof val === "object" && val !== null
                        ? Object.keys(val)
                            .filter((k) => (val as Record<string, unknown>)[k])
                            .join(", ")
                        : val
                  }}
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
              v-model="defaultSelectValue"
              :options="serviceSelectOptions"
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

        <!-- Fallback services (multi-select) -->
        <div class="binding-row binding-row--top">
          <label class="binding-label">备用服务</label>
          <div class="binding-control">
            <label class="form-label">备用服务（可多选）</label>
            <select
              v-model="selectedFallbackIds"
              multiple
              :size="Math.min(8, availableServices.length)"
              class="multi-select"
            >
              <option
                v-for="svc in availableServices"
                :key="svc.id"
                :value="svc.id"
              >
                {{ svc.display_name || svc.model_key }} ({{ svc.model_key }})
              </option>
            </select>
            <p class="form-hint">按住 Ctrl/Cmd 多选。空选代表无备用服务</p>
            <template
              v-for="fbId in selectedFallbackIds"
              :key="fbId"
            >
              <div
                v-if="!isCompatible(fbId)"
                class="compat-warning"
              >
                <AlertTriangle :size="14" />
                {{ incompatibleReason(fbId) }}
              </div>
            </template>
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
                <span class="svc-name">{{
                  svc.display_name || svc.model_key
                }}</span>
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
.page-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.page-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.task-key {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  font-family: var(--font-mono);
  margin-top: 2px;
}

.skeleton-block {
  height: 400px;
  background: linear-gradient(
    90deg,
    var(--surface-low) 25%,
    var(--surface-high) 50%,
    var(--surface-low) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
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
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(169, 180, 185, 0.05);
  padding: var(--space-6);
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
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 80px;
}

.info-value {
  font-size: var(--text-sm);
  color: var(--on-surface);
}

.cap-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.cap-tag {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  background: var(--surface-low);
  color: var(--on-surface-variant);
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
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  border-radius: var(--radius-sm);
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
  background: var(--surface-low);
}

.allowed-item--selected {
  background: var(--primary-container, #eff6ff);
  border-color: var(--primary);
}

.allowed-item--incompatible {
  background: var(--warning-soft, #fffbeb);
  border-color: var(--warning, #d97706);
}

.allowed-item input {
  accent-color: var(--primary);
  flex-shrink: 0;
}

.grip-icon {
  color: var(--on-surface-variant);
  opacity: 0.4;
  flex-shrink: 0;
}

.svc-name {
  font-size: var(--text-sm);
  color: var(--on-surface);
  flex: 1;
}

.svc-type {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--on-surface-variant);
  background: var(--surface-low);
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
}

.incompat-icon {
  color: var(--warning, #d97706);
  flex-shrink: 0;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
  text-align: center;
  padding: var(--space-4);
}

.force-dialog-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.force-desc {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
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
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--on-surface);
  background: var(--surface-low);
  resize: vertical;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.reason-textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.form-label {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-1);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin-top: var(--space-1);
}

.multi-select {
  width: 100%;
  min-height: 96px; /* ~3-4 rows */
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-low);
  color: var(--on-surface);
  font-size: var(--text-sm);
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color var(--transition-fast);
  appearance: auto;
  cursor: pointer;
}

.multi-select:focus {
  outline: none;
  border-color: var(--primary);
}

.multi-select option {
  padding: var(--space-1) var(--space-2);
  color: var(--on-surface);
  background: var(--surface-low);
}

.multi-select option:checked {
  background: var(--primary-container, #eff6ff);
  color: var(--on-surface);
}
</style>
