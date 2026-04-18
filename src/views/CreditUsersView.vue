<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  listCreditUsers,
  getCreditUserDetail,
  rechargeCredits,
  type CreditUserListItem,
  type CreditUserDetail,
} from "@/api/credits";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import { Coins, RefreshCw } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";

const toast = useToast();

// List state
const items = ref<CreditUserListItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");

// Detail modal
const detailVisible = ref(false);
const detailLoading = ref(false);
const detail = ref<CreditUserDetail | null>(null);
const selectedUserId = ref(0);
// F.4: tab inside detail modal
type DetailTab = "overview" | "reservations";
const activeTab = ref<DetailTab>("overview");

// Recharge modal
const rechargeVisible = ref(false);
const rechargeUserId = ref(0);
const rechargeType = ref("subscription");
const rechargeCreditsAmount = ref("100");
const rechargeExpiresIn = ref("30d");
const rechargeProcessing = ref(false);

const accountStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: "正常", color: "success" },
  frozen: { label: "冻结", color: "danger" },
};

const packageStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: "使用中", color: "success" },
  exhausted: { label: "已耗尽", color: "gray" },
  expired: { label: "已过期", color: "danger" },
};

// F.4: reservation lifecycle (Reserve → Finalize consumed / Refund refunded)
const reservationStatusMap: Record<string, { label: string; color: string }> = {
  reserved: { label: "已预留", color: "info" },
  consumed: { label: "已扣减", color: "gray" },
  refunded: { label: "已退款", color: "gray" },
};

const columns: Column[] = [
  { key: "user_id", title: "用户ID", width: "80px" },
  { key: "username", title: "用户名", width: "140px" },
  { key: "balance", title: "额度余额", width: "100px", align: "right" },
  { key: "status", title: "账户状态", width: "90px" },
  { key: "created_at", title: "创建时间", width: "140px" },
  { key: "actions", title: "操作", width: "160px" },
];

const typeOptions = [
  { label: "subscription（订阅）", value: "subscription" },
  { label: "booster（加量包）", value: "booster" },
  { label: "trial（试用）", value: "trial" },
];

const expiresInOptions = [
  { label: "30天", value: "30d" },
  { label: "90天", value: "90d" },
  { label: "180天", value: "180d" },
  { label: "1年", value: "365d" },
];

async function fetchList() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listCreditUsers((page.value - 1) * pageSize, pageSize);
    items.value = res.items;
    total.value = res.total;
  } catch (e) {
    error.value = (e as Error).message || "加载失败";
  } finally {
    loading.value = false;
  }
}

