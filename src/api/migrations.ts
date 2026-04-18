import request from "./request";

// Admin-only: One-time migrations (e.g. billing_mode init)
// See spec: numind-server/docs/superpowers/specs/2026-04-18-credits-system-design.md §4.4.3

export interface MigrationStatsPerTier {
  standard_in_period: number;
  premium_in_period: number;
  trial_in_period: number;
  total_candidates: number;
}

export interface MigrationStatusResp {
  already_executed: boolean;
  executed_at?: string;
  executed_by?: string;
  pre_migration_stats?: MigrationStatsPerTier;
  migrated_count: number;
}

export function getBillingModeInitStatus() {
  return request.get<MigrationStatusResp>(
    "/v1/admin/migrations/billing-mode-init/status",
  );
}

export function executeBillingModeInit() {
  return request.post<MigrationStatusResp>(
    "/v1/admin/migrations/billing-mode-init",
    {},
  );
}
