<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useComplianceRuleStore } from "@/stores/complianceRule";
import type { RuleType } from "@/types/compliance";
import { RULE_TYPE_LABELS } from "@/types/compliance";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const router = useRouter();
const store = useComplianceRuleStore();
const toast = useToast();

// ---------- Mode detection ----------
const ruleId = computed(() => {
  const raw = route.params.id;
  if (!raw || raw === "new") return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
});

const isEditMode = computed(() => ruleId.value !== null);
const pageTitle = computed(() =>
  isEditMode.value ? "编辑合规规则" : "新增合规规则",
);

// ---------- Form state ----------
const ruleTypeOptions = (Object.keys(RULE_TYPE_LABELS) as RuleType[]).map(
  (k) => ({
    value: k,
    label: RULE_TYPE_LABELS[k],
  }),
);

const form = ref({
  parent_user_id: "" as string | number,
  rule_type: "forbid_phrase" as RuleType,
  pattern: "",
  is_active: true,
});

// Track original values to detect dirty state
const savedSnapshot = ref("");

function snapshot() {
  return JSON.stringify(form.value);
}

const isDirty = computed(() => snapshot() !== savedSnapshot.value);

// ---------- Validation ----------
const errors = ref({
  parent_user_id: "",
  pattern: "",
});

function validateParentUserId() {
  const v = form.value.parent_user_id;
  if (v === "" || v === null || v === undefined) {
    errors.value.parent_user_id = "父账户 ID 不能为空";
    return false;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    errors.value.parent_user_id = "请输入有效的正整数 ID";
    return false;
  }
  errors.value.parent_user_id = "";
  return true;
}

function validatePattern() {
  const v = form.value.pattern.trim();
  if (!v) {
    errors.value.pattern = "规则内容不能为空";
    return false;
  }
  if (v.length > 1000) {
    errors.value.pattern = "规则内容不能超过 1000 字符";
    return false;
  }
  errors.value.pattern = "";
  return true;
}

function validateAll(): boolean {
  const a = validateParentUserId();
  const b = validatePattern();
  return a && b;
}

// ---------- Loading (edit mode) ----------
onMounted(async () => {
  if (isEditMode.value && ruleId.value !== null) {
    try {
      await store.fetchOne(ruleId.value);
      const r = store.current;
      if (r) {
        form.value = {
          parent_user_id: r.parent_user_id,
          rule_type: r.rule_type,
          pattern: r.pattern,
          is_active: r.is_active,
        };
      }
    } catch {
      toast.error(store.currentError ?? "加载失败");
    }
  }
  // Capture snapshot AFTER populate so isDirty starts false
  savedSnapshot.value = snapshot();
});

// Update snapshot when saved form comes back in edit mode
watch(
  () => store.current,
  (val) => {
    if (val && isEditMode.value) {
      savedSnapshot.value = snapshot();
    }
  },
);

// ---------- Dirty-leave guard ----------
const leaveConfirmVisible = ref(false);
let leaveResolve: ((ok: boolean) => void) | null = null;

onBeforeRouteLeave((_to, _from, next) => {
  if (!isDirty.value) {
    next();
    return;
  }
  leaveConfirmVisible.value = true;
  new Promise<boolean>((resolve) => {
    leaveResolve = resolve;
  }).then((ok) => {
    next(ok ? undefined : false);
  });
});

function confirmLeave() {
  leaveConfirmVisible.value = false;
  leaveResolve?.(true);
  leaveResolve = null;
}

function cancelLeave() {
  leaveConfirmVisible.value = false;
  leaveResolve?.(false);
  leaveResolve = null;
}

// ---------- Submit ----------
async function handleSubmit() {
  if (!validateAll()) return;

  try {
    if (isEditMode.value && ruleId.value !== null) {
      await store.update(ruleId.value, {
        rule_type: form.value.rule_type,
        pattern: form.value.pattern.trim(),
        is_active: form.value.is_active,
      });
      toast.success("规则已更新");
    } else {
      await store.create({
        parent_user_id: Number(form.value.parent_user_id),
        rule_type: form.value.rule_type,
        pattern: form.value.pattern.trim(),
        is_active: form.value.is_active,
      });
      toast.success("规则已创建");
    }
    // Update snapshot so isDirty becomes false before navigation
    savedSnapshot.value = snapshot();
    router.push("/compliance-rules");
  } catch (e: unknown) {
    toast.error((e as Error).message || "保存失败");
  }
}

function handleCancel() {
  router.push("/compliance-rules");
}
</script>

