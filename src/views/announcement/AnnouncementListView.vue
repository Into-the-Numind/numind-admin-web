<script setup lang="ts">
// AnnouncementListView — admin announcement/survey list (notification-center spec §6.2).
// Hard rules: DataTable layout, ConfirmModal for archive/delete, 4 async states.
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useAnnouncementStore } from "@/stores/announcement";
import type { AdminAnnouncementBrief } from "@/api/announcements";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppSelect from "@/components/common/AppSelect.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";
import { Plus, BarChart3 } from "lucide-vue-next";

const router = useRouter();
const store = useAnnouncementStore();
const toast = useToast();
const { list, total, loading, error, saving } = storeToRefs(store);

// ---------- Filters ----------
const page = ref(1);
const pageSize = 20;
const statusFilter = ref(""); // "" = 全部
const typeFilter = ref("");

const statusOptions = [
  { value: "", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "archived", label: "已归档" },
];

const typeOptions = [
  { value: "", label: "全部类型" },
  { value: "plain", label: "公告" },
  { value: "survey", label: "问卷" },
];

const columns: Column[] = [
  { key: "title", title: "标题", align: "left" },
  { key: "type", title: "类型", width: "90px" },
  { key: "status", title: "状态", width: "100px" },
  { key: "published_at", title: "发布时间", width: "150px" },
  { key: "read_rate", title: "已读率", width: "100px", align: "right" },
  { key: "actions", title: "操作", width: "260px" },
];

// ---------- Confirm modal (archive / delete) ----------
const confirmVisible = ref(false);
const confirmTitle = ref("");
const confirmMessage = ref("");
const confirmText = ref("确定");
const pendingAction = ref<(() => Promise<void>) | null>(null);

function openConfirm(
  title: string,
  message: string,
  okText: string,
  action: () => Promise<void>,
) {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmText.value = okText;
  pendingAction.value = action;
  confirmVisible.value = true;
}

async function executeConfirm() {
  if (saving.value) return;
  try {
    if (pendingAction.value) {
      await pendingAction.value();
      pendingAction.value = null;
    }
    confirmVisible.value = false;
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  }
}

function cancelConfirm() {
  confirmVisible.value = false;
  pendingAction.value = null;
}

// ---------- Data loading ----------
async function fetchList() {
  try {
    await store.fetchList({
      page: page.value,
      page_size: pageSize,
      status: statusFilter.value || undefined,
      type: typeFilter.value || undefined,
    });
  } catch {
    // error stored in store.error; banner handles it
  }
}

onMounted(fetchList);

watch(page, fetchList);
watch([statusFilter, typeFilter], () => {
  page.value = 1;
  fetchList();
});

// ---------- Display helpers ----------
function typeLabel(type: string): string {
  return type === "survey" ? "问卷" : "公告";
}

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

function readRateText(row: AdminAnnouncementBrief): string {
  if (!row.target_count || row.target_count === 0) return "–";
  const pct = (row.read_count / row.target_count) * 100;
  return `${pct.toFixed(1)}%`;
}

// ---------- Navigation ----------
function goNew() {
  router.push("/announcements/new");
}

function goEdit(id: number) {
  router.push(`/announcements/${id}/edit`);
}

// Stats route is registered in T6b; navigate by path string.
function goStats(id: number) {
  router.push(`/announcements/${id}/stats`);
}

// ---------- Row actions ----------
async function handlePublish(row: AdminAnnouncementBrief) {
  try {
    await store.publish(row.id);
    toast.success("公告已发布");
    await fetchList();
  } catch (e) {
    toast.error((e as Error).message || "发布失败");
  }
}

function handleArchive(row: AdminAnnouncementBrief) {
  openConfirm(
    "归档公告",
    `确定要归档「${row.title}」吗？归档后用户端不再展示。`,
    "确定归档",
    async () => {
      await store.archive(row.id);
      toast.success("公告已归档");
      await fetchList();
    },
  );
}

function handleDelete(row: AdminAnnouncementBrief) {
  openConfirm(
    "删除公告",
    `确定要删除「${row.title}」吗？此操作不可恢复。`,
    "确认删除",
    async () => {
      await store.remove(row.id);
      toast.success("公告已删除");
    },
  );
}

