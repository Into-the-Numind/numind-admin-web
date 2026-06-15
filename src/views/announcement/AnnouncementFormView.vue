<script setup lang="ts">
// AnnouncementFormView — create/edit announcement or survey (notification-center spec §6.2).
// Mode determined by :id route param. Published announcements freeze type + questions.
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useAnnouncementStore } from "@/stores/announcement";
import type {
  QuestionInput,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
} from "@/api/announcements";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import SurveyQuestionBuilder from "@/components/announcement/SurveyQuestionBuilder.vue";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const router = useRouter();
const store = useAnnouncementStore();
const toast = useToast();

// ---------- Mode detection ----------
const announcementId = computed(() => {
  const raw = route.params.id;
  if (!raw || raw === "new") return null;
  const n = Number(raw);
  return isNaN(n) ? null : n;
});

const isEditMode = computed(() => announcementId.value !== null);
const pageTitle = computed(() => (isEditMode.value ? "编辑公告" : "新建公告"));

// Published announcements: type frozen, questions read-only.
const isPublished = computed(() => store.current?.status === "published");
const typeLocked = computed(() => isEditMode.value && isPublished.value);
const questionsLocked = computed(() => isEditMode.value && isPublished.value);

// ---------- Form state ----------
const typeOptions = [
  { value: "plain", label: "公告" },
  { value: "survey", label: "问卷" },
];

const form = ref({
  type: "plain" as string,
  title: "",
  content: "",
  is_important: false,
  expires_at: "" as string,
});

const questions = ref<QuestionInput[]>([]);

const savedSnapshot = ref("");

function snapshot() {
  return JSON.stringify({ form: form.value, questions: questions.value });
}

const isDirty = computed(() => snapshot() !== savedSnapshot.value);

// ---------- Validation (blur) ----------
const errors = ref({
  title: "",
  content: "",
});

function validateTitle() {
  const v = form.value.title.trim();
  if (!v) {
    errors.value.title = "标题不能为空";
    return false;
  }
  if (v.length > 200) {
    errors.value.title = "标题不能超过 200 字符";
    return false;
  }
  errors.value.title = "";
  return true;
}

function validateContent() {
  const v = form.value.content.trim();
  if (!v) {
    errors.value.content = "正文不能为空";
    return false;
  }
  errors.value.content = "";
  return true;
}

function validateAll(): boolean {
  const a = validateTitle();
  const b = validateContent();
  return a && b;
}

// ---------- Datetime helpers ----------
// <input type="datetime-local"> uses a wall-clock string "YYYY-MM-DDTHH:mm" (no tz).
// Backend binds expires_at as *time.Time → requires RFC3339 with a timezone offset.
// Round-trip: the input value is interpreted as the browser's LOCAL time on save,
// stored as UTC RFC3339, then converted back to local for display on reload — so the
// user always sees the same wall-clock time they picked.
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Backend UTC RFC3339 (e.g. "2026-07-01T06:30:00Z") → local "YYYY-MM-DDTHH:mm".
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

