import request from "./request";

// Admin-only: B2B 月度结算报表（credits-system Q3 / Phase Gap-fill）
//
// 契约来自 backend Q1：
//   GET /v1/admin/b2b-billing-report?month=YYYY-MM
// 返回某月所有 B 端父账户通过 POST /v1/users/children/:id/grant-membership
// 给子账户开通会员的汇总记录，用于月末对公转账对账。

export interface GrantDetail {
  child_username: string;
  product_type: "trial" | "monthly";
  months: number | null;
  cents: number;
  granted_at: string;
}

export interface ParentBillingRow {
  parent_user_id: number;
  parent_username: string;
  grants_count: number;
  amount_cents: number;
  details: GrantDetail[];
}

export interface B2BBillingReport {
  month: string;
  by_parent: ParentBillingRow[];
  total_amount_cents: number;
}

export function getB2BBillingReport(month: string) {
  return request.get<B2BBillingReport>("/v1/admin/b2b-billing-report", {
    params: { month },
  });
}
