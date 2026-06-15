// Pinia store for admin announcement / survey management.
// Setup syntax per numind-admin-web CLAUDE.md §2, mirroring complianceRule.ts.
// Backend contract: notification-center spec §3.2.

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  listAnnouncementsApi,
  createAnnouncementApi,
  getAnnouncementApi,
  updateAnnouncementApi,
  publishAnnouncementApi,
  archiveAnnouncementApi,
  deleteAnnouncementApi,
  getStatsApi,
  getReadersApi,
  getSurveyResultsApi,
  getResponsesApi,
} from "@/api/announcements";
import type {
  AdminAnnouncementBrief,
  AdminAnnouncementDetail,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
  ListAnnouncementsParams,
  StatsDTO,
  ReaderRow,
  ReadersParams,
  SurveyResultsResponse,
  ResponseRow,
  ResponsesParams,
} from "@/api/announcements";

export const useAnnouncementStore = defineStore("announcement", () => {
  // --- List state ---
  const list = ref<AdminAnnouncementBrief[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- Current (detail/edit) state ---
  const current = ref<AdminAnnouncementDetail | null>(null);
  const currentLoading = ref(false);
  const currentError = ref<string | null>(null);

  // --- Shared saving flag (create/update/publish/archive/delete) ---
  const saving = ref(false);

  // --- Stats / readers / survey results / responses ---
  const stats = ref<StatsDTO | null>(null);
  const readers = ref<ReaderRow[]>([]);
  const readersTotal = ref(0);
  const surveyResults = ref<SurveyResultsResponse | null>(null);
  const responses = ref<ResponseRow[]>([]);
  const responsesTotal = ref(0);

  // --- Dedicated loading flags (avoid flicker collisions with fetchList) ---
  const statsLoading = ref(false);
  const readersLoading = ref(false);
  const surveyLoading = ref(false);
  const responsesLoading = ref(false);

  // --- Getters ---
  const isEmpty = computed(() => !loading.value && list.value.length === 0);

  // --- Actions ---

  async function fetchList(params: ListAnnouncementsParams = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await listAnnouncementsApi({
        page: 1,
        page_size: 20,
        ...params,
      });
      list.value = res.list ?? [];
      total.value = res.total ?? 0;
    } catch (e) {
      error.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function get(id: number): Promise<AdminAnnouncementDetail> {
    currentLoading.value = true;
    currentError.value = null;
    try {
      const detail = await getAnnouncementApi(id);
      current.value = detail;
      return detail;
    } catch (e) {
      currentError.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      currentLoading.value = false;
    }
  }

  async function create(
    payload: CreateAnnouncementPayload,
  ): Promise<AdminAnnouncementDetail> {
    saving.value = true;
    try {
      const detail = await createAnnouncementApi(payload);
      current.value = detail;
      return detail;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function update(
    id: number,
    payload: UpdateAnnouncementPayload,
  ): Promise<AdminAnnouncementDetail> {
    saving.value = true;
    try {
      const detail = await updateAnnouncementApi(id, payload);
      current.value = detail;
      syncListRow(detail);
      return detail;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function publish(id: number): Promise<AdminAnnouncementDetail> {
    saving.value = true;
    try {
      const detail = await publishAnnouncementApi(id);
      current.value = detail;
      syncListRow(detail);
      return detail;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function archive(id: number): Promise<AdminAnnouncementDetail> {
    saving.value = true;
    try {
      const detail = await archiveAnnouncementApi(id);
      current.value = detail;
      syncListRow(detail);
      return detail;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function remove(id: number): Promise<void> {
    saving.value = true;
    try {
      await deleteAnnouncementApi(id);
      // Optimistic local mutation
      list.value = list.value.filter((a) => a.id !== id);
      total.value = Math.max(0, total.value - 1);
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      saving.value = false;
    }
  }

  async function fetchStats(id: number): Promise<StatsDTO> {
    statsLoading.value = true;
    error.value = null;
    try {
      const res = await getStatsApi(id);
      stats.value = res;
      return res;
    } catch (e) {
      error.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      statsLoading.value = false;
    }
  }

  async function fetchReaders(id: number, params: ReadersParams = {}) {
    readersLoading.value = true;
    error.value = null;
    try {
      const res = await getReadersApi(id, {
        page: 1,
        page_size: 20,
        ...params,
      });
      readers.value = res.list ?? [];
      readersTotal.value = res.total ?? 0;
    } catch (e) {
      error.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      readersLoading.value = false;
    }
  }

  async function fetchSurveyResults(
    id: number,
  ): Promise<SurveyResultsResponse> {
    surveyLoading.value = true;
    error.value = null;
    try {
      const res = await getSurveyResultsApi(id);
      surveyResults.value = res;
      return res;
    } catch (e) {
      error.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      surveyLoading.value = false;
    }
  }

  async function fetchResponses(id: number, params: ResponsesParams = {}) {
    responsesLoading.value = true;
    error.value = null;
    try {
      const res = await getResponsesApi(id, {
        page: 1,
        page_size: 20,
        ...params,
      });
      responses.value = res.list ?? [];
      responsesTotal.value = res.total ?? 0;
    } catch (e) {
      error.value = (e as Error).message || "加载失败";
      throw e;
    } finally {
      responsesLoading.value = false;
    }
  }

  // Keep the in-list brief row consistent with the latest detail (status etc.).
  function syncListRow(detail: AdminAnnouncementDetail) {
    const idx = list.value.findIndex((a) => a.id === detail.id);
    if (idx !== -1) {
      const brief: AdminAnnouncementBrief = {
        id: detail.id,
        type: detail.type,
        title: detail.title,
        status: detail.status,
        is_important: detail.is_important,
        published_at: detail.published_at,
        expires_at: detail.expires_at,
        created_at: detail.created_at,
        read_count: detail.read_count,
        target_count: detail.target_count,
        response_count: detail.response_count,
      };
      list.value[idx] = brief;
    }
  }

  // Pinia setup-syntax stores need explicit reset (no auto $reset)
  function $reset() {
    list.value = [];
    total.value = 0;
    loading.value = false;
    error.value = null;
    current.value = null;
    currentLoading.value = false;
    currentError.value = null;
    saving.value = false;
    stats.value = null;
    readers.value = [];
    readersTotal.value = 0;
    surveyResults.value = null;
    responses.value = [];
    responsesTotal.value = 0;
    statsLoading.value = false;
    readersLoading.value = false;
    surveyLoading.value = false;
    responsesLoading.value = false;
  }

  return {
    // state
    list,
    total,
    loading,
    error,
    current,
    currentLoading,
    currentError,
    saving,
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
    // getters
    isEmpty,
    // actions
    fetchList,
    create,
    get,
    update,
    publish,
    archive,
    remove,
    fetchStats,
    fetchReaders,
    fetchSurveyResults,
    fetchResponses,
    $reset,
  };
});
