<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTemplateApi, createTemplateApi, updateTemplateApi,
  getTemplateNodesApi, createNodeApi, updateNodeApi, deleteNodeApi,
  type SopTemplate, type SopNode
} from '@/api/templates'
import AppButton from '@/components/common/AppButton.vue'
import AppInput from '@/components/common/AppInput.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

interface EditingNode {
  id: number
  template_id: number
  name: string
  base_url: string
  model_name: string
  api_key: string
  timeout_seconds: number
  sort: number
  prompt: string
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const isNew = computed(() => route.name === 'template-new')
const templateId = computed(() => Number(route.params.id))

const loading = ref(false)
const saving = ref(false)
const error = ref('')

// Template form
const name = ref('')
const description = ref('')
const prompt = ref('')
const status = ref(1)
const nameError = ref('')

// Nodes
const nodes = ref<SopNode[]>([])
const nodesLoading = ref(false)

// Node editor modal
const nodeModalVisible = ref(false)
const editingNode = ref<EditingNode>(createEmptyNode())
const isNewNode = ref(false)
const nodeNameError = ref('')
const nodeSaving = ref(false)
const changeApiKey = ref(false)

// Delete confirm
const deleteModalVisible = ref(false)
const deleteNodeId = ref(0)
const deleteProcessing = ref(false)

function createEmptyNode(): EditingNode {
  return {
    id: 0,
    template_id: 0,
    name: '',
    base_url: '',
    model_name: '',
    api_key: '',
    timeout_seconds: 60,
    sort: 1,
    prompt: ''
  }
}

function maskApiKey(key?: string): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

async function loadTemplate() {
  if (isNew.value) return
  loading.value = true
  error.value = ''
  try {
    const tpl = await getTemplateApi(templateId.value)
    name.value = tpl.name
    description.value = tpl.description
    prompt.value = tpl.prompt
    status.value = tpl.status
    await loadNodes()
  } catch (e) {
    error.value = (e as Error).message || '加载模板失败'
  } finally {
    loading.value = false
  }
}

async function loadNodes() {
  if (isNew.value) return
  nodesLoading.value = true
  try {
    const res = await getTemplateNodesApi(templateId.value)
    nodes.value = res.nodes.sort((a, b) => a.sort - b.sort)
  } catch (e) {
    toast.error((e as Error).message || '加载节点列表失败')
  } finally {
    nodesLoading.value = false
  }
}

async function saveTemplate() {
  nameError.value = ''
  if (!name.value.trim()) {
    nameError.value = '请输入模板名称'
    return
  }
  saving.value = true
  try {
    if (isNew.value) {
      const created = await createTemplateApi({
        name: name.value,
        description: description.value,
        prompt: prompt.value
      })
      toast.success('模板创建成功')
      router.replace(`/templates/${(created as SopTemplate).id}/edit`)
    } else {
      await updateTemplateApi(templateId.value, {
        name: name.value,
        description: description.value,
        prompt: prompt.value,
        status: status.value
      })
      toast.success('模板已保存')
    }
  } catch (e) {
    toast.error((e as Error).message || '保存失败')
  } finally {
    saving.value = false
  }
}

function openNodeModal(node?: SopNode) {
  nodeNameError.value = ''
  if (node) {
    isNewNode.value = false
    changeApiKey.value = false
    editingNode.value = {
      id: node.id,
      template_id: node.template_id,
      name: node.name,
      base_url: node.base_url,
      model_name: node.model_name,
      api_key: '',
      timeout_seconds: node.timeout_seconds,
      sort: node.sort,
      prompt: node.prompt
    }
  } else {
    isNewNode.value = true
    changeApiKey.value = true
    editingNode.value = {
      ...createEmptyNode(),
      template_id: templateId.value,
      sort: nodes.value.length + 1
    }
  }
  nodeModalVisible.value = true
}

async function saveNode() {
  nodeNameError.value = ''
  if (!editingNode.value.name.trim()) {
    nodeNameError.value = '请输入节点名称'
    return
  }
  if (nodeSaving.value) return
  nodeSaving.value = true
  try {
    if (isNewNode.value) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _, ...data } = editingNode.value
      await createNodeApi(data as Omit<SopNode, 'id' | 'status'>)
      toast.success('节点已添加')
    } else {
      const payload: Partial<SopNode> = {
        name: editingNode.value.name,
        base_url: editingNode.value.base_url,
        model_name: editingNode.value.model_name,
        timeout_seconds: editingNode.value.timeout_seconds,
        sort: editingNode.value.sort,
        prompt: editingNode.value.prompt
      }
      if (changeApiKey.value) {
        payload.api_key = editingNode.value.api_key
      }
      await updateNodeApi(editingNode.value.id, payload)
      toast.success('节点已保存')
    }
    nodeModalVisible.value = false
    await loadNodes()
  } catch (e) {
    toast.error((e as Error).message || '保存节点失败')
  } finally {
    nodeSaving.value = false
  }
}

