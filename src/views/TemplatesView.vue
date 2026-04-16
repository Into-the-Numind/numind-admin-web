<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  getTemplatesApi,
  deleteTemplateApi,
  type SopTemplate,
} from "@/api/templates";
import AppButton from "@/components/common/AppButton.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { Pencil, Trash2, Plus } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";
import { templateStatusLabels } from "@/constants/statusMaps";

const router = useRouter();
const toast = useToast();
const templates = ref<SopTemplate[]>([]);
const total = ref(0);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const error = ref("");
const processing = ref(false);

const deleteModalVisible = ref(false);
const deleteTarget = ref<SopTemplate | null>(null);

const columns: Column[] = [
  { key: "id", title: "ID", width: "80px" },
  { key: "name", title: "名称" },
  { key: "status", title: "状态", width: "120px" },
  { key: "description", title: "描述" },
  { key: "created_at", title: "创建时间", width: "180px" },
  { key: "actions", title: "操作", width: "120px" },
];

async function fetchTemplates() {
  loading.value = true;
  error.value = "";
  try {
    const offset = (page.value - 1) * pageSize;
    const res = await getTemplatesApi(offset, pageSize);
    templates.value = res.templates;
    total.value = res.total;
  } catch (e) {
    error.value = (e as Error).message || "加载模板列表失败";
  } finally {
    loading.value = false;
  }
}

function editTemplate(id: number) {
  router.push(`/templates/${id}/edit`);
}

function createTemplate() {
  router.push("/templates/new");
}

function confirmDelete(event: Event, tpl: SopTemplate) {
  event.stopPropagation();
  deleteTarget.value = tpl;
  deleteModalVisible.value = true;
}

async function executeDelete() {
  if (!deleteTarget.value || processing.value) return;
  processing.value = true;
  try {
    await deleteTemplateApi(deleteTarget.value.id);
    deleteModalVisible.value = false;
    deleteTarget.value = null;
    toast.success("模板已删除");
    await fetchTemplates();
  } catch (e) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    processing.value = false;
  }
}

function truncateText(text: string, max = 60): string {
  if (!text) return "暂无描述";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function handlePageChange(newPage: number) {
  page.value = newPage;
  fetchTemplates();
}

onMounted(fetchTemplates);
</script>

<template>
  <div class="page-container">
    <p class="page-breadcrumb">Content / Templates</p>
    <div class="page-header">
      <h1 class="page-title">SOP模板管理</h1>
      <AppButton variant="primary" @click="createTemplate">
        <Plus :size="16" />
        新建模板
      </AppButton>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <DataTable
      :columns="columns"
      :data="templates"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      empty-text="暂无模板，点击上方按钮创建"
      clickable
      @update:page="handlePageChange"
      @row-click="(row: SopTemplate) => editTemplate(row.id)"
    >
      <template #cell-status="{ row }">
        <StatusBadge
          :status="String((row as SopTemplate).status)"
          :map="templateStatusLabels"
        />
      </template>

      <template #cell-description="{ row }">
        <span class="text-muted">{{
          truncateText((row as SopTemplate).description)
        }}</span>
      </template>

      <template #cell-created_at="{ row }">
        <span class="text-muted">{{
          formatDate(String((row as SopTemplate).created_at))
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="table-actions">
          <AppButton
            size="sm"
            variant="ghost"
            @click.stop="editTemplate((row as SopTemplate).id)"
          >
            <Pencil :size="14" />
          </AppButton>
          <AppButton
            size="sm"
            variant="danger"
            @click.stop="(e: Event) => confirmDelete(e, row as SopTemplate)"
          >
            <Trash2 :size="14" />
          </AppButton>
        </div>
      </template>
    </DataTable>

    <ConfirmModal
      :visible="deleteModalVisible"
      title="删除模板"
      :message="
        '确定要删除模板「' +
        (deleteTarget?.name || '') +
        '」吗？此操作不可恢复。'
      "
      confirm-text="删除"
      :danger="true"
      @confirm="executeDelete"
      @cancel="deleteModalVisible = false"
    />
  </div>
</template>

<style scoped>
.table-actions {
  display: flex;
  gap: var(--space-1);
}
</style>
