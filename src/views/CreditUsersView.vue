<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  listCreditUsers,
  getCreditUserDetail,
  type CreditUserListItem,
  type CreditUserDetail,
} from "@/api/credits";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
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
  { key: "actions", title: "操作", width: "100px" },
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
            </template>
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