// Local input "YYYY-MM-DDTHH:mm" → UTC RFC3339 (e.g. "2026-07-01T06:30:00.000Z").
function toBackendDatetime(local: string): string | null {
  if (!local) return null;
  const d = new Date(local); // parsed as local time
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------- Loading (edit mode) ----------
async function loadDetail() {
  if (!isEditMode.value || announcementId.value === null) return;
  try {
    const detail = await store.get(announcementId.value);
    form.value = {
      type: detail.type,
      title: detail.title,
      content: detail.content,
      is_important: detail.is_important,
      expires_at: toLocalInput(detail.expires_at),
    };
    questions.value = (detail.questions ?? []).map((q) => ({
      order_index: q.order_index,
      question_type: q.question_type,
      title: q.title,
      required: q.required,
      options: q.options ?? null,
      rating_max: q.rating_max ?? null,
      rating_style: q.rating_style ?? null,
    }));
    // Snapshot AFTER populate so isDirty starts false.
    savedSnapshot.value = snapshot();
  } catch {
    toast.error(store.currentError ?? "加载失败");
  }
}

// Retry button handler — awaits in try/catch so the @click never leaves an
// unhandled rejection (store already records the error for the banner).
async function retryLoad() {
  try {
    await loadDetail();
  } catch {
    // store.currentError drives the banner; nothing else to do here.
  }
}

onMounted(async () => {
  await loadDetail();
  // For create mode (loadDetail no-ops) snapshot the empty form so isDirty starts false.
  if (!isEditMode.value) savedSnapshot.value = snapshot();
});

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

// When switching to plain, drop questions; when switching to survey, seed empty.
watch(
  () => form.value.type,
  (next, prev) => {
    if (typeLocked.value) return;
    if (next === "plain") {
      questions.value = [];
    } else if (next === "survey" && prev === "plain") {
      // keep whatever the builder has (likely empty)
    }
  },
);

// ---------- Submit ----------
async function handleSubmit() {
  if (!validateAll()) return;

  const isSurvey = form.value.type === "survey";
  try {
    if (isEditMode.value && announcementId.value !== null) {
      const payload: UpdateAnnouncementPayload = {
        title: form.value.title.trim(),
        content: form.value.content.trim(),
        is_important: form.value.is_important,
        expires_at: toBackendDatetime(form.value.expires_at),
      };
      // Questions only editable while draft (backend freezes published).
      if (isSurvey && !questionsLocked.value) {
        payload.questions = questions.value;
      }
      await store.update(announcementId.value, payload);
      toast.success("公告已保存");
    } else {
      const payload: CreateAnnouncementPayload = {
        type: form.value.type,
        title: form.value.title.trim(),
        content: form.value.content.trim(),
        is_important: form.value.is_important,
        expires_at: toBackendDatetime(form.value.expires_at),
        status: "draft",
      };
      if (isSurvey) {
        payload.questions = questions.value;
      }
      await store.create(payload);
      toast.success("公告已创建");
    }
    savedSnapshot.value = snapshot();
    router.push("/announcements");
  } catch (e) {
    toast.error((e as Error).message || "保存失败");
  }
}

function handleCancel() {
  router.push("/announcements");
}
</script>

<template>
  <div class="ann-form">
    <div class="ann-form__header">
      <div>
        <p class="ann-form__breadcrumb">Notification / Announcements</p>
        <h2 class="ann-form__title">{{ pageTitle }}</h2>
      </div>
    </div>

    <!-- Loading (edit mode) -->
    <div v-if="store.currentLoading" class="ann-form__loading">
      <div class="skeleton skeleton--line" />
      <div class="skeleton skeleton--line skeleton--line-sm" />
    </div>

    <!-- Error (edit mode) -->
    <div v-else-if="store.currentError" class="ann-form__error-banner">
      <span>{{ store.currentError }}</span>
      <AppButton
        v-if="announcementId"
        variant="ghost"
        size="sm"
        @click="retryLoad"
      >
        重试
      </AppButton>
    </div>

    <!-- Form -->
    <form
      v-else
      class="ann-form__body"
      novalidate
      @submit.prevent="handleSubmit"
    >
      <!-- 标题 -->
      <div class="form-field">
        <label class="form-label" for="ann-title">
          标题 <span class="required">*</span>
        </label>
        <AppInput
          id="ann-title"
          v-model="form.title"
          placeholder="输入公告标题"
          :error="errors.title"
          @blur="validateTitle"
        />
      </div>

      <!-- 类型 -->
      <div class="form-field">
        <label class="form-label"> 类型 <span class="required">*</span> </label>
        <div class="select-block">
          <AppSelect
            v-model="form.type"
            :options="typeOptions"
            :disabled="typeLocked"
            size="md"
            placeholder=""
          />
        </div>
        <p v-if="typeLocked" class="form-hint">已发布公告不可变更类型</p>
      </div>

      <!-- 正文 -->
      <div class="form-field">
        <label class="form-label" for="ann-content">
          正文 <span class="required">*</span>
        </label>
        <div
          class="textarea-wrapper"
          :class="{ 'textarea-wrapper--error': !!errors.content }"
        >
          <textarea
            id="ann-content"
            v-model="form.content"
            class="form-textarea"
            placeholder="输入公告正文（支持 Markdown）"
            rows="8"
            @blur="validateContent"
          />
        </div>
        <div class="form-footer-row">
          <p v-if="errors.content" class="form-error">{{ errors.content }}</p>
          <p v-else class="form-hint">支持 Markdown 格式</p>
        </div>
      </div>

      <!-- 重要标记 -->
      <div class="form-field form-field--inline">
        <label class="form-label" for="ann-important">重要标记</label>
        <label class="toggle-switch" for="ann-important">
          <input
            id="ann-important"
            v-model="form.is_important"
            type="checkbox"
            class="toggle-input"
          />
          <span class="toggle-track"><span class="toggle-thumb" /></span>
          <span class="toggle-text">{{
            form.is_important ? "已标记为重要" : "普通"
          }}</span>
        </label>
      </div>

      <!-- 过期时间 -->
      <div class="form-field">
        <label class="form-label" for="ann-expires">过期时间（可选）</label>
        <input
          id="ann-expires"
          v-model="form.expires_at"
          type="datetime-local"
          class="datetime-input"
        />
        <p class="form-hint">留空表示永不过期</p>
      </div>

      <!-- Survey question builder -->
      <div v-if="form.type === 'survey'" class="form-field">
        <SurveyQuestionBuilder
          v-model="questions"
          :disabled="questionsLocked"
        />
        <p v-if="questionsLocked" class="form-hint">
          已发布问卷的题目已冻结，无法修改
        </p>
      </div>

      <!-- Actions -->
      <div class="ann-form__actions">
        <AppButton
          variant="primary"
          type="submit"
          :loading="store.saving"
          :disabled="store.saving"
        >
          {{ isEditMode ? "保存修改" : "创建公告" }}
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

    <!-- Dirty-leave confirm -->
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
.ann-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  max-width: 720px;
}

