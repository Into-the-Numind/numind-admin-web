<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { listServicesApi, listTasksApi } from "@/api/ai";
import type { TaskProfile, AIService } from "@/types/ai";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import { Pencil } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { useRouter } from "vue-router";

const router = useRouter();
const toast = useToast();

const tasks = ref<TaskProfile[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const loading = ref(false);
const error = ref("");

// Service map for display
const serviceMap = ref<Record<number, AIService>>({});

const columns: Column[] = [
  { key: "task_id", title: "任务 ID", width: "200px", align: "left" },
  { key: "display_name", title: "显示名称", width: "180px", align: "left" },
  { key: "service_type", title: "服务类型", width: "100px" },
  { key: "default_service", title: "默认服务", align: "left" },
  { key: "fallback_count", title: "Fallback 数", width: "100px" },
  { key: "allowed_count", title: "允许服务数", width: "100px" },
  { key: "actions", title: "操作", width: "80px" },
];

function getDefaultServiceName(task: TaskProfile): string {
  const id = task.default_service_id;
  if (!id) return "—";
  const svc = serviceMap.value[id];
  return svc ? svc.display_name || svc.model_key : String(id);
}

async function fetchTasks() {
  loading.value = true;
  error.value = "";
  try {
    const [tasksRes, servicesRes] = await Promise.all([
      listTasksApi({ page: page.value, page_size: pageSize }),
      listServicesApi({ page: 1, page_size: 100 }),
    ]);
    tasks.value = tasksRes.list ?? [];
    total.value = tasksRes.total ?? 0;
    const map: Record<number, AIService> = {};
    for (const s of servicesRes.list ?? []) {
      map[s.id] = s;
    }
    serviceMap.value = map;
  } catch (e) {
    error.value = (e as Error).message || "加载任务失败";
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

function goEdit(task: TaskProfile) {
  router.push(`/ai-tasks/${task.task_id}/edit`);
}

watch(page, fetchTasks);
onMounted(fetchTasks);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">AI Services / Tasks</p>
        <h1 class="page-title">任务配置</h1>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error && !loading" class="error-alert">
      <span>{{ error }}</span>
      <AppButton size="sm" variant="secondary" @click="fetchTasks">
        重试
      </AppButton>
    </div>

    <DataTable
      :columns="columns"
      :data="tasks"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      empty-text="暂无任务配置"
      @update:page="page = $event"
    >
      <template #cell-service_type="{ row }">
        <span class="type-tag">
          {{ (row as TaskProfile).service_type?.toUpperCase() || "—" }}
        </span>
      </template>

      <template #cell-default_service="{ row }">
        <span class="service-name">{{ getDefaultServiceName(row) }}</span>
      </template>

      <template #cell-fallback_count="{ row }">
        {{ (row as TaskProfile).fallback_count ?? 0 }}
      </template>

      <template #cell-allowed_count="{ row }">
        {{ (row as TaskProfile).allowed_count ?? 0 }}
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            title="编辑"
            @click.stop="goEdit(row as TaskProfile)"
          >
            <Pencil :size="14" />
          </AppButton>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
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

.service-name {
  font-size: var(--text-sm);
  color: var(--on-surface);
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
}
</style>
