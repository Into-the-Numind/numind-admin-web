<script setup lang="ts">
/**
 * MigrationsView — 一次性迁移工具（管理端）
 *
 * Phase 1 / Track F Task F.3：billing_mode 初始化迁移 UI。
 *
 * 3 态状态机（spec §4.4.3）：
 *   PENDING   ：query `.../status` 返回 already_executed=false。
 *               显示待迁移人数（分布：standard / premium / trial）+ 执行按钮。
 *   EXECUTING ：点击执行后，POST 请求在飞。按钮禁用 + spinner。
 *   EXECUTED  ：已执行（已有 legacy_tier 用户），按钮永久禁用；
 *               显示迁移记录（count / at / by）。
 *
 * 后端判定 already_executed 的方式：COUNT(user WHERE billing_mode='legacy_tier') > 0
 * 即幂等 —— 多次 POST 只会产生首次生效，后续返回已执行态。
 */
import { ref, computed, onMounted } from "vue";
import {
  getBillingModeInitStatus,
  executeBillingModeInit,
  type MigrationStatusResp,
} from "@/api/migrations";
import AppButton from "@/components/common/AppButton.vue";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";
import { PlayCircle, CheckCircle2, Loader2 } from "lucide-vue-next";

const toast = useToast();

type MigrationState = "LOADING" | "PENDING" | "EXECUTING" | "EXECUTED";

const state = ref<MigrationState>("LOADING");
const status = ref<MigrationStatusResp | null>(null);
const error = ref("");

const isButtonDisabled = computed(
  () => state.value === "EXECUTING" || state.value === "EXECUTED",
);

async function loadStatus() {
  state.value = "LOADING";
  error.value = "";
  try {
    const res =
      (await getBillingModeInitStatus()) as unknown as MigrationStatusResp;
    status.value = res;
    state.value = res.already_executed ? "EXECUTED" : "PENDING";
  } catch (e) {
    error.value = (e as Error).message || "加载迁移状态失败";
    state.value = "PENDING"; // fall back so user can at least see the page
  }
}

async function execute() {
  if (state.value === "EXECUTED" || state.value === "EXECUTING") return;
  state.value = "EXECUTING";
  try {
    const res =
      (await executeBillingModeInit()) as unknown as MigrationStatusResp;
    status.value = res;
    toast.success(
      `迁移完成：${res.migrated_count ?? status.value?.migrated_count ?? 0} 位用户已切换为 legacy_tier`,
    );
    // Fetch fresh status to reflect new EXECUTED state (executed_at/by).
    await loadStatus();
  } catch (e) {
    toast.error((e as Error).message || "执行迁移失败");
    // Reset to PENDING so user can retry (if backend actually didn't execute).
    state.value = "PENDING";
  }
}

