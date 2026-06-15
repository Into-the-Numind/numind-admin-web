// API wrappers for /v1/admin/announcements (11 endpoints, admin_token middleware).
// Backend contract: notification-center spec §3.2 (field names locked).
// All endpoints sit behind the notification_center feature-flag guard.

import { get, post, put, del } from "./request";

// --- Question types ---

export type QuestionType = "single" | "multi" | "rating" | "text";
export type RatingStyle = "star" | "nps";

// Question as returned by the backend (detail responses).
export interface QuestionDTO {
  id?: number;
  order_index: number;
  question_type: QuestionType;
  title: string;
  required: boolean;
  options?: string[] | null;
  rating_max?: number | null;
  rating_style?: RatingStyle | null;
}

// Question payload when creating/updating an announcement.
export interface QuestionInput {
  order_index: number;
  question_type: QuestionType;
  title: string;
  required?: boolean;
  options?: string[] | null;
  rating_max?: number | null;
  rating_style?: string | null;
}

// --- Announcement DTOs ---

export interface AdminAnnouncementBrief {
  id: number;
  type: string;
  title: string;
  status: string;
  is_important: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  read_count: number;
  target_count: number;
  response_count: number;
}

export interface AdminAnnouncementDetail extends AdminAnnouncementBrief {
  content: string;
  questions: QuestionDTO[];
}

// --- Create / Update payloads ---

export interface CreateAnnouncementPayload {
  type: string;
  title: string;
  content: string;
  is_important?: boolean;
  expires_at?: string | null;
  status?: string;
  questions?: QuestionInput[];
}

export interface UpdateAnnouncementPayload {
  title?: string;
  content?: string;
  is_important?: boolean;
  expires_at?: string | null;
  questions?: QuestionInput[];
}

// --- Stats ---

export interface StatsDTO {
  target_count: number;
  read_count: number;
  read_rate: number;
  response_count: number;
  response_rate: number;
}

// --- Readers ---

export interface ReaderRow {
  user_id: number;
  nickname: string;
  phone: string;
  read_at: string | null;
}

export interface ReadersResponse {
  list: ReaderRow[];
  total: number;
}

export interface ReadersParams {
  status?: "read" | "unread";
  page?: number;
  page_size?: number;
}

// --- Survey results (aggregated) ---

export interface OptionCount {
  option: string;
  count: number;
}

export interface RatingDistribution {
  value: number;
  count: number;
}

export interface SurveyTextAnswer {
  user_id: number;
  nickname: string;
  text: string;
  submitted_at: string;
}

export interface SurveyResultQuestion {
  question_id: number;
  title: string;
  question_type: QuestionType;
  option_counts?: OptionCount[];
  distribution?: RatingDistribution[];
  average?: number;
  answers?: SurveyTextAnswer[];
}

export interface SurveyResultsResponse {
  response_count: number;
  questions: SurveyResultQuestion[];
}

// --- Per-user responses (drill-down) ---

export interface ResponseAnswer {
  question_id: number;
  options: string[] | null;
  rating: number | null;
  text: string | null;
}

export interface ResponseRow {
  user_id: number;
  nickname: string;
  submitted_at: string;
  answers: ResponseAnswer[];
}

export interface ResponsesResponse {
  list: ResponseRow[];
  total: number;
}

export interface ResponsesParams {
  page?: number;
  page_size?: number;
}

// --- List ---

export interface ListAnnouncementsParams {
  page?: number;
  page_size?: number;
  status?: string;
  type?: string;
}

export interface ListAnnouncementsResponse {
  list: AdminAnnouncementBrief[];
  total: number;
}

const BASE = "/v1/admin/announcements";

// 1. GET    /v1/admin/announcements                 — List with filters
export function listAnnouncementsApi(
  params: ListAnnouncementsParams = {},
): Promise<ListAnnouncementsResponse> {
  return get<ListAnnouncementsResponse>(BASE, { params });
}

// 2. POST   /v1/admin/announcements                 — Create
export function createAnnouncementApi(
  payload: CreateAnnouncementPayload,
): Promise<AdminAnnouncementDetail> {
  return post<AdminAnnouncementDetail>(BASE, payload);
}

// 3. GET    /v1/admin/announcements/:id             — Get one (with questions)
export function getAnnouncementApi(
  id: number,
): Promise<AdminAnnouncementDetail> {
  return get<AdminAnnouncementDetail>(`${BASE}/${id}`);
}

// 4. PUT    /v1/admin/announcements/:id             — Update
export function updateAnnouncementApi(
  id: number,
  payload: UpdateAnnouncementPayload,
): Promise<AdminAnnouncementDetail> {
  return put<AdminAnnouncementDetail>(`${BASE}/${id}`, payload);
}

// 5. POST   /v1/admin/announcements/:id/publish     — Publish (draft→published)
export function publishAnnouncementApi(
  id: number,
): Promise<AdminAnnouncementDetail> {
  return post<AdminAnnouncementDetail>(`${BASE}/${id}/publish`);
}

// 6. POST   /v1/admin/announcements/:id/archive     — Archive
export function archiveAnnouncementApi(
  id: number,
): Promise<AdminAnnouncementDetail> {
  return post<AdminAnnouncementDetail>(`${BASE}/${id}/archive`);
}

// 7. DELETE /v1/admin/announcements/:id             — Soft delete
export function deleteAnnouncementApi(
  id: number,
): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`${BASE}/${id}`);
}

// 8. GET    /v1/admin/announcements/:id/stats       — Read/response rates
export function getStatsApi(id: number): Promise<StatsDTO> {
  return get<StatsDTO>(`${BASE}/${id}/stats`);
}

// 9. GET    /v1/admin/announcements/:id/readers     — Reader list (read/unread)
export function getReadersApi(
  id: number,
  params: ReadersParams = {},
): Promise<ReadersResponse> {
  return get<ReadersResponse>(`${BASE}/${id}/readers`, { params });
}

// 10. GET   /v1/admin/announcements/:id/survey-results — Aggregated survey results
export function getSurveyResultsApi(
  id: number,
): Promise<SurveyResultsResponse> {
  return get<SurveyResultsResponse>(`${BASE}/${id}/survey-results`);
}

// 11. GET   /v1/admin/announcements/:id/responses   — Per-user response drill-down
export function getResponsesApi(
  id: number,
  params: ResponsesParams = {},
): Promise<ResponsesResponse> {
  return get<ResponsesResponse>(`${BASE}/${id}/responses`, { params });
}
