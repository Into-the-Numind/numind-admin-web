<script setup lang="ts">
// SurveyQuestionBuilder — v-model is a QuestionInput[] (notification-center spec §6.2).
// Client-side hints only; backend is the validation authority (spec §3.2 create rules).
import { computed } from "vue";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  X,
  AlertTriangle,
} from "lucide-vue-next";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import AppButton from "@/components/common/AppButton.vue";
import type {
  QuestionInput,
  QuestionType,
  RatingStyle,
} from "@/api/announcements";

interface Props {
  modelValue: QuestionInput[];
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: QuestionInput[]];
}>();

const questionTypeOptions = [
  { value: "single", label: "单选" },
  { value: "multi", label: "多选" },
  { value: "rating", label: "评分" },
  { value: "text", label: "文本" },
];

const ratingStyleOptions = [
  { value: "star", label: "星级" },
  { value: "nps", label: "NPS" },
];

// Emit a fresh array (immutable update) with order_index re-normalised.
function commit(next: QuestionInput[]) {
  const reindexed = next.map((q, i) => ({ ...q, order_index: i }));
  emit("update:modelValue", reindexed);
}

function makeQuestion(): QuestionInput {
  return {
    order_index: props.modelValue.length,
    question_type: "single",
    title: "",
    required: true,
    options: ["", ""],
    rating_max: null,
    rating_style: null,
  };
}

function addQuestion() {
  if (props.disabled) return;
  commit([...props.modelValue, makeQuestion()]);
}

function removeQuestion(idx: number) {
  if (props.disabled) return;
  commit(props.modelValue.filter((_, i) => i !== idx));
}

function moveUp(idx: number) {
  if (props.disabled || idx <= 0) return;
  const next = [...props.modelValue];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  commit(next);
}

function moveDown(idx: number) {
  if (props.disabled || idx >= props.modelValue.length - 1) return;
  const next = [...props.modelValue];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  commit(next);
}

// Patch one question and re-emit; resets shape-specific fields when type changes.
function patchQuestion(idx: number, patch: Partial<QuestionInput>) {
  if (props.disabled) return;
  const next = props.modelValue.map((q, i) =>
    i === idx ? { ...q, ...patch } : q,
  );
  commit(next);
}

function onTypeChange(idx: number, raw: string | number) {
  const type = String(raw) as QuestionType;
  const base: Partial<QuestionInput> = { question_type: type };
  if (type === "single" || type === "multi") {
    const existing = props.modelValue[idx].options;
    base.options = existing && existing.length >= 2 ? existing : ["", ""];
    base.rating_max = null;
    base.rating_style = null;
  } else if (type === "rating") {
    base.options = null;
    base.rating_max = props.modelValue[idx].rating_max ?? 5;
    base.rating_style = (props.modelValue[idx].rating_style ??
      "star") as RatingStyle;
  } else {
    // text
    base.options = null;
    base.rating_max = null;
    base.rating_style = null;
  }
  patchQuestion(idx, base);
}

function updateTitle(idx: number, value: string | number | null) {
  patchQuestion(idx, { title: String(value ?? "") });
}

function toggleRequired(idx: number, event: Event) {
  patchQuestion(idx, {
    required: (event.target as HTMLInputElement).checked,
  });
}

function updateRatingMax(idx: number, value: string | number | null) {
  const n = value === null || value === "" ? null : Number(value);
  patchQuestion(idx, { rating_max: n });
}

function updateRatingStyle(idx: number, value: string | number) {
  patchQuestion(idx, { rating_style: String(value) });
}

// --- Option editing (single / multi) ---
function addOption(idx: number) {
  if (props.disabled) return;
  const opts = [...(props.modelValue[idx].options ?? [])];
  opts.push("");
  patchQuestion(idx, { options: opts });
}

function removeOption(qIdx: number, optIdx: number) {
  if (props.disabled) return;
  const opts = (props.modelValue[qIdx].options ?? []).filter(
    (_, i) => i !== optIdx,
  );
  patchQuestion(qIdx, { options: opts });
}

function updateOption(
  qIdx: number,
  optIdx: number,
  value: string | number | null,
) {
  const opts = [...(props.modelValue[qIdx].options ?? [])];
  opts[optIdx] = String(value ?? "");
  patchQuestion(qIdx, { options: opts });
}

function isChoice(q: QuestionInput): boolean {
  return q.question_type === "single" || q.question_type === "multi";
}

// Client-side validity hints (advisory; backend enforces).
function optionWarning(q: QuestionInput): string | null {
  if (!isChoice(q)) return null;
  const opts = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
  if (opts.length < 2) return "至少需要 2 个有效选项";
  return null;
}

function ratingWarning(q: QuestionInput): string | null {
  if (q.question_type !== "rating") return null;
  const max = q.rating_max;
  if (max === null || max === undefined || max < 2 || max > 10) {
    return "最大分值需在 2–10 之间";
  }
  return null;
}

const hasQuestions = computed(() => props.modelValue.length > 0);
</script>