<template>
  <div class="rule-form">
    <div class="rule-form__header">
      <h2 class="rule-form__title">{{ pageTitle }}</h2>
    </div>

    <!-- Loading indicator for edit mode -->
    <div v-if="store.currentLoading" class="rule-form__loading">
      <div class="skeleton skeleton--line" />
      <div class="skeleton skeleton--line skeleton--line-sm" />
    </div>

    <!-- Error state for edit mode -->
    <div v-else-if="store.currentError" class="rule-form__error-banner">
      <span>{{ store.currentError }}</span>
      <AppButton
        v-if="ruleId"
        variant="ghost"
        size="sm"
        @click="store.fetchOne(ruleId!)"
      >
        重试
      </AppButton>
    </div>

    <!-- Form -->
    <form
      v-else
      class="rule-form__body"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <!-- parent_user_id — only editable in create mode -->
      <div class="form-field">
        <label class="form-label" for="parent_user_id">
          父账户 ID <span class="required">*</span>
        </label>
        <AppInput
          id="parent_user_id"
          v-model="form.parent_user_id"
          type="number"
          placeholder="输入父账户的用户 ID"
          :disabled="isEditMode"
          :error="errors.parent_user_id"
          @blur="validateParentUserId"
        />
        <p v-if="isEditMode" class="form-hint">编辑模式下无法变更父账户</p>
      </div>

      <!-- rule_type -->
      <div class="form-field">
        <label class="form-label">
          规则类型 <span class="required">*</span>
        </label>
        <div class="radio-group">
          <label
            v-for="opt in ruleTypeOptions"
            :key="opt.value"
            class="radio-option"
            :class="{ 'radio-option--active': form.rule_type === opt.value }"
          >
            <input
              v-model="form.rule_type"
              type="radio"
              :value="opt.value"
              class="radio-input"
            />
            <span class="radio-label">{{ opt.label }}</span>
          </label>
        </div>
      </div>

      <!-- pattern -->
      <div class="form-field">
        <label class="form-label" for="pattern">
          规则内容 <span class="required">*</span>
        </label>
        <div
          class="textarea-wrapper"
          :class="{ 'textarea-wrapper--error': !!errors.pattern }"
        >
          <textarea
            id="pattern"
            v-model="form.pattern"
            class="form-textarea"
            placeholder="输入规则匹配内容（正则表达式或关键词）"
            rows="4"
            maxlength="1000"
            @blur="validatePattern"
          />
        </div>
        <div class="form-footer-row">
          <p v-if="errors.pattern" class="form-error">{{ errors.pattern }}</p>
          <p v-else class="form-hint">支持正则表达式，最多 1000 字符</p>
          <span class="char-count">{{ form.pattern.length }} / 1000</span>
        </div>
      </div>

      <!-- is_active -->
      <div class="form-field form-field--inline">
        <label class="form-label" for="is_active">启用规则</label>
        <label class="toggle-switch" for="is_active">
          <input
            id="is_active"
            v-model="form.is_active"
            type="checkbox"
            class="toggle-input"
          />
          <span class="toggle-track">
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-text">{{
            form.is_active ? "已启用" : "已停用"
          }}</span>
        </label>
      </div>

      <!-- Actions -->
      <div class="rule-form__actions">
        <AppButton
          variant="primary"
          type="submit"
          :loading="store.saving"
          :disabled="store.saving"
        >
          {{ isEditMode ? "保存修改" : "创建规则" }}
        </AppButton>
        <AppButton
          variant="secondary"
          :disabled="store.saving"
          @click="handleCancel"
        >
          取消
        </AppButton>
      </div>
    </form>

    <!-- Dirty-leave confirm modal -->
    <ConfirmModal
      :visible="leaveConfirmVisible"
      title="放弃未保存的更改？"
      message="当前表单有未保存的内容，离开后将丢失。确定要离开吗？"
      confirm-text="离开"
      cancel-text="继续编辑"
      :danger="true"
      @confirm="confirmLeave"
      @cancel="cancelLeave"
    />
  </div>
</template>

<style scoped>
.rule-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  max-width: 640px;
}

.rule-form__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.rule-form__title {
  font-family: var(--font-headline);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0;
}

.rule-form__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.rule-form__error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-surface, #fef2f2);
  border: 1px solid var(--danger-border, #fca5a5);
  border-radius: var(--radius-sm);
  color: var(--danger, #dc2626);
  font-size: var(--text-sm);
}

.rule-form__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-field--inline {
  flex-direction: row;
  align-items: center;
  gap: var(--space-4);
}

.form-label {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.required {
  color: var(--danger, #dc2626);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin: 0;
}

.form-error {
  font-size: var(--text-xs);
  color: var(--danger, #dc2626);
  margin: 0;
}

/* Radio group */
.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.radio-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(169, 180, 185, 0.2);
  background: var(--surface-low);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.radio-option:hover {
  background: var(--surface-high);
}

.radio-option--active {
  border-color: var(--tertiary);
  background: var(--surface-lowest);
  box-shadow: 0 0 0 1px var(--tertiary);
}

.radio-input {
  accent-color: var(--tertiary);
}

.radio-label {
  font-size: var(--text-sm);
  color: var(--on-surface);
  user-select: none;
}

/* Textarea */
.textarea-wrapper {
  border-radius: var(--radius-sm);
  transition: box-shadow var(--transition-fast);
}

.textarea-wrapper:focus-within {
  box-shadow: 0 0 0 1px var(--tertiary);
}

.textarea-wrapper--error {
  box-shadow: 0 0 0 1px var(--danger, #dc2626);
}

.textarea-wrapper--error:focus-within {
  box-shadow: 0 0 0 1px var(--danger, #dc2626);
}

.form-textarea {
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-low);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-sm);
  color: var(--on-surface);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.form-textarea::placeholder {
  color: var(--on-surface-variant);
  font-family: var(--font-body);
}

.form-footer-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.char-count {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Toggle switch */
.toggle-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  background: var(--surface-high);
  border-radius: 11px;
  transition: background var(--transition-fast);
}

.toggle-input:checked + .toggle-track {
  background: var(--tertiary, #5b7ff1);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked ~ .toggle-track .toggle-thumb,
.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
}

.toggle-text {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
}

/* Actions */
.rule-form__actions {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

/* Skeleton */
.skeleton {
  height: 38px;
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

.skeleton--line-sm {
  height: 22px;
  width: 60%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
