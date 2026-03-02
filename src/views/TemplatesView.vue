<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getTemplatesApi, deleteTemplateApi, updateTemplateApi, type SopTemplate } from '@/api/templates'
import AppButton from '@/components/common/AppButton.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/format'
import { templateStatusLabels } from '@/constants/statusMaps'

const router = useRouter()
const toast = useToast()
const templates = ref<SopTemplate[]>([])
const total = ref(0)
const loading = ref(false)
const offset = ref(0)
const limit = 20
const error = ref('')
const processing = ref(false)

const deleteModalVisible = ref(false)
const deleteTarget = ref<SopTemplate | null>(null)

async function fetchTemplates() {
  loading.value = true
  error.value = ''
  try {
    const res = await getTemplatesApi(offset.value, limit)
    templates.value = res.templates
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message || '加载模板列表失败'
  } finally {
    loading.value = false
  }
}

function editTemplate(id: number) {
  router.push(`/templates/${id}/edit`)
}

function createTemplate() {
  router.push('/templates/new')
}

function confirmDelete(tpl: SopTemplate) {
  deleteTarget.value = tpl
  deleteModalVisible.value = true
}

async function executeDelete() {
  if (!deleteTarget.value || processing.value) return
  processing.value = true
  try {
    await deleteTemplateApi(deleteTarget.value.id)
    deleteModalVisible.value = false
    deleteTarget.value = null
    toast.success('模板已删除')
    await fetchTemplates()
  } catch (e) {
    toast.error((e as Error).message || '删除失败')
  } finally {
    processing.value = false
  }
}

async function toggleStatus(tpl: SopTemplate) {
  if (processing.value) return
  processing.value = true
  try {
    const newStatus = tpl.status === 1 ? 0 : 1
    await updateTemplateApi(tpl.id, { status: newStatus })
    toast.success(newStatus === 1 ? '已启用' : '已禁用')
    await fetchTemplates()
  } catch (e) {
    toast.error((e as Error).message || '操作失败')
  } finally {
    processing.value = false
  }
}

onMounted(fetchTemplates)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <h1 class="page-title">SOP模板管理</h1>
      <AppButton variant="primary" @click="createTemplate">
        <Plus :size="16" />
        新建模板
      </AppButton>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="template-grid">
      <div v-for="i in 4" :key="i" class="template-card template-card--skeleton">
        <div class="skeleton" style="width: 60%; height: 20px; margin-bottom: 12px;" />
        <div class="skeleton" style="width: 100%; height: 14px; margin-bottom: 8px;" />
        <div class="skeleton" style="width: 40%; height: 14px;" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="templates.length === 0 && !error" class="card">
      <div class="empty-state">
        <p>暂无模板，点击上方按钮创建</p>
      </div>
    </div>

    <!-- Template cards -->
    <div v-else class="template-grid">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="template-card card"
        @click="editTemplate(tpl.id)"
      >
        <div class="template-card__header">
          <h3 class="template-card__name">{{ tpl.name }}</h3>
          <StatusBadge :status="String(tpl.status)" :map="templateStatusLabels" />
        </div>
        <p class="template-card__desc">{{ tpl.description || '暂无描述' }}</p>
        <div class="template-card__footer">
          <span class="template-card__date">{{ formatDate(tpl.updated_at || tpl.created_at) }}</span>
          <div class="template-card__actions" @click.stop>
            <button class="icon-btn" title="编辑" aria-label="编辑模板" @click="editTemplate(tpl.id)">
              <Pencil :size="15" />
            </button>
            <button
              class="icon-btn"
              :title="tpl.status === 1 ? '禁用' : '启用'"
              :aria-label="tpl.status === 1 ? '禁用模板' : '启用模板'"
              :disabled="processing"
              @click="toggleStatus(tpl)"
            >
              <ToggleRight v-if="tpl.status === 1" :size="15" />
              <ToggleLeft v-else :size="15" />
            </button>
            <button
              class="icon-btn icon-btn--danger"
              title="删除"
              aria-label="删除模板"
              :disabled="processing"
              @click="confirmDelete(tpl)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination info -->
    <div v-if="total > limit" class="pagination-simple">
      <span>共 {{ total }} 个模板</span>
      <div class="pagination-simple__btns">
        <AppButton
          size="sm"
          variant="secondary"
          :disabled="offset === 0"
          @click="offset = Math.max(0, offset - limit); fetchTemplates()"
        >
          上一页
        </AppButton>
        <AppButton
          size="sm"
          variant="secondary"
          :disabled="offset + limit >= total"
          @click="offset += limit; fetchTemplates()"
        >
          下一页
        </AppButton>
      </div>
    </div>

    <ConfirmModal
      :visible="deleteModalVisible"
      title="删除模板"
      :message="'确定要删除模板「' + (deleteTarget?.name || '') + '」吗？此操作不可恢复。'"
      confirm-text="删除"
      :danger="true"
      @confirm="executeDelete"
      @cancel="deleteModalVisible = false"
    />
  </div>
</template>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--space-5);
}

@media (max-width: 640px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}

.template-card {
  padding: var(--space-5);
  cursor: pointer;
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}

.template-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.template-card--skeleton {
  min-height: 140px;
}

.template-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.template-card__name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card__desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: var(--space-4);
  min-height: 42px;
}

.template-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.template-card__date {
  font-size: var(--text-xs);
  color: var(--gray-400);
}

.template-card__actions {
  display: flex;
  gap: var(--space-1);
}

.skeleton {
  background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%);
  background-size: 200% 100%;
  border-radius: var(--radius-sm);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.pagination-simple {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pagination-simple__btns {
  display: flex;
  gap: var(--space-2);
}
</style>