function confirmDeleteNode(id: number) {
  deleteNodeId.value = id
  deleteModalVisible.value = true
}

async function executeDeleteNode() {
  if (deleteProcessing.value) return
  deleteProcessing.value = true
  try {
    await deleteNodeApi(deleteNodeId.value)
    deleteModalVisible.value = false
    toast.success('节点已删除')
    await loadNodes()
  } catch (e) {
    toast.error((e as Error).message || '删除节点失败')
  } finally {
    deleteProcessing.value = false
  }
}

onMounted(loadTemplate)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-left">
        <button class="back-btn" aria-label="返回模板列表" @click="router.push('/templates')">
          <ArrowLeft :size="20" />
        </button>
        <h1 class="page-title">{{ isNew ? '新建模板' : '编辑模板' }}</h1>
      </div>
      <AppButton variant="primary" :loading="saving" @click="saveTemplate">
        <Save :size="16" />
        保存
      </AppButton>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <div v-if="loading" class="loading-container">
      <div class="spinner" />
    </div>

    <template v-else>
      <!-- Template Info -->
      <div class="card card-body form-section">
        <h2 class="section-title">基本信息</h2>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">模板名称 <span class="required">*</span></label>
            <AppInput
              v-model="name"
              placeholder="输入模板名称"
              :error="nameError"
              @update:model-value="nameError = ''"
            />
          </div>
          <div class="form-group">
            <label class="form-label">状态</label>
            <div class="status-toggle">
              <button
                class="toggle-btn"
                :class="{ 'toggle-btn--active': status === 1 }"
                @click="status = 1"
              >启用</button>
              <button
                class="toggle-btn"
                :class="{ 'toggle-btn--active': status === 0 }"
                @click="status = 0"
              >禁用</button>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea
            v-model="description"
            class="form-textarea"
            placeholder="输入模板描述"
            rows="2"
          />
        </div>
        <div class="form-group">
          <label class="form-label">系统提示词</label>
          <textarea
            v-model="prompt"
            class="form-textarea form-textarea--code"
            placeholder="输入系统提示词"
            rows="4"
          />
        </div>
      </div>

      <!-- Nodes Section -->
      <div v-if="!isNew" class="card card-body form-section">
        <div class="section-header">
          <h2 class="section-title">节点列表</h2>
          <AppButton size="sm" variant="primary" @click="openNodeModal()">
            <Plus :size="14" />
            添加节点
          </AppButton>
        </div>

        <div v-if="nodesLoading" class="loading-container" style="padding: var(--space-6);">
          <div class="spinner" />
        </div>

        <div v-else-if="nodes.length === 0" class="empty-state">
          <p>暂无节点，点击上方按钮添加</p>
        </div>

        <div v-else class="nodes-list">
          <div v-for="node in nodes" :key="node.id" class="node-item">
            <div class="node-item__sort">{{ node.sort }}</div>
            <div class="node-item__info">
              <span class="node-item__name">{{ node.name }}</span>
              <span class="node-item__model">{{ node.model_name }}</span>
            </div>
            <div class="node-item__actions">
              <AppButton size="sm" variant="ghost" @click="openNodeModal(node)">编辑</AppButton>
              <button
                class="icon-btn icon-btn--danger"
                aria-label="删除节点"
                @click="confirmDeleteNode(node.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Node Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="nodeModalVisible"
          class="modal-overlay"
          @click.self="nodeModalVisible = false"
          @keydown.esc="nodeModalVisible = false"
        >
          <div class="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <h3 class="modal-title">{{ isNewNode ? '添加节点' : '编辑节点' }}</h3>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">节点名称 <span class="required">*</span></label>
                <AppInput
                  v-model="editingNode.name"
                  placeholder="节点名称"
                  :error="nodeNameError"
                  @update:model-value="nodeNameError = ''"
                />
              </div>
              <div class="form-group">
                <label class="form-label">排序</label>
                <AppInput v-model="(editingNode.sort as unknown as string)" type="number" placeholder="排序" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">模型接口地址</label>
              <AppInput v-model="editingNode.base_url" placeholder="https://api.example.com/v1" />
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">模型名称</label>
                <AppInput v-model="editingNode.model_name" placeholder="gpt-4" />
              </div>
              <div class="form-group">
                <label class="form-label">超时(秒)</label>
                <AppInput v-model="(editingNode.timeout_seconds as unknown as string)" type="number" placeholder="60" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <template v-if="!isNewNode && !changeApiKey">
                <div class="api-key-masked">
                  <span class="api-key-display">{{ maskApiKey(editingNode.api_key) || '已配置' }}</span>
                  <AppButton size="sm" variant="ghost" @click="changeApiKey = true; editingNode.api_key = ''">
                    修改密钥
                  </AppButton>
                </div>
              </template>
              <template v-else>
                <AppInput v-model="editingNode.api_key" type="password" placeholder="sk-..." />
                <button
                  v-if="!isNewNode"
                  class="cancel-change-link"
                  @click="changeApiKey = false; editingNode.api_key = ''"
                >
                  取消修改
                </button>
              </template>
            </div>
            <div class="form-group">
              <label class="form-label">提示词</label>
              <textarea
                v-model="editingNode.prompt"
                class="form-textarea form-textarea--code"
                placeholder="输入节点提示词"
                rows="4"
              />
            </div>
            <div class="modal-actions">
              <AppButton variant="secondary" @click="nodeModalVisible = false">取消</AppButton>
              <AppButton variant="primary" :loading="nodeSaving" @click="saveNode">保存</AppButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ConfirmModal
      :visible="deleteModalVisible"
      title="删除节点"
      message="确定要删除此节点吗？此操作不可恢复。"
      confirm-text="删除"
      :danger="true"
      @confirm="executeDeleteNode"
      @cancel="deleteModalVisible = false"
    />
  </div>
</template>

<style scoped>
.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--gray-100);
  color: var(--text);
}

.form-section {
  margin-bottom: var(--space-6);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-4);
}

.section-header .section-title {
  margin-bottom: 0;
}

.status-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.toggle-btn {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  background: var(--surface);
  transition: all var(--transition-fast);
  border: none;
  cursor: pointer;
}

.toggle-btn:first-child {
  border-right: 1px solid var(--border);
}

.toggle-btn--active {
  background: var(--primary);
  color: #fff;
}

.nodes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.node-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--gray-50);
  transition: background var(--transition-fast);
}

.node-item:hover {
  background: var(--surface);
}

.node-item__sort {
  width: 28px;
  height: 28px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.node-item__info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.node-item__name {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.node-item__model {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.node-item__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
}

.api-key-masked {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.api-key-display {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  background: var(--gray-50);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.cancel-change-link {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  cursor: pointer;
  margin-top: var(--space-1);
}

.cancel-change-link:hover {
  color: var(--primary);
}
</style>
