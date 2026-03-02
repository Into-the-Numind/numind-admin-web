import { get } from './request'

export interface DashboardStats {
  total_users: number
  tier_breakdown: Record<string, number>
  total_runs: number
  runs_today: number
  total_tokens: number
}

export interface RecentRun {
  id: number
  template_name: string
  user_nickname: string
  status: string
  created_at: string
  total_tokens: number
}

export interface RecentRunsResponse {
  runs: RecentRun[]
}

export function getStatsApi() {
  return get<DashboardStats>('/v1/admin/dashboard/stats')
}

export function getRecentRunsApi(limit = 20) {
  return get<RecentRunsResponse>('/v1/admin/dashboard/recent-runs', { params: { limit } })
}
