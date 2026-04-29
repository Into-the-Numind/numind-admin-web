import request from "./request";

// Admin-only: B2B 月度结算报表（credits-system Q3 / Phase Gap-fill）
//
// 契约来自 backend Task 13 (实际实现 schema)：
//   GET /v1/admin/b2b-billing-report?month=YYYY-MM[&granter_user_id=N]
// 返回某月所有 B 端父账户通过 POST /v1/users/children/:id/grant-membership
// 给子账户开通会员的汇总记录，用于月末对公转账对账。

export interface ParentBillingDetail {
  event_id?: number; // legacy 路径可能 null
  user_id: number; // 受益子账户
  child_username?: string;
  event_type:
    | "trial_granted"
    | "sub_granted"
    | "sub_renewed"
    | "booster_granted";
  product_type: "trial" | "monthly" | "booster";
  months?: number;
  quantity?: number;
  amount_cents: number;
  occurred_at: string;
  source: string;
  idempotency_key?: string;
}

export interface ParentBillingRow {
  parent_user_id: number;
  parent_username: string;
  events_count: number;
  amount_cents: number;
  details: ParentBillingDetail[];
}

export interface B2BBillingReport {
  month: string; // 'YYYY-MM'
  cutover_date: string;
  source: "legacy_only" | "cutover_split" | "new_only";
  by_parent: ParentBillingRow[];
  total_amount_cents: number;
  total_events_count: number;
  active_parents_count: number;
}

export function getB2BBillingReport(month: string, granterId?: number) {
  return request.get<B2BBillingReport>("/v1/admin/b2b-billing-report", {
    params: { month, granter_user_id: granterId },
  });
}
