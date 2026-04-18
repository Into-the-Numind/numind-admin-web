<script setup lang="ts">
import { ref, onMounted } from "vue";
import { listProvidersApi, deleteProviderApi } from "@/api/ai";
import type { ProviderDTO } from "@/types/ai";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { Plus, Pencil, Trash2 } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { useRouter } from "vue-router";

const router = useRouter();
const toast = useToast();

const providers = ref<ProviderDTO[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");
const processing = ref(false);

// Delete confirm
const confirmVisible = ref(false);
const pendingDeleteId = ref(0);
const pendingDeleteName = ref("");

const providerStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: "启用", color: "success" },
  inactive: { label: "停用", color: "warning" },
};

const columns: Column[] = [
  { key: "name", title: "标识", width: "160px", align: "left" },
  { key: "display_name", title: "显示名称", width: "160px", align: "left" },
  { key: "base_url", title: "Base URL", width: "240px", align: "left" },
  { key: "api_key", title: "API Key", width: "140px", align: "left" },
  { key: "status", title: "状态", width: "90px" },
  { key: "created_at", title: "创建时间", width: "160px", align: "left" },
  { key: "actions", title: "操作", width: "100px" },
];

function getStatus(provider: ProviderDTO): string {
  return provider.is_active ? "active" : "inactive";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function fetchProviders() {
  loading.value = true;
  error.value = "";
  try {
    const res = await listProvidersApi();
    providers.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = (e as Error).message || "加载供应商失败";
  } finally {
    loading.value = false;
  }
}

function goEdit(provider: ProviderDTO) {
  router.push(`/ai-providers/${provider.id}`);
}

function goCreate() {
  router.push("/ai-providers/new");
}

function confirmDelete(provider: ProviderDTO) {
  pendingDeleteId.value = provider.id;
  pendingDeleteName.value = provider.display_name || provider.name;
  confirmVisible.value = true;
}

async function executeDelete() {
  if (processing.value) return;
  processing.value = true;
  try {
    await deleteProviderApi(pendingDeleteId.value);
    confirmVisible.value = false;
    toast.success("供应商已删除");
    await fetchProviders();
  } catch (e) {
    const err = e as Error & { code?: number | string };
    // HTTP 409 — provider has active routes referencing it
    if (
      err.code === 409 ||
      (e as { response?: { status?: number } }).response?.status === 409
    ) {
      toast.error("该供应商还有激活路由引用，请先删除路由或切换到其他供应商");
    } else {
      toast.error(err.message || "删除失败");
    }
    confirmVisible.value = false;
  } finally {
    processing.value = false;
  }
}

onMounted(fetchProviders);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <p class="page-breadcrumb">AI Services / Providers</p>
      <h1 class="page-title">AI 供应商管理</h1>
      <AppButton variant="primary" @click="goCreate">
        <Plus :size="16" />
        新增供应商
      </AppButton>
    </div>

    <!-- Error state -->
    <div v-if="error && !loading" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="fetchProviders">
        重试
      </AppButton>
    </div>

    <DataTable
      :columns="columns"
      :data="providers"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      empty-text="暂无 AI 供应商，点击「新增供应商」添加"
      @update:page="
        (p) => {
          page = p;
          fetchProviders();
        }
      "
    >
      <template #cell-base_url="{ value }">
        <span class="text-mono text-muted text-truncate">{{ value }}</span>
      </template>

      <template #cell-api_key="{ value }">
        <span class="text-mono text-muted">{{ value }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :status="getStatus(row as ProviderDTO)"
          :map="providerStatusMap"
        />
      </template>

      <template #cell-created_at="{ value }">
        <span class="text-muted">{{ formatDate(String(value)) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            title="编辑"
            @click.stop="goEdit(row as ProviderDTO)"
          >
            <Pencil :size="14" />
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            title="删除"
            @click.stop="confirmDelete(row as ProviderDTO)"
          >
            <Trash2 :size="14" style="color: var(--danger)" />
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Delete Confirm -->
    <ConfirmModal
      :visible="confirmVisible"
      title="删除 AI 供应商"
      :message="`确定删除供应商「${pendingDeleteName}」？`"
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

.error-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-light);
  color: #991b1b;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
}

.page-breadcrumb {
  width: 100%;
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  margin-bottom: var(--space-1);
}

.text-mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.text-muted {
  color: var(--on-surface-variant);
}

.text-truncate {
  display: block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
}
</style>