async function openDetail(userId: number) {
  selectedUserId.value = userId;
  detailVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  activeTab.value = "overview";
  try {
    detail.value = await getCreditUserDetail(userId);
  } catch (e) {
    toast.error((e as Error).message || "加载详情失败");
    detailVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

function openRecharge(userId: number) {
  rechargeUserId.value = userId;
  rechargeType.value = "subscription";
  rechargeCreditsAmount.value = "100";
  rechargeExpiresIn.value = "30d";
  rechargeVisible.value = true;
}

async function submitRecharge() {
  if (rechargeProcessing.value) return;
  rechargeProcessing.value = true;
  try {
    await rechargeCredits(rechargeUserId.value, {
      type: rechargeType.value,
      total_credits: Number(rechargeCreditsAmount.value),
      expires_in: rechargeExpiresIn.value,
    });
    rechargeVisible.value = false;
    toast.success("充值成功");
    await fetchList();
  } catch (e) {
    toast.error((e as Error).message || "充值失败");
  } finally {
    rechargeProcessing.value = false;
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">Users / Credits</p>
        <h1 class="page-title">额度管理</h1>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="items"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      clickable
      @update:page="
        page = $event;
        fetchList();
      "
      @row-click="(row) => openDetail((row as CreditUserListItem).user_id)"
    >
      <template #cell-user_id="{ row }">
        <span class="text-muted">{{
          (row as CreditUserListItem).user_id
        }}</span>
      </template>

      <template #cell-username="{ row }">
        {{
          (row as CreditUserListItem).nickname ||
          (row as CreditUserListItem).username ||
          "-"
        }}
      </template>

      <template #cell-balance="{ row }">
        <strong>{{
          (row as CreditUserListItem).account?.balance ?? "-"
        }}</strong>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :status="String((row as CreditUserListItem).account?.status)"
          :map="accountStatusMap"
        />
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-muted">{{
          formatDate(String((row as CreditUserListItem).account?.created_at))
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :data-test="`row-view-${(row as CreditUserListItem).user_id}`"
            @click.stop="openDetail((row as CreditUserListItem).user_id)"
          >
            查看
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            @click.stop="openRecharge((row as CreditUserListItem).user_id)"
          >
            <Coins :size="14" />
            充值
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Detail Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="detailVisible"
          class="modal-overlay"
          @click.self="detailVisible = false"
          @keydown.esc="detailVisible = false"
        >
          <div
            class="modal-card modal-card--wide"
            role="dialog"
            aria-modal="true"
          >
            <div class="modal-header">
              <h3 class="modal-title">
                额度详情（用户 #{{ selectedUserId }}）
              </h3>
              <AppButton
                size="sm"
                variant="ghost"
                @click="detailVisible = false"
                >关闭</AppButton
              >
            </div>

            <div v-if="detailLoading" class="modal-loading">加载中...</div>

            <template v-else-if="detail">
              <!-- F.4: Legacy-tier banner (spec §4.4.4) -->
              <div
                v-if="detail.billing_mode === 'legacy_tier'"
                class="banner legacy-tier"
                data-test="legacy-tier-banner"
              >
                此用户为 <code>billing_mode=legacy_tier</code>（Grandfathering
                老会员）。 credit_package 自然过期不扣减，到期升级后进入积分制。
              </div>

              <!-- Account summary -->
              <div class="detail-summary">
                <span
                  >余额：<strong>{{ detail.account.balance }}</strong></span
                >
                <StatusBadge
                  :status="detail.account.status"
                  :map="accountStatusMap"
                />
              </div>

              <!-- F.4: Tabs -->
              <div class="tab-bar" role="tablist">
                <button
                  type="button"
                  class="tab-btn"
                  :class="{ 'tab-btn--active': activeTab === 'overview' }"
                  role="tab"
                  :aria-selected="activeTab === 'overview'"
                  data-test="tab-overview"
                  @click="activeTab = 'overview'"
                >
                  概览
                </button>
                <button
                  type="button"
                  class="tab-btn"
                  :class="{
                    'tab-btn--active': activeTab === 'reservations',
                  }"
                  role="tab"
                  :aria-selected="activeTab === 'reservations'"
                  data-test="tab-reservations"
                  @click="activeTab = 'reservations'"
                >
                  活跃 Reservation
                  <span
                    v-if="detail.reservations && detail.reservations.length"
                    class="tab-badge"
                  >
                    {{
                      detail.reservations.filter((r) => r.status === "reserved")
                        .length
                    }}
                  </span>
                </button>
              </div>

              <!-- Overview tab -->
              <section v-if="activeTab === 'overview'" role="tabpanel">
                <!-- Packages -->
                <h4 class="section-title">额度包</h4>
                <table class="inner-table" v-if="detail.packages?.length">
                  <thead>
                    <tr>
                      <th>类型</th>
                      <th>总额度</th>
                      <th>剩余</th>
                      <th>生效时间</th>
                      <th>到期时间</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="pkg in detail.packages" :key="pkg.id">
                      <td>{{ pkg.type }}</td>
                      <td>{{ pkg.total_credits }}</td>
                      <td>{{ pkg.remain_credits }}</td>
                      <td class="text-muted">
                        {{ formatDate(pkg.activated_at) }}
                      </td>
                      <td class="text-muted">
                        {{ formatDate(pkg.expires_at) }}
                      </td>
                      <td>
                        <StatusBadge
                          :status="pkg.status"
                          :map="packageStatusMap"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="empty-hint">暂无额度包</p>

                <!-- Transactions -->
                <h4 class="section-title">额度流水</h4>
                <table class="inner-table" v-if="detail.transactions?.length">
                  <thead>
                    <tr>
                      <th>金额</th>
                      <th>操作</th>
                      <th>业务类型</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="tx in detail.transactions" :key="tx.id">
                      <td
                        :class="
                          tx.amount > 0 ? 'amount-positive' : 'amount-negative'
                        "
                      >
                        {{ tx.amount > 0 ? "+" : "" }}{{ tx.amount }}
                      </td>
                      <td>{{ tx.operation }}</td>
                      <td class="text-muted">{{ tx.biz_ref_type }}</td>
                      <td class="text-muted">
                        {{ formatDate(tx.created_at) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="empty-hint">暂无流水记录</p>
              </section>

              <!-- F.4: Reservations tab -->
              <section
                v-else-if="activeTab === 'reservations'"
                role="tabpanel"
                data-test="reservations-panel"
              >
                <h4 class="section-title">
                  活跃 Reservation (status=reserved)
                </h4>
                <p class="reservation-hint">
                  显示当前用户已 Reserve 但尚未 Finalize / Refund 的记录。
                  正常情况下数量应为 0；若长期存在 reserved 记录，通常表示 SOP
                  步骤执行中或排障目标。
                </p>
                <table
                  class="inner-table"
                  v-if="
                    detail.reservations &&
                    detail.reservations.filter((r) => r.status === 'reserved')
                      .length
                  "
                >
                  <thead>
                    <tr>
                      <th>Reservation ID</th>
                      <th>金额</th>
                      <th>状态</th>
                      <th>Biz Ref Type</th>
                      <th>Biz Ref ID</th>
                      <th>创建时间</th>
                      <th>到期时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in detail.reservations.filter(
                        (rr) => rr.status === 'reserved',
                      )"
                      :key="r.id"
                    >
                      <td>{{ r.id }}</td>
                      <td>{{ r.amount }}</td>
                      <td>
                        <StatusBadge
                          :status="r.status"
                          :map="reservationStatusMap"
                        />
                      </td>
                      <td class="text-muted">{{ r.ref_type || "-" }}</td>
                      <td class="text-muted">{{ r.ref_id || "-" }}</td>
                      <td class="text-muted">
                        {{ formatDate(r.created_at) }}
                      </td>
                      <td class="text-muted">
                        {{ r.expires_at ? formatDate(r.expires_at) : "-" }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p v-else class="empty-hint">暂无活跃 reservation</p>
              </section>

              <div class="modal-actions">
                <AppButton
                  variant="primary"
                  @click="
                    openRecharge(selectedUserId);
                    detailVisible = false;
                  "
                >
                  <Coins :size="14" />
                  充值额度
                </AppButton>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Recharge Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="rechargeVisible"
          class="modal-overlay"
          @click.self="rechargeVisible = false"
          @keydown.esc="rechargeVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">充值额度（用户 #{{ rechargeUserId }}）</h3>

            <div class="form-group">
              <label class="form-label">额度包类型</label>
              <AppSelect v-model="rechargeType" :options="typeOptions" />
            </div>

            <div class="form-group">
              <label class="form-label">额度数量</label>
              <AppInput
                v-model="rechargeCreditsAmount"
                type="number"
                placeholder="请输入额度数量"
              />
            </div>

            <div class="form-group">
              <label class="form-label">有效期</label>
              <AppSelect
                v-model="rechargeExpiresIn"
                :options="expiresInOptions"
              />
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="rechargeVisible = false"
                >取消</AppButton
              >
              <AppButton
                variant="primary"
                :loading="rechargeProcessing"
                @click="submitRecharge"
              >
                <RefreshCw :size="14" />
                确认充值
              </AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.action-buttons {
  display: flex;
  gap: var(--space-1);
}

.text-muted {
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
}

.modal-card--wide {
  width: min(800px, 95vw);
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.modal-loading {
  text-align: center;
  color: var(--on-surface-variant);
  padding: var(--space-6);
}

.detail-summary {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-low);
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.section-title {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: var(--space-4) 0 var(--space-2);
}

.inner-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
  margin-bottom: var(--space-2);
}

.inner-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--outline-variant);
  color: var(--on-surface-variant);
  font-family: var(--font-label);
  font-weight: 700;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inner-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--outline-variant);
  color: var(--on-surface);
}

.amount-positive {
  color: var(--success);
  font-weight: 600;
}

.amount-negative {
  color: var(--danger);
  font-weight: 600;
}

.empty-hint {
  color: var(--on-surface-variant);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-4);
}

/* F.4: legacy-tier banner + tab bar */
.banner {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  line-height: 1.5;
  margin-bottom: var(--space-3);
}

.banner.legacy-tier {
  background: var(--warning-soft, rgba(255, 196, 0, 0.12));
  color: var(--on-surface);
  border-left: 3px solid var(--warning, #d97706);
}

.banner code {
  font-family: ui-monospace, "SF Mono", monospace;
  background: rgba(0, 0, 0, 0.06);
  padding: 0 4px;
  border-radius: 3px;
  font-size: var(--text-xs);
}

.tab-bar {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--outline-variant);
  margin: var(--space-4) 0 var(--space-3);
}

.tab-btn {
  background: transparent;
  border: none;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--on-surface-variant);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.tab-btn:hover {
  color: var(--on-surface);
}

.tab-btn--active {
  color: var(--tertiary);
  border-bottom-color: var(--tertiary);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
}

.reservation-hint {
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin: 0 0 var(--space-3);
  line-height: 1.5;
}
</style>
