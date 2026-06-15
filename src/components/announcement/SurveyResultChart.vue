<script setup lang="ts">
// SurveyResultChart — pure presentation for one aggregated survey question
// (notification-center spec §6.2 / §3.2 survey-results shape). No chart library:
// horizontal bars are plain divs with CSS width%. All divide-by-zero guarded.
import { computed } from "vue";
import type {
  SurveyResultQuestion,
  OptionCount,
  RatingDistribution,
} from "@/api/announcements";
import { formatDateTime } from "@/utils/format";

interface Props {
  question: SurveyResultQuestion;
}

const props = defineProps<Props>();

const typeLabel = computed(() => {
  switch (props.question.question_type) {
    case "single":
      return "单选";
    case "multi":
      return "多选";
    case "rating":
      return "评分";
    case "text":
      return "文本";
    default:
      return props.question.question_type;
  }
});

// ---------- choice (single / multi) ----------
const optionCounts = computed<OptionCount[]>(
  () => props.question.option_counts ?? [],
);

// Sum across options. For multi the same respondent may pick several options,
// so this is "选择次数" not "答卷数" — bar width uses the max option count to
// keep the longest bar full width and avoid >100% on multi.
const optionTotal = computed(() =>
  optionCounts.value.reduce((s, o) => s + (o.count || 0), 0),
);
const optionMax = computed(() =>
  optionCounts.value.reduce((m, o) => Math.max(m, o.count || 0), 0),
);

function optionWidth(count: number): number {
  // Guard divide-by-zero: no responses → 0 width (the "暂无答卷" message shows instead).
  if (optionMax.value <= 0) return 0;
  return (count / optionMax.value) * 100;
}

function optionPercent(count: number): string {
  if (optionTotal.value <= 0) return "";
  return `${((count / optionTotal.value) * 100).toFixed(1)}%`;
}

const hasOptionData = computed(() => optionTotal.value > 0);

// ---------- rating ----------
const distribution = computed<RatingDistribution[]>(() => {
  const dist = props.question.distribution ?? [];
  // Sort by value ascending (1..max) for a readable top-to-bottom scale.
  return [...dist].sort((a, b) => a.value - b.value);
});
const ratingTotal = computed(() =>
  distribution.value.reduce((s, d) => s + (d.count || 0), 0),
);
const ratingMax = computed(() =>
  distribution.value.reduce((m, d) => Math.max(m, d.count || 0), 0),
);

function ratingWidth(count: number): number {
  if (ratingMax.value <= 0) return 0;
  return (count / ratingMax.value) * 100;
}

function ratingCountPercent(count: number): string {
  if (ratingTotal.value <= 0) return "";
  return `${((count / ratingTotal.value) * 100).toFixed(1)}%`;
}

const hasRatingData = computed(() => ratingTotal.value > 0);

const averageText = computed(() => {
  const avg = props.question.average;
  if (avg == null || !hasRatingData.value) return null;
  return avg.toFixed(1);
});

// ---------- text ----------
const textAnswers = computed(() => props.question.answers ?? []);
const hasTextData = computed(() => textAnswers.value.length > 0);
</script>

<template>
  <div class="survey-chart">
    <div class="survey-chart__head">
      <h3 class="survey-chart__title">{{ question.title }}</h3>
      <span class="survey-chart__type">{{ typeLabel }}</span>
    </div>

    <!-- single / multi: horizontal div bars -->
    <div
      v-if="
        question.question_type === 'single' ||
        question.question_type === 'multi'
      "
    >
      <p v-if="!hasOptionData" class="survey-chart__empty">暂无答卷</p>
      <ul v-else class="bar-list">
        <li v-for="(opt, i) in optionCounts" :key="i" class="bar-row">
          <div class="bar-row__label" :title="opt.option">{{ opt.option }}</div>
          <div class="bar-row__track">
            <div
              class="bar-row__fill"
              :style="{ width: optionWidth(opt.count) + '%' }"
            />
          </div>
          <div class="bar-row__value">
            {{ opt.count }}
            <span v-if="optionPercent(opt.count)" class="bar-row__pct">
              ({{ optionPercent(opt.count) }})
            </span>
          </div>
        </li>
      </ul>
    </div>

    <!-- rating: distribution bars + average -->
    <div v-else-if="question.question_type === 'rating'">
      <p v-if="!hasRatingData" class="survey-chart__empty">暂无答卷</p>
      <template v-else>
        <p v-if="averageText" class="survey-chart__average">
          平均 <strong>{{ averageText }}</strong>
        </p>
        <ul class="bar-list">
          <li v-for="d in distribution" :key="d.value" class="bar-row">
            <div class="bar-row__label bar-row__label--narrow">
              {{ d.value }}
            </div>
            <div class="bar-row__track">
              <div
                class="bar-row__fill bar-row__fill--rating"
                :style="{ width: ratingWidth(d.count) + '%' }"
              />
            </div>
            <div class="bar-row__value">
              {{ d.count }}
              <span v-if="ratingCountPercent(d.count)" class="bar-row__pct">
                ({{ ratingCountPercent(d.count) }})
              </span>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <!-- text: scrollable list of free-text answers -->
    <div v-else-if="question.question_type === 'text'">
      <p v-if="!hasTextData" class="survey-chart__empty">暂无答卷</p>
      <ul v-else class="text-list">
        <li v-for="(a, i) in textAnswers" :key="i" class="text-item">
          <div class="text-item__meta">
            <span class="text-item__name">{{ a.nickname || "匿名用户" }}</span>
            <span class="text-item__time">{{
              formatDateTime(a.submitted_at)
            }}</span>
          </div>
          <p class="text-item__body">{{ a.text }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.survey-chart {
  padding: var(--space-4) 0;
  border-bottom: 1px solid rgba(169, 180, 185, 0.15);
}

.survey-chart:last-child {
  border-bottom: none;
}

.survey-chart__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.survey-chart__title {
  font-family: var(--font-headline);
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0;
}

.survey-chart__type {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface-high);
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
  font-weight: 600;
}

.survey-chart__empty {
  color: var(--on-surface-variant);
  font-size: var(--text-sm);
  padding: var(--space-2) 0;
  margin: 0;
}

.survey-chart__average {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
  margin: 0 0 var(--space-3);
}

.survey-chart__average strong {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--tertiary);
}

/* ---------- bars ---------- */
.bar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bar-row {
  display: grid;
  grid-template-columns: 140px 1fr 110px;
  align-items: center;
  gap: var(--space-3);
}

.bar-row__label {
  font-size: var(--text-sm);
  color: var(--on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-row__label--narrow {
  font-family: var(--font-mono);
  font-weight: 700;
  text-align: center;
}

.bar-row__track {
  height: 16px;
  background: var(--surface-high);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-row__fill {
  height: 100%;
  background: var(--tertiary);
  border-radius: var(--radius-sm);
  transition: width var(--transition-base);
  min-width: 2px;
}

.bar-row__fill--rating {
  background: var(--success);
}

.bar-row__value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--on-surface);
  text-align: right;
}

.bar-row__pct {
  color: var(--on-surface-variant);
}

/* ---------- text answers ---------- */
.text-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 320px;
  overflow-y: auto;
}

.text-item {
  padding: var(--space-3);
  background: var(--surface-low);
  border-radius: var(--radius-sm);
}

.text-item__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.text-item__name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--on-surface);
}

.text-item__time {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
}

.text-item__body {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--on-surface);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 640px) {
  .bar-row {
    grid-template-columns: 90px 1fr 80px;
    gap: var(--space-2);
  }
}
</style>