<template>
  <div class="sqb">
    <div class="sqb__header">
      <span class="sqb__title">问卷题目</span>
      <span v-if="disabled" class="sqb__frozen">已发布，题目已冻结</span>
    </div>

    <p v-if="!hasQuestions" class="sqb__empty">
      还没有题目，点击下方按钮添加第一题。
    </p>

    <div
      v-for="(q, idx) in modelValue"
      :key="idx"
      class="question-card"
      :class="{ 'question-card--disabled': disabled }"
    >
      <div class="question-card__bar">
        <span class="question-card__index">题 {{ idx + 1 }}</span>
        <div class="question-card__bar-actions">
          <button
            type="button"
            class="icon-btn"
            :disabled="disabled || idx === 0"
            aria-label="上移"
            @click="moveUp(idx)"
          >
            <ArrowUp :size="14" />
          </button>
          <button
            type="button"
            class="icon-btn"
            :disabled="disabled || idx === modelValue.length - 1"
            aria-label="下移"
            @click="moveDown(idx)"
          >
            <ArrowDown :size="14" />
          </button>
          <button
            type="button"
            class="icon-btn icon-btn--danger"
            :disabled="disabled"
            aria-label="删除题目"
            @click="removeQuestion(idx)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <div class="question-card__row">
        <div class="question-card__field question-card__field--type">
          <label class="sqb-label">题型</label>
          <AppSelect
            :model-value="q.question_type"
            :options="questionTypeOptions"
            :disabled="disabled"
            size="md"
            @update:model-value="onTypeChange(idx, $event)"
          />
        </div>
        <div class="question-card__field question-card__field--title">
          <label class="sqb-label">题干</label>
          <AppInput
            :model-value="q.title"
            placeholder="输入题干"
            :disabled="disabled"
            @update:model-value="updateTitle(idx, $event)"
          />
        </div>
        <div class="question-card__field question-card__field--required">
          <label class="sqb-label">必答</label>
          <label class="toggle-switch">
            <input
              type="checkbox"
              class="toggle-input"
              :checked="q.required !== false"
              :disabled="disabled"
              @change="toggleRequired(idx, $event)"
            />
            <span class="toggle-track"><span class="toggle-thumb" /></span>
          </label>
        </div>
      </div>

      <!-- single / multi: option editor -->
      <div v-if="isChoice(q)" class="question-card__options">
        <label class="sqb-label">选项</label>
        <div
          v-for="(opt, optIdx) in q.options ?? []"
          :key="optIdx"
          class="option-row"
        >
          <AppInput
            :model-value="opt"
            :placeholder="`选项 ${optIdx + 1}`"
            :disabled="disabled"
            size="sm"
            @update:model-value="updateOption(idx, optIdx, $event)"
          />
          <button
            type="button"
            class="icon-btn icon-btn--danger"
            :disabled="disabled || (q.options ?? []).length <= 2"
            aria-label="删除选项"
            @click="removeOption(idx, optIdx)"
          >
            <X :size="14" />
          </button>
        </div>
        <AppButton
          size="sm"
          variant="ghost"
          :disabled="disabled"
          @click="addOption(idx)"
        >
          <Plus :size="14" /> 添加选项
        </AppButton>
        <p v-if="optionWarning(q)" class="sqb-warning">
          <AlertTriangle :size="12" /> {{ optionWarning(q) }}
        </p>
      </div>

      <!-- rating: max + style -->
      <div v-else-if="q.question_type === 'rating'" class="question-card__row">
        <div class="question-card__field">
          <label class="sqb-label">最大分值 (2–10)</label>
          <AppInput
            :model-value="q.rating_max ?? null"
            type="number"
            placeholder="5"
            :disabled="disabled"
            size="md"
            @update:model-value="updateRatingMax(idx, $event)"
          />
        </div>
        <div class="question-card__field">
          <label class="sqb-label">评分样式</label>
          <AppSelect
            :model-value="q.rating_style ?? 'star'"
            :options="ratingStyleOptions"
            :disabled="disabled"
            size="md"
            @update:model-value="updateRatingStyle(idx, $event)"
          />
        </div>
        <div class="question-card__field question-card__field--grow">
          <p v-if="ratingWarning(q)" class="sqb-warning sqb-warning--inline">
            <AlertTriangle :size="12" /> {{ ratingWarning(q) }}
          </p>
        </div>
      </div>

      <!-- text: no extra config -->
      <p v-else class="sqb-hint">文本题，无需额外配置。</p>
    </div>

    <AppButton variant="secondary" :disabled="disabled" @click="addQuestion">
      <Plus :size="14" /> 添加题目
    </AppButton>
  </div>
</template>

<style scoped>
.sqb {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sqb__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.sqb__title {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sqb__frozen {
  font-size: var(--text-xs);
  color: var(--warning);
}

.sqb__empty {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
  margin: 0;
}

.question-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--surface-low);
  border: 1px solid rgba(169, 180, 185, 0.2);
  border-radius: var(--radius-sm);
}

.question-card--disabled {
  opacity: 0.8;
}

.question-card__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.question-card__index {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
}

.question-card__bar-actions {
  display: flex;
  gap: var(--space-1);
}

.question-card__row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: flex-end;
}

.question-card__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.question-card__field--type {
  min-width: 110px;
}

.question-card__field--title {
  flex: 1;
  min-width: 200px;
}

.question-card__field--required {
  align-items: flex-start;
}

.question-card__field--grow {
  flex: 1;
  justify-content: center;
}

.question-card__options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.option-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.option-row :deep(.app-input-field) {
  flex: 1;
}

.sqb-label {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sqb-hint {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin: 0;
}

.sqb-warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--warning);
  margin: 0;
}

.sqb-warning--inline {
  margin-top: 0;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-btn:hover:not(:disabled) {
  background: var(--surface-high);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn--danger:hover:not(:disabled) {
  color: var(--danger);
  background: var(--danger-soft);
}

/* Toggle switch (mirrors ComplianceRuleForm) */
.toggle-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  height: 38px;
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

.toggle-input:disabled + .toggle-track {
  opacity: 0.5;
}
</style>