.ann-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ann-form__breadcrumb {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-1);
}

.ann-form__title {
  font-family: var(--font-headline);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0;
}

.ann-form__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ann-form__error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: var(--text-sm);
}

.ann-form__body {
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
  color: var(--danger);
}

.form-hint {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin: 0;
}

.form-error {
  font-size: var(--text-xs);
  color: var(--danger);
  margin: 0;
}

.select-block {
  display: inline-flex;
  width: 200px;
}

.select-block :deep(.app-select-wrapper) {
  width: 100%;
}

/* Textarea (mirrors ComplianceRuleForm) */
.textarea-wrapper {
  border-radius: var(--radius-sm);
  transition: box-shadow var(--transition-fast);
}

.textarea-wrapper:focus-within {
  box-shadow: 0 0 0 1px var(--tertiary);
}

.textarea-wrapper--error,
.textarea-wrapper--error:focus-within {
  box-shadow: 0 0 0 1px var(--danger);
}

.form-textarea {
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-low);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--on-surface);
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.form-textarea::placeholder {
  color: var(--on-surface-variant);
}

.form-footer-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.datetime-input {
  width: 240px;
  height: 38px;
  padding: 0 var(--space-3);
  background: var(--surface-low);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--on-surface);
  outline: none;
}

.datetime-input:focus {
  box-shadow: 0 0 0 1px var(--tertiary);
}

/* Toggle switch (mirrors ComplianceRuleForm) */
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
  background: var(--tertiary);
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

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
}

.toggle-text {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
}

.ann-form__actions {
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
