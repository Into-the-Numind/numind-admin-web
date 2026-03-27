import { get, post } from './request'

// ====== Types ======

export interface CreditAccount {
  id: number
  user_id: number
  balance: number
  status: string
  created_at: string
  updated_at: string
}

export interface CreditPackage {
  id: number
  user_id: number
  type: string
  total_credits: number
  remain_credits: number
  activated_at: string
  expires_at: string
  order_id: number | null
  status: string
  created_at: string
}

export interface CreditTransaction {
  id: number
  user_id: number
  package_id: number
  amount: number
  operation: string
  biz_ref_type: string
  biz_ref_id: string
  created_at: string
}

export interface CreditUserListItem {
  account: CreditAccount
  user_id: number
  username?: string
  nickname?: string
}

export interface CreditUserListResponse {
  total: number
  items: CreditUserListItem[]
}

export interface CreditUserDetail {
  account: CreditAccount
  packages: CreditPackage[]
  transactions: CreditTransaction[]
}

export interface RechargeCreditsRequest {
  type: string
  total_credits: number
  expires_in: string
}

// ====== API Functions ======

export function listCreditUsers(offset = 0, limit = 20) {
  return get<CreditUserListResponse>('/v1/admin/credits/users', { params: { offset, limit } })
}

export function getCreditUserDetail(userId: number) {
  return get<CreditUserDetail>(`/v1/admin/credits/users/${userId}`)
}

export function rechargeCredits(userId: number, data: RechargeCreditsRequest) {
  return post<void>(`/v1/admin/credits/users/${userId}/recharge`, data)
}
