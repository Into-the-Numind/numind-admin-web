<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listOrders, type Order } from '@/api/orders'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { formatDate } from '@/utils/format'

// List state
const orders = ref<Order[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')

const payStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待支付', color: 'warning' },
  paid: { label: '已支付', color: 'success' },
  refunded: { label: '已退款', color: 'info' },
  closed: { label: '已关闭', color: 'gray' }
}

const columns: Column[] = [
  { key: 'order_no', title: '订单号', width: '200px' },
  { key: 'user_id', title: '用户ID', width: '80px' },
  { key: 'payer_id', title: '付款方ID', width: '90px' },
  { key: 'product_type', title: '产品类型', width: '110px' },
  { key: 'amount', title: '金额(元)', width: '90px', align: 'right' },
  { key: 'pay_channel', title: '支付渠道', width: '100px' },
  { key: 'pay_status', title: '状态', width: '90px' },
  { key: 'created_at', title: '创建时间', width: '140px' }
]

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

async function fetchOrders() {
  loading.value = true
  error.value = ''
  try {
    const res = await listOrders((page.value - 1) * pageSize, pageSize)
    orders.value = res.items
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载订单列表失败'
  } finally {
    loading.value = false
  }
}

onMounted(fetchOrders)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">订单管理</h1>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="orders"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event; fetchOrders()"
    >
      <template #cell-order_no="{ row }">
        <span class="order-no">{{ (row as Order).order_no }}</span>
      </template>

      <template #cell-user_id="{ row }">
        <span class="text-muted">{{ (row as Order).user_id }}</span>
      </template>

      <template #cell-payer_id="{ row }">
        <span class="text-muted">{{ (row as Order).payer_id }}</span>
      </template>

      <template #cell-product_type="{ row }">
        {{ (row as Order).product_type }}
      </template>

      <template #cell-amount="{ row }">
        <strong>¥{{ centsToYuan((row as Order).amount) }}</strong>
      </template>

      <template #cell-pay_channel="{ row }">
        <span class="text-muted">{{ (row as Order).pay_channel || '-' }}</span>
      </template>

      <template #cell-pay_status="{ row }">
        <StatusBadge :status="String((row as Order).pay_status)" :map="payStatusMap" />
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-muted">{{ formatDate(String((row as Order).created_at)) }}</span>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.text-muted {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.order-no {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
</style>
