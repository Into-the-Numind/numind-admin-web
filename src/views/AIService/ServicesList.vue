<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { listServicesApi, deleteServiceApi, restoreServiceApi } from "@/api/ai";
import type { AIService } from "@/types/ai";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { useRouter } from "vue-router";

const router = useRouter();
const toast = useToast();

const services = ref<AIService[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");
const processing = ref(false);

// Filters
const filterType = ref("");
const filterStatus = ref("active");

const serviceTypeOptions = [
  { label: "全部类型", value: "" },
  { label: "LLM", value: "llm" },
  { label: "OCR", value: "ocr" },
  { label: "ASR", value: "asr" },
];

const statusOptions = [
  { label: "启用（默认）", value: "active" },
  { label: "已删除", value: "deprecated" },
  { label: "全部（含已删除）", value: "all" },
];

const serviceStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: "启用", color: "success" },
  inactive: { label: "停用", color: "warning" },
  deleted: { label: "已删除", color: "danger" },
};

// Delete confirm
const confirmVisible = ref(false);
const pendingDeleteId = ref(0);
const pendingDeleteName = ref("");

const columns: Column[] = [
  { key: "model_key", title: "标识", width: "180px", align: "left" },
  { key: "display_name", title: "显示名称", width: "180px", align: "left" },
  { key: "service_type", title: "类型", width: "80px" },
  { key: "route_count", title: "路由数", width: "120px" },
  { key: "tiers", title: "档位 (延迟·质量)", width: "160px", align: "left" },
  { key: "status", title: "状态", width: "90px" },
  { key: "actions", title: "操作", width: "120px" },
];

function getStatus(service: AIService): string {
  if (service.deprecated_at) return "deleted";
  if (!service.is_active) return "inactive";
  return "active";
}

function getTiersText(service: AIService): string {
  const latency = service.latency_tier || "standard";
  const quality = service.quality_tier || "standard";
  return `${latency} · ${quality}`;
}

async function fetchServices() {
  loading.value = true;
  error.value = "";
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      page_size: pageSize,
    };
    if (filterType.value) params.service_type = filterType.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const res = await listServicesApi(
      params as Parameters<typeof listServicesApi>[0],
    );
    services.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = (e as Error).message || "加载服务失败";
  } finally {
    loading.value = false;
  }
}

function goEdit(service: AIService) {
  router.push(`/ai-services/${service.id}/edit`);
}

function goCreate() {
  router.push("/ai-services/new/edit");
}

function confirmDelete(service: AIService) {
  pendingDeleteId.value = service.id;
  pendingDeleteName.value = service.display_name || service.model_key;
  confirmVisible.value = true;
}

async function executeDelete() {
  if (processing.value) return;
  processing.value = true;
  try {
    await deleteServiceApi(pendingDeleteId.value);
    confirmVisible.value = false;
    toast.success("服务已删除");
    await fetchServices();
  } catch (e) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    processing.value = false;
  }
}

async function restoreService(service: AIService) {
  if (processing.value) return;
  processing.value = true;
  try {
    await restoreServiceApi(service.id, "管理员恢复服务");
    toast.success("服务已恢复");
    await fetchServices();
  } catch (e) {
    toast.error((e as Error).message || "恢复失败");
  } finally {
    processing.value = false;
  }
}

function handleFilterChange() {
  page.value = 1;
  fetchServices();
}

watch(page, fetchServices);
onMounted(fetchServices);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <p class="page-breadcrumb">AI Services / Management</p>
      <h1 class="page-title">AI 服务管理</h1>
      <AppButton variant="primary" @click="goCreate">
        <Plus :size="16" />
        新建服务
      </AppButton>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <AppSelect
        v-model="filterType"
        :options="serviceTypeOptions"
        size="sm"
        @change="handleFilterChange"
      />
      <AppSelect
        v-model="filterStatus"
        :options="statusOptions"
        size="sm"
        @change="handleFilterChange"
      />
      <AppButton size="sm" variant="secondary" @click="handleFilterChange">
        筛选
      </AppButton>
    </div>

    <!-- Error state -->
    <div v-if="error && !loading" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="fetchServices">
        重试
      </AppButton>
    </div>

    <DataTable
      :columns="columns"
      :data="services"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event"
    >
      <template #cell-service_type="{ value }">
        <span class="type-tag">{{ String(value).toUpperCase() }}</span>
      </template>

      <template #cell-route_count="{ row }">
        <div class="route-count-cell">
          <span class="route-count-num">{{
            (row as AIService).route_count ?? 0
          }}</span>
          <span
            v-if="((row as AIService).route_count ?? 0) === 0"
            class="orphan-badge"
            title="该服务没有任何启用中的路由，调用时将直接失败。检查 route 配置或启用已禁用的路由。"
          >
            ⚠ 无可用路由
          </span>
        </div>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :status="getStatus(row as AIService)"
          :map="serviceStatusMap"
        />
      </template>

      <template #cell-tiers="{ row }">
        <span class="text-mono text-muted">{{
          getTiersText(row as AIService)
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            title="编辑"
            @click.stop="goEdit(row as AIService)"
          >
            <Pencil :size="14" />
          </AppButton>
          <AppButton
            v-if="(row as AIService).deprecated_at"
            size="sm"
            variant="ghost"
            :disabled="processing"
            title="恢复"
            @click.stop="restoreService(row as AIService)"
          >
            <RotateCcw :size="14" style="color: var(--success)" />
          </AppButton>
          <AppButton
            v-else
            size="sm"
            variant="ghost"
            :disabled="processing"
            title="删除"
            @click.stop="confirmDelete(row as AIService)"
          >
            <Trash2 :size="14" style="color: var(--danger)" />
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Delete Confirm -->
    <ConfirmModal
      :visible="confirmVisible"
      title="删除 AI 服务"
      :message="`确定要删除服务「${pendingDeleteName}」吗？删除后可恢复。`"
      :danger="true"
      @confirm="executeDelete"
      @cancel="confirmVisible = false"
    />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.type-tag {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--on-surface-variant);
  background: var(--surface-low);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.text-muted {
  color: var(--on-surface-variant);
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
}

.route-count-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-content: center;
}

.route-count-num {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--on-surface);
  min-width: 1.5em;
  text-align: right;
}

.orphan-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  font-family: var(--font-label);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
  border-radius: var(--radius-sm);
  line-height: 1.5;
  background: var(--danger-soft);
  color: #dc2626;
  white-space: nowrap;
}
</style>