onMounted(loadStatus);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">系统工具 / 迁移工具</p>
        <h1 class="page-title">一次性迁移</h1>
        <p class="page-subtitle">
          执行跨功能切换所需的一次性数据迁移。每个迁移都是幂等的——已执行后按钮永久禁用。
        </p>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- billing_mode init migration card -->
    <section class="migration-card" aria-labelledby="bm-init-heading">
      <header class="migration-card__header">
        <h2 id="bm-init-heading" class="migration-card__title">
          Billing Mode 初始化（legacy_tier Grandfathering）
        </h2>
        <p class="migration-card__description">
          把迁移窗口内所有在期 trial / standard / premium 会员标记为
          <code>billing_mode='legacy_tier'</code>，
          让他们保留旧次数制直至当前订阅自然到期。到期后自然进入新积分制
          <code>credits</code>。
        </p>
      </header>

      <!-- PENDING -->
      <div
        v-if="state === 'PENDING'"
        class="migration-card__body"
        data-test="state-pending"
      >
        <p class="migration-card__lead">
          待迁移用户：
          <strong>{{
            status?.pre_migration_stats?.total_candidates ?? 0
          }}</strong>
          人
        </p>
        <dl class="migration-stats">
          <div class="stat">
            <dt>Standard</dt>
            <dd>{{ status?.pre_migration_stats?.standard_in_period ?? 0 }}</dd>
          </div>
          <div class="stat">
            <dt>Premium</dt>
            <dd>{{ status?.pre_migration_stats?.premium_in_period ?? 0 }}</dd>
          </div>
          <div class="stat">
            <dt>Trial</dt>
            <dd>{{ status?.pre_migration_stats?.trial_in_period ?? 0 }}</dd>
          </div>
        </dl>
        <div class="migration-card__actions">
          <AppButton
            variant="primary"
            size="lg"
            :disabled="isButtonDisabled"
            data-test="execute-button"
            @click="execute"
          >
            <PlayCircle :size="18" />
            执行迁移
          </AppButton>
        </div>
      </div>

      <!-- EXECUTING -->
      <div
        v-else-if="state === 'EXECUTING'"
        class="migration-card__body"
        data-test="state-executing"
      >
        <p class="migration-card__lead">
          <Loader2 class="spin" :size="18" />
          正在迁移...请勿关闭页面或重复点击。
        </p>
        <div class="migration-card__actions">
          <AppButton
            variant="primary"
            size="lg"
            :loading="true"
            :disabled="true"
            data-test="execute-button"
          >
            <PlayCircle :size="18" />
            执行中
          </AppButton>
        </div>
      </div>

      <!-- EXECUTED -->
      <div
        v-else-if="state === 'EXECUTED'"
        class="migration-card__body migration-card__body--success"
        data-test="state-executed"
      >
        <p class="migration-card__lead">
          <CheckCircle2 :size="18" class="text-success" />
          迁移已完成
        </p>
        <dl class="migration-stats">
          <div class="stat">
            <dt>已迁移</dt>
            <dd>{{ status?.migrated_count ?? 0 }} 人</dd>
          </div>
          <div class="stat" v-if="status?.executed_at">
            <dt>执行时间</dt>
            <dd>{{ formatDate(status.executed_at) }}</dd>
          </div>
          <div class="stat" v-if="status?.executed_by">
            <dt>执行人</dt>
            <dd>{{ status.executed_by }}</dd>
          </div>
        </dl>
        <div class="migration-card__actions">
          <AppButton
            variant="secondary"
            size="lg"
            :disabled="true"
            data-test="execute-button"
          >
            <CheckCircle2 :size="18" />
            已执行（永久禁用）
          </AppButton>
        </div>
      </div>

      <!-- LOADING -->
      <div v-else class="migration-card__body" data-test="state-loading">
        <p class="empty-hint">加载中...</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.migration-card {
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(169, 180, 185, 0.05);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  margin-top: var(--space-4);
}

.migration-card__header {
  margin-bottom: var(--space-5);
}

.migration-card__title {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0 0 var(--space-2);
}

.migration-card__description {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
  line-height: 1.6;
  margin: 0;
}

.migration-card__description code {
  font-family: ui-monospace, "SF Mono", monospace;
  background: var(--surface-low);
  padding: 0 4px;
  border-radius: 3px;
  font-size: var(--text-xs);
}

.migration-card__body {
  padding: var(--space-4);
  background: var(--surface-low);
  border-radius: var(--radius-sm);
}

.migration-card__body--success {
  background: var(--success-soft, var(--surface-low));
}

.migration-card__lead {
  font-size: var(--text-base);
  color: var(--on-surface);
  margin: 0 0 var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.migration-card__lead strong {
  font-family: var(--font-headline);
  font-size: var(--text-xl);
  color: var(--primary);
}

.migration-stats {
  display: flex;
  gap: var(--space-4);
  margin: 0 0 var(--space-4);
  flex-wrap: wrap;
}

.stat {
  flex: 1;
  min-width: 120px;
  padding: var(--space-3);
  background: var(--surface-lowest);
  border-radius: var(--radius-sm);
}

.stat dt {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-1);
}

.stat dd {
  font-family: var(--font-headline);
  font-size: var(--text-lg);
  color: var(--on-surface);
  margin: 0;
}

.migration-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.empty-hint {
  color: var(--on-surface-variant);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-4);
}

.text-success {
  color: var(--success);
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
