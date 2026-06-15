<script setup lang="ts">
// AnnouncementStatsView — admin read/response stats + survey results
// (notification-center spec §6.2 / §3.2). Route /announcements/:id/stats.
// Hard rules: StatsCard KPIs, DataTable for tabular lists, 4 async states,
// no external chart lib (SurveyResultChart renders div bars).
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAnnouncementStore } from "@/stores/announcement";
import type {
  ReaderRow,
  ResponseRow,
  ResponseAnswer,
} from "@/api/announcements";
import StatsCard from "@/components/common/StatsCard.vue";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import SurveyResultChart from "@/components/announcement/SurveyResultChart.vue";
import { formatDateTime } from "@/utils/format";
import {
  ArrowLeft,
  Eye,
  Users,
  Percent,
  FileCheck,
  AlertTriangle,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const store = useAnnouncementStore();

const {
  current,
  stats,
  readers,
  readersTotal,
  surveyResults,
  responses,
  responsesTotal,
  statsLoading,
  readersLoading,
  surveyLoading,
  responsesLoading,
} = storeToRefs(store);

const id = computed(() => Number(route.params.id));

// Header / type derived from the fetched detail.
const isSurvey = computed(() => current.value?.type === "survey");
const title = computed(() => current.value?.title ?? "");

// ---------- top-level error (KPIs / detail) ----------
const headerError = ref<string | null>(null);

// ---------- KPI helpers (guard divide-by-zero) ----------
function pct(rate: number | null | undefined, hasTarget: boolean): string {
  // Server already returns ratios 0..1. Display-guard: no targets → "–".
  if (!hasTarget) return "–";
  if (rate == null) return "0%";
  return `${(rate * 100).toFixed(1)}%`;
}

const hasTarget = computed(() => (stats.value?.target_count ?? 0) > 0);
const readRateText = computed(() =>
  pct(stats.value?.read_rate, hasTarget.value),
);
const responseRateText = computed(() =>
  pct(stats.value?.response_rate, hasTarget.value),
);
const readCountText = computed(
  () => `${stats.value?.read_count ?? 0} / ${stats.value?.target_count ?? 0}`,
);
const responseCountText = computed(
  () =>
    `${stats.value?.response_count ?? 0} / ${stats.value?.target_count ?? 0}`,
);

// ---------- readers (read / unread tabs) ----------
const readerTab = ref<"read" | "unread">("read");
const readerPage = ref(1);
const pageSize = 20;
const readersError = ref<string | null>(null);

const readerColumns = computed<Column[]>(() => {
  const base: Column[] = [
    { key: "nickname", title: "昵称", align: "left" },
    { key: "phone", title: "手机号", align: "left", width: "160px" },
  ];
  if (readerTab.value === "read") {
    base.push({ key: "read_at", title: "已读时间", width: "200px" });
  }
  return base;
});

async function loadReaders() {
  readersError.value = null;
  try {
    await store.fetchReaders(id.value, {
      status: readerTab.value,
      page: readerPage.value,
      page_size: pageSize,
    });
  } catch (e) {
    readersError.value = (e as Error).message || "加载失败";
  }
}

function switchTab(tab: "read" | "unread") {
  if (tab === readerTab.value) return;
  readerTab.value = tab;
  readerPage.value = 1;
  loadReaders();
}

watch(readerPage, loadReaders);

// ---------- survey results ----------
const surveyError = ref<string | null>(null);

async function loadSurveyResults() {
  surveyError.value = null;
  try {
    await store.fetchSurveyResults(id.value);
  } catch (e) {
    surveyError.value = (e as Error).message || "加载失败";
  }
}

const surveyQuestions = computed(() => surveyResults.value?.questions ?? []);

// ---------- per-user responses (drill-down) ----------
const responsePage = ref(1);
const responsesError = ref<string | null>(null);

const responseColumns: Column[] = [
  { key: "nickname", title: "用户", align: "left", width: "160px" },
  { key: "submitted_at", title: "提交时间", align: "left", width: "200px" },
  { key: "answers", title: "答卷摘要", align: "left" },
];

// question_id → title map for rendering compact answer summaries.
const questionTitleMap = computed<Record<number, string>>(() => {
  const map: Record<number, string> = {};
  for (const q of surveyQuestions.value) {
    map[q.question_id] = q.title;
  }
  return map;
});

function answerSummary(ans: ResponseAnswer): string {
  if (ans.options && ans.options.length > 0) return ans.options.join("、");
  if (ans.rating != null) return `评分 ${ans.rating}`;
  if (ans.text) return ans.text;
  return "（未作答）";
}

function answerLines(
  row: ResponseRow,
): { qid: number; label: string; value: string }[] {
  return row.answers.map((a) => ({
    qid: a.question_id,
    label: questionTitleMap.value[a.question_id] ?? `题目 #${a.question_id}`,
    value: answerSummary(a),
  }));
}

async function loadResponses() {
  responsesError.value = null;
  try {
    await store.fetchResponses(id.value, {
      page: responsePage.value,
      page_size: pageSize,
    });
  } catch (e) {
    responsesError.value = (e as Error).message || "加载失败";
  }
}

watch(responsePage, loadResponses);

// ---------- init ----------
async function loadAll() {
  headerError.value = null;
  // Detail first (need type to decide whether to load survey sections).
  try {
    await store.get(id.value);
  } catch (e) {
    headerError.value = (e as Error).message || "加载失败";
    return;
  }
  try {
    await store.fetchStats(id.value);
  } catch (e) {
    headerError.value = (e as Error).message || "加载失败";
  }
  await loadReaders();
  if (isSurvey.value) {
    await loadSurveyResults();
    await loadResponses();
  }
}

function retryHeader() {
  loadAll();
}

function goBack() {
  router.push("/announcements");
}

onMounted(loadAll);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">Notification / Announcements / Stats</p>
        <h1 class="page-title">{{ title || "公告统计" }}</h1>
      </div>
      <AppButton variant="ghost" @click="goBack">
        <ArrowLeft :size="16" /> 返回列表
      </AppButton>
    </div>

    <!-- Header / KPI error -->
    <div v-if="headerError" class="error-banner">
      <span>{{ headerError }}</span>
      <AppButton variant="ghost" size="sm" @click="retryHeader">重试</AppButton>
    </div>

    <!-- KPI section -->
    <div v-if="statsLoading" class="kpi-grid">
      <div v-for="i in isSurvey ? 4 : 2" :key="i" class="kpi-skeleton" />
    </div>
    <div v-else-if="stats" class="kpi-grid">
      <StatsCard
        label="已读率"
        :value="readRateText"
        :icon="Percent"
        color="primary"
      />
      <StatsCard
        label="已读数 / 目标数"
        :value="readCountText"
        :icon="Eye"
        color="info"
      />
      <template v-if="isSurvey">
        <StatsCard
          label="回收率"
          :value="responseRateText"
          :icon="FileCheck"
          color="success"
        />
        <StatsCard
          label="答卷数 / 目标数"
          :value="responseCountText"
          :icon="Users"
          color="success"
        />
      </template>
    </div>

    <!-- Readers section -->
    <div class="section-container">
      <div class="section-head">
        <h2 class="section-title">阅读情况</h2>
        <div class="tab-group" role="tablist">
          <button
            class="tab"
            :class="{ 'tab--active': readerTab === 'read' }"
            role="tab"
            :aria-selected="readerTab === 'read'"
            @click="switchTab('read')"
          >
            已读
          </button>
          <button
            class="tab"
            :class="{ 'tab--active': readerTab === 'unread' }"
            role="tab"
            :aria-selected="readerTab === 'unread'"
            @click="switchTab('unread')"
          >
            未读
          </button>
        </div>
      </div>

      <div v-if="readersError" class="error-banner">
        <span>{{ readersError }}</span>
        <AppButton variant="ghost" size="sm" @click="loadReaders"
          >重试</AppButton
        >
      </div>

      <DataTable
        :columns="readerColumns"
        :data="readers"
        :loading="readersLoading"
        :total="readersTotal"
        :page="readerPage"
        :page-size="pageSize"
        row-key="user_id"
        :empty-text="readerTab === 'read' ? '暂无已读用户' : '全部用户已读'"
        @update:page="readerPage = $event"
      >
        <template #cell-nickname="{ row }">
          <span class="cell-strong">{{
            (row as ReaderRow).nickname || "匿名用户"
          }}</span>
        </template>
        <template #cell-phone="{ row }">
          <span class="text-mono">{{ (row as ReaderRow).phone || "—" }}</span>
        </template>
        <template #cell-read_at="{ row }">
          <span class="text-muted">{{
            (row as ReaderRow).read_at
              ? formatDateTime((row as ReaderRow).read_at as string)
              : "—"
          }}</span>
        </template>
      </DataTable>
    </div>

    <!-- Survey results section (survey only) -->
    <template v-if="isSurvey">
      <div class="section-container">
        <h2 class="section-title">问卷结果</h2>

        <div v-if="surveyError" class="error-banner">
          <span>{{ surveyError }}</span>
          <AppButton variant="ghost" size="sm" @click="loadSurveyResults"
            >重试</AppButton
          >
        </div>

        <div v-if="surveyLoading" class="survey-loading">
          <div v-for="i in 3" :key="i" class="kpi-skeleton" />
        </div>
        <div v-else-if="surveyQuestions.length === 0" class="empty-block">
          <AlertTriangle :size="32" />
          <p>暂无问卷结果</p>
        </div>
        <div v-else class="survey-results">
          <SurveyResultChart
            v-for="q in surveyQuestions"
            :key="q.question_id"
            :question="q"
          />
        </div>
      </div>

      <!-- Per-user responses drilldown -->
      <div class="section-container">
        <h2 class="section-title">答卷明细（按用户）</h2>

        <div v-if="responsesError" class="error-banner">
          <span>{{ responsesError }}</span>
          <AppButton variant="ghost" size="sm" @click="loadResponses"
            >重试</AppButton
          >
        </div>

        <DataTable
          :columns="responseColumns"
          :data="responses"
          :loading="responsesLoading"
          :total="responsesTotal"
          :page="responsePage"
          :page-size="pageSize"
          row-key="user_id"
          empty-text="暂无答卷"
          @update:page="responsePage = $event"
        >
          <template #cell-nickname="{ row }">
            <span class="cell-strong">{{
              (row as ResponseRow).nickname || "匿名用户"
            }}</span>
          </template>
          <template #cell-submitted_at="{ row }">
            <span class="text-muted">{{
              formatDateTime((row as ResponseRow).submitted_at)
            }}</span>
          </template>
          <template #cell-answers="{ row }">
            <ul class="answer-summary">
              <li
                v-for="line in answerLines(row as ResponseRow)"
                :key="line.qid"
                class="answer-summary__item"
              >
                <span class="answer-summary__q">{{ line.label }}：</span>
                <span class="answer-summary__a">{{ line.value }}</span>
              </li>
            </ul>
          </template>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.page-breadcrumb {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-1);
}

.page-title {
  font-family: var(--font-headline);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
}

@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

.kpi-skeleton {
  height: 72px;
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

.section-container {
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.section-title {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text);
  margin: 0 0 var(--space-4);
}

.section-head .section-title {
  margin: 0;
}

.tab-group {
  display: inline-flex;
  gap: var(--space-1);
  padding: 2px;
  background: var(--surface-low);
  border-radius: var(--radius-sm);
}

.tab {
  padding: var(--space-1) var(--space-4);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-label);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab--active {
  background: var(--surface-lowest);
  color: var(--on-surface);
  box-shadow: var(--shadow-sm);
}

.survey-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.survey-results {
  display: flex;
  flex-direction: column;
}

.empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-10) var(--space-6);
  color: var(--on-surface-variant);
}

.empty-block p {
  margin: 0;
  font-size: var(--text-sm);
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: var(--text-sm);
}

.cell-strong {
  color: var(--on-surface);
  font-weight: 500;
}

.text-muted {
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.answer-summary {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.answer-summary__item {
  font-size: var(--text-xs);
  line-height: 1.5;
}

.answer-summary__q {
  color: var(--on-surface-variant);
}

.answer-summary__a {
  color: var(--on-surface);
}
</style>
