import { get, put, post } from './request'

export interface User {
  id: number
  username: string
  nickname: string
  phone: string
  tier_expires: string
  status: number
  is_admin: boolean
  total_sop_runs: number
  monthly_sop_runs: number
  parent_user_id: number | null
  created_at: string
  last_login: string
}

export interface UsersResponse {
  total: number
  users: User[]
}

export interface UserListParams {
  offset?: number
  limit?: number
  search?: string
  status?: number | string
}

export function getUsersApi(params: UserListParams) {
  return get<UsersResponse>('/v1/admin/users', { params })
}

export function getUserApi(id: number) {
  return get<User>(`/v1/admin/users/${id}`)
}

export function updateUserApi(id: number, data: Partial<Pick<User, 'nickname' | 'phone'>>) {
  return put<void>(`/v1/admin/users/${id}`, data)
}

export function updateUserStatusApi(id: number, status: number) {
  return put<void>(`/v1/admin/users/${id}/status`, { status })
}

export function resetPasswordApi(id: number) {
  return post<{ new_password: string }>(`/v1/admin/users/${id}/reset-password`)
}
