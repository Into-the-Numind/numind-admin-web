<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  listCreditUsers, getCreditUserDetail, rechargeCredits,
  type CreditUserListItem, type CreditUserDetail
} from '@/api/credits'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { Coins, RefreshCw } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'

const toast = useToast()

// List state
const items = ref<CreditUserListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')

// Detail modal
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<CreditUserDetail | null>(null)
const selectedUserId = ref(0)

// Recharge modal
const rechargeVisible = ref(false)
const rechargeUserId = ref(0)
const rechargeType = ref('subscription')
const rechargeCreditsAmount = ref('100')
const rechargeExpiresIn = ref('30d')
const rechargeProcessing = ref(false)

const accountStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'success' },
  frozen: { label: '冻结', color: 'danger' }
}

const packageStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: '使用中', color: 'success' },
  exhausted: { label: '已耗尽', color: 'gray' },
  expired: { label: '已过期', color: 'danger' }
}

const columns: Column[] = [
  { key: 'user_id', title: '用户ID', width: '80px' },
  { key: 'username', title: '用户名', width: '140px' },
  { key: 'balance', title: '额度余额', width: '100px', align: 'right' },
  { key: 'status', title: '账户状态', width: '90px' },
  { key: 'created_at', title: '创建时间', width: '140px' },
  { key: 'actions', title: '操作', width: '160px' }
]

const typeOptions = [
  { label: 'subscription（订阅）', value: 'subscription' },
  { label: 'booster（加量包）', value: 'booster' },
  { label: 'trial（试用）', value: 'trial' }
]

const expiresInOptions = [
  { label: '30天', value: '30d' },
  { label: '90天', value: '90d' },
  { label: '180天', value: '180d' },
  { label: '1年', value: '365d' }
]

async function fetchList() {
  loading.value = true
  error.value = ''
  try {
    const res = await listCreditUsers((page.value - 1) * pageSize, pageSize)
    items.value = res.items
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function openDetail(userId: number) {
  selectedUserId.value = userId
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getCreditUserDetail(userId)
  } catch (e) {
    toast.error((e as Error).message || '加载详情失败')
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function openRecharge(userId: number) {
  rechargeUserId.value = userId
  rechargeType.value = 'subscription'
  rechargeCreditsAmount.value = '100'
  rechargeExpiresIn.value = '30d'
  rechargeVisible.value = true
}

async function submitRecharge() {
  if (rechargeProcessing.value) return
  rechargeProcessing.value = true
  try {
    await rechargeCredits(rechargeUserId.value, {
      type: rechargeType.value,
      total_credits: Number(rechargeCreditsAmount.value),
      expires_in: rechargeExpiresIn.value
    })
    rechargeVisible.value = false
    toast.success('充值成功')
    await fetchList()
  } catch (e) {
    toast.error((e as Error).message || '充值失败')
  } finally {
    rechargeProcessing.value = false
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">额度管理</h1>
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
      @update:page="page = $event; fetchList()"
      @row-click="row => openDetail((row as CreditUserListItem).user_id)"
    >
      <template #cell-user_id="{ row }">
        <span class="text-muted">{{ (row as CreditUserListItem).user_id }}</span>
      </template>

      <template #cell-username="{ row }">
        {{ (row as CreditUserListItem).nickname || (row as CreditUserListItem).username || '-' }}
      </template>

      <template #cell-balance="{ row }">
        <strong>{{ (row as CreditUserListItem).account?.balance ?? '-' }}</strong>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :status="String((row as CreditUserListItem).account?.status)"
          :map="accountStatusMap"
        />
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-muted">{{ formatDate(String((row as CreditUserListItem).account?.created_at)) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton size="sm" variant="ghost" @click.stop="openDetail((row as CreditUserListItem).user_id)">
            查看
          </AppButton>
          <AppButton size="sm" variant="ghost" @click.stop="openRecharge((row as CreditUserListItem).user_id)">
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
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <div class="modal-header">
              <h3 class="modal-title">额度详情（用户 #{{ selectedUserId }}）</h3>
              <AppButton size="sm" variant="ghost" @click="detailVisible = false">关闭</AppButton>
            </div>

            <div v-if="detailLoading" class="modal-loading">加载中...</div>

            <template v-else-if="detail">
              <!-- Account summary -->
              <div class="detail-summary">
                <span>余额：<strong>{{ detail.account.balance }}</strong></span>
                <StatusBadge :status="detail.account.status" :map="accountStatusMap" />
              </div>

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
                    <td class="text-muted">{{ formatDate(pkg.activated_at) }}</td>
                    <td class="text-muted">{{ formatDate(pkg.expires_at) }}</td>
                    <td><StatusBadge :status="pkg.status" :map="packageStatusMap" /></td>
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
                    <td :class="tx.amount > 0 ? 'amount-positive' : 'amount-negative'">
                      {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
                    </td>
                    <td>{{ tx.operation }}</td>
                    <td class="text-muted">{{ tx.biz_ref_type }}</td>
                    <td class="text-muted">{{ formatDate(tx.created_at) }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="empty-hint">暂无流水记录</p>

              <div class="modal-actions">
                <AppButton variant="primary" @click="openRecharge(selectedUserId); detailVisible = false">
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
              <AppInput v-model="rechargeCreditsAmount" type="number" placeholder="请输入额度数量" />
            </div>

            <div class="form-group">
              <label class="form-label">有效期</label>
              <AppSelect v-model="rechargeExpiresIn" :options="expiresInOptions" />
            </div>

            <div class="modal-actions">
              <AppButton variant="secondary" @click="rechargeVisible = false">取消</AppButton>
              <AppButton variant="primary" :loading="rechargeProcessing" @click="submitRecharge">
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
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  padding: var(--space-6);
}

.detail-summary {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
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
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
  font-weight: 500;
  font-size: var(--text-xs);
}

.inner-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-light, var(--border));
}

.amount-positive {
  color: var(--success, #16a34a);
  font-weight: 600;
}

.amount-negative {
  color: var(--danger, #dc2626);
  font-weight: 600;
}

.empty-hint {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-4);
}
</style>