const isEmpty = computed(
  () => !loading.value && !error.value && list.value.length === 0,
);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">Notification / Announcements</p>
        <h1 class="page-title">公告管理</h1>
      </div>
      <AppButton variant="primary" @click="goNew">
        <Plus :size="16" /> 新建公告
      </AppButton>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-select">
        <AppSelect
          v-model="statusFilter"
          :options="statusOptions"
          size="md"
          placeholder=""
        />
      </div>
      <div class="filter-select">
        <AppSelect
          v-model="typeFilter"
          :options="typeOptions"
          size="md"
          placeholder=""
        />
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-banner">
      <span>{{ error }}</span>
      <AppButton variant="ghost" size="sm" @click="fetchList">重试</AppButton>
    </div>

    <!-- Table (loading + empty handled internally) -->
    <DataTable
      :columns="columns"
      :data="list"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      empty-text="暂无公告，点击「新建公告」创建第一条"
      @update:page="page = $event"
    >
      <template #cell-title="{ row }">
        <span class="cell-title">{{
          (row as AdminAnnouncementBrief).title
        }}</span>
        <span
          v-if="(row as AdminAnnouncementBrief).is_important"
          class="badge badge--important"
          >重要</span
        >
      </template>

      <template #cell-type="{ row }">
        <span
          class="badge"
          :class="
            (row as AdminAnnouncementBrief).type === 'survey'
              ? 'badge--survey'
              : 'badge--plain'
          "
        >
          {{ typeLabel((row as AdminAnnouncementBrief).type) }}
        </span>
      </template>

      <template #cell-status="{ row }">
        <span
          class="status-badge"
          :class="`status-badge--${(row as AdminAnnouncementBrief).status}`"
        >
          {{ statusLabel((row as AdminAnnouncementBrief).status) }}
        </span>
      </template>

      <template #cell-published_at="{ row }">
        <span class="text-muted">
          {{
            (row as AdminAnnouncementBrief).published_at
              ? formatDate(
                  (row as AdminAnnouncementBrief).published_at as string,
                )
              : "—"
          }}
        </span>
      </template>

      <template #cell-read_rate="{ row }">
        <span class="text-muted">{{
          readRateText(row as AdminAnnouncementBrief)
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton
            size="sm"
            variant="secondary"
            @click.stop="goEdit((row as AdminAnnouncementBrief).id)"
          >
            编辑
          </AppButton>
          <AppButton
            v-if="(row as AdminAnnouncementBrief).status === 'draft'"
            size="sm"
            variant="primary"
            :disabled="saving"
            @click.stop="handlePublish(row as AdminAnnouncementBrief)"
          >
            发布
          </AppButton>
          <AppButton
            v-if="(row as AdminAnnouncementBrief).status === 'published'"
            size="sm"
            variant="secondary"
            :disabled="saving"
            @click.stop="handleArchive(row as AdminAnnouncementBrief)"
          >
            归档
          </AppButton>
          <AppButton
            size="sm"
            variant="ghost"
            @click.stop="goStats((row as AdminAnnouncementBrief).id)"
          >
            <BarChart3 :size="14" /> 统计
          </AppButton>
          <AppButton
            size="sm"
            variant="danger"
            :disabled="saving"
            @click.stop="handleDelete(row as AdminAnnouncementBrief)"
          >
            删除
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Empty CTA -->
    <div v-if="isEmpty" class="empty-cta">
      <p class="empty-cta__text">还没有任何公告</p>
      <AppButton variant="primary" @click="goNew">+ 新建第一条公告</AppButton>
    </div>

    <!-- Confirm modal (archive / delete — always danger) -->
    <ConfirmModal
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmText"
      cancel-text="取消"
      :danger="true"
      @confirm="executeConfirm"
      @cancel="cancelConfirm"
    />
  </div>
</template>

<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.page-breadcrumb {
  font-family: var(--font-label);
  font-size: var(--text-xs);
  color: var(--on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-1);
}

.page-title {
  font-family: var(--font-headline);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--on-surface);
  margin: 0;
}

.filters {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.filter-select {
  min-width: 140px;
}

.filter-select :deep(.app-select-wrapper) {
  width: 100%;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: var(--text-sm);
}

.cell-title {
  color: var(--on-surface);
  font-weight: 500;
}

.row-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
  flex-wrap: wrap;
}

.text-muted {
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  margin-left: var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.badge--important {
  background: var(--warning-soft);
  color: var(--warning);
}

.badge--survey {
  background: var(--success-soft);
  color: var(--success);
  margin-left: 0;
}

.badge--plain {
  background: var(--surface-high);
  color: var(--on-surface-variant);
  margin-left: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.status-badge::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-badge--draft {
  color: var(--on-surface-variant);
}

.status-badge--published {
  color: var(--success);
}

.status-badge--archived {
  color: var(--warning);
}

.empty-cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-6);
}

.empty-cta__text {
  font-size: var(--text-sm);
  color: var(--on-surface-variant);
}
</style>
