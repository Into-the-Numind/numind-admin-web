import { get } from "./request";

// ====== Types ======

export interface CreditAccount {
  id: number;
  user_id: number;
  balance: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreditPackage {
  id: number;
  user_id: number;
  type: string;
  total_credits: number;
  remain_credits: number;
  activated_at: string;
  expires_at: string;
  order_id: number | null;
  status: string;
  created_at: string;
}

export interface CreditTransaction {
  id: number;
  user_id: number;
  package_id: number;
  amount: number;
  operation: string;
  biz_ref_type: string;
  biz_ref_id: string;
  created_at: string;
}

export interface CreditUserListItem {
  account: CreditAccount;
  user_id: number;
  username?: string;
  nickname?: string;
}

export interface CreditUserListResponse {
  total: number;
  items: CreditUserListItem[];
}

export interface CreditReservation {
  id: number;
  user_id: number;
  status: string; // 'reserved' | 'consumed' | 'refunded' | ...
  amount: number;
  created_at: string;
  ref_type?: string;
  ref_id?: string;
  expires_at?: string;
}

export interface CreditUserDetail {
  account: CreditAccount;
  // T9: backend GetUserDetail no longer returns packages; field is undefined.
  // Will be removed after credit_package archival in T11.
  packages?: CreditPackage[];
  transactions: CreditTransaction[];
  // F.4 enrichments (spec §4.4.4). Optional for back-compat with older server
  // builds that have not yet surfaced these fields.
  billing_mode?: "credits";
  reservations?: CreditReservation[];
}

// ====== API Functions ======

export function listCreditUsers(offset = 0, limit = 20) {
  return get<CreditUserListResponse>("/v1/admin/credits/users", {
    params: { offset, limit },
  });
}

export function getCreditUserDetail(userId: number) {
  return get<CreditUserDetail>(`/v1/admin/credits/users/${userId}`);
}
