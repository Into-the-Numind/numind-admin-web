import { post } from './request'

export interface AdminUser {
  id: number
  username: string
  nickname: string
}

export interface LoginResponse {
  token: string
  user: AdminUser
}

export function loginApi(username: string, password: string) {
  return post<LoginResponse>('/v1/admin/login', { username, password })
}
