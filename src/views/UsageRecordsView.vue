<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getUsageRecordsApi, type UsageRecord, type UsageRecordListParams } from '@/api/billing'
import DataTable, { type Column } from '@/components/common/DataTable.vue'
import AppInput from '@/components/common/AppInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import { Search } from 'lucide-vue-next'
import { formatDateTime } from '@/utils/format'
import {
  serviceTypeLabels, operationLabels, providerLabels, formatCost,
  serviceTypeFilterOptions, providerFilterOptions, operationFilterOptions
} from '@/constants/billingMaps'

const records = ref<UsageRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')

const userIdSearch = ref('')
const serviceTypeFilter = ref('')
const providerFilter = ref('')
const operationFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const columns: Column[] = [
  { key: 'id', title: 'ID', width: '70px' },
  { key: 'user_id', title: '用户ID', width: '70px' },
  { key: 'service_type', title: '服务类型', width: '110px' },
  { key: 'provider', title: '供应商', width: '90px' },
  { key: 'model', title: '模型', width: '140px' },
  { key: 'operation', title: '操作', width: '120px' },
  { key: 'total_tokens', title: 'Tokens', width: '80px', align: 'right' },
  { key: 'cost_cents', title: '成本', width: '80px', align: 'right' },
  { key: 'revenue_cents', title: '收入', width: '80px', align: 'right' },
  { key: 'created_at', title: '时间', width: '140px' }
]

async function fetchRecords() {
  loading.value = true
  error.value = ''
  try {
    const params: UsageRecordListParams = {
      offset: (page.value - 1) * pageSize,
      limit: pageSize
    }
    if (userIdSearch.value) params.user_id = Number(userIdSearch.value)
    if (serviceTypeFilter.value) params.service_type = serviceTypeFilter.value
    if (providerFilter.value) params.provider = providerFilter.value
    if (operationFilter.value) params.operation = operationFilter.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value

    const res = await getUsageRecordsApi(params)
    records.value = res.records
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载用量记录失败'
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout>
watch(userIdSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchRecords()
  }, 400)
})

watch([serviceTypeFilter, providerFilter, operationFilter, dateFrom, dateTo], () => {
  page.value = 1
  fetchRecords()
})

watch(page, fetchRecords)

onMounted(fetchRecords)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">用量明细</h1>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-input">
        <AppInput v-model="userIdSearch" placeholder="用户ID..." size="md">
          <template #prefix>
            <Search :size="16" style="color: var(--gray-400); flex-shrink: 0;" />
          </template>
        </AppInput>
      </div>
      <AppSelect v-model="serviceTypeFilter" :options="serviceTypeFilterOptions" placeholder="服务类型" />
      <AppSelect v-model="providerFilter" :options="providerFilterOptions" placeholder="供应商" />
      <AppSelect v-model="operationFilter" :options="operationFilterOptions" placeholder="操作" />
      <input v-model="dateFrom" type="date" class="date-input" placeholder="开始日期" />
      <input v-model="dateTo" type="date" class="date-input" placeholder="结束日期" />
    </div>

    <!-- Table -->
    <DataTable
      :columns="columns"
      :data="records"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event"
    >
      <template #cell-service_type="{ row }">
        <span class="label-badge">{{ serviceTypeLabels[(row as UsageRecord).service_type] || (row as UsageRecord).service_type }}</span>
      </template>

      <template #cell-provider="{ row }">
        <span>{{ providerLabels[(row as UsageRecord).provider] || (row as UsageRecord).provider }}</span>
      </template>

      <template #cell-operation="{ row }">
        <span>{{ operationLabels[(row as UsageRecord).operation] || (row as UsageRecord).operation }}</span>
      </template>

      <template #cell-total_tokens="{ row }">
        <span class="text-mono">{{ (row as UsageRecord).total_tokens.toLocaleString() }}</span>
      </template>

      <template #cell-cost_cents="{ row }">
        <span class="text-mono">{{ formatCost((row as UsageRecord).cost_cents) }}</span>
      </template>

      <template #cell-revenue_cents="{ row }">
        <span class="text-mono text-revenue">{{ formatCost((row as UsageRecord).revenue_cents) }}</span>
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-muted">{{ formatDateTime(String((row as UsageRecord).created_at)) }}</span>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
  align-items: center;
}

.filter-input {
  min-width: 120px;
  max-width: 160px;
}

.date-input {
  height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text);
  background: var(--surface);
}

.date-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.label-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  background: var(--gray-100);
  color: var(--text-secondary);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.text-revenue {
  color: var(--primary);
}

.text-muted {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}
</style>
