<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useComplianceRuleStore } from "@/stores/complianceRule";
import type { ComplianceRule } from "@/types/compliance";
import { RULE_TYPE_LABELS } from "@/types/compliance";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";

const router = useRouter();
const store = useComplianceRuleStore();
const toast = useToast();

// ---------- Local state ----------
const searchTerm = ref("");
const currentPage = ref(1);

// ---------- Confirm modal ----------
const confirmVisible = ref(false);
const pendingRule = ref<ComplianceRule | null>(null);
const deleting = ref(false);

// ---------- DataTable columns ----------
const columns: Column[] = [
  { key: "id", title: "ID", width: "70px" },
  { key: "parent_user_id", title: "父账户 ID", width: "110px" },
  { key: "rule_type", title: "规则类型", width: "130px" },
  { key: "pattern", title: "规则内容", align: "left" },
  { key: "is_active", title: "状态", width: "80px" },
  { key: "updated_at", title: "更新时间", width: "160px" },
  { key: "actions", title: "操作", width: "130px" },
];

// ---------- Client-side filtered list ----------
const filteredRules = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return store.rules;
  return store.rules.filter(
    (r) =>
      r.pattern.toLowerCase().includes(term) ||
      String(r.parent_user_id).includes(term),
  );
});

// ---------- Data loading ----------
async function fetchList() {
  try {
    await store.fetchList({ page: currentPage.value, page_size: 50 });
  } catch {
    // error already stored in store.error
  }
}

onMounted(fetchList);

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchList();
}

// ---------- Navigation ----------
function goNew() {
  router.push("/compliance-rules/new");
}

function goEdit(id: number) {
  router.push(`/compliance-rules/${id}`);
}

// ---------- Delete flow ----------
function confirmDelete(rule: ComplianceRule) {
  pendingRule.value = rule;
  confirmVisible.value = true;
}

async function executeDelete() {
  if (!pendingRule.value || deleting.value) return;
  deleting.value = true;
  try {
    await store.remove(pendingRule.value.id);
    toast.success("规则已删除");
  } catch (e: unknown) {
    toast.error((e as Error).message || "删除失败");
  } finally {
    deleting.value = false;
    confirmVisible.value = false;
    pendingRule.value = null;
  }
}

function cancelDelete() {
  confirmVisible.value = false;
  pendingRule.value = null;
}

// ---------- Helpers ----------
function truncatePattern(pattern: string, max = 50): string {
  if (pattern.length <= max) return pattern;
  return pattern.slice(0, max) + "…";
}
</script>

<template>
  <div class="rule-list">
    <!-- Top bar -->
    <div class="rule-list__header">
      <AppInput
        v-model="searchTerm"
        placeholder="搜索规则内容或父账户 ID"
        class="rule-list__search"
      />
      <div class="rule-list__header-actions">
        <AppButton variant="primary" @click="goNew"> + 新增规则 </AppButton>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="store.error" class="rule-list__error-banner">
      <span>{{ store.error }}</span>
      <AppButton variant="ghost" size="sm" @click="fetchList">重试</AppButton>
    </div>

    <!-- DataTable handles loading skeleton + empty state internally -->
    <DataTable
      :columns="columns"
      :data="filteredRules"
      :loading="store.loading"
      :total="store.total"
      :page="currentPage"
      :page-size="50"
      empty-text="暂无合规规则，点击 + 新增规则"
      @update:page="handlePageChange"
    >
      <!-- rule_type cell -->
      <template #cell-rule_type="{ value }">
        <span class="rule-type-badge">
          {{
            RULE_TYPE_LABELS[value as keyof typeof RULE_TYPE_LABELS] ?? value
          }}
        </span>
      </template>

      <!-- pattern cell — truncated -->
      <template #cell-pattern="{ value }">
        <span :title="value as string" class="rule-pattern">
          {{ truncatePattern(value as string) }}
        </span>
      </template>

      <!-- is_active cell -->
      <template #cell-is_active="{ value }">
        <span
          class="status-dot"
          :class="value ? 'status-dot--active' : 'status-dot--inactive'"
        >
          {{ value ? "启用" : "停用" }}
        </span>
      </template>

      <!-- updated_at cell -->
      <template #cell-updated_at="{ value }">
        {{ formatDate(value as string) }}
      </template>

      <!-- Actions cell -->
      <template #cell-actions="{ row }">
        <div class="rule-list__row-actions">
          <AppButton size="sm" variant="secondary" @click="goEdit(row.id)">
            编辑
          </AppButton>
          <AppButton size="sm" variant="danger" @click="confirmDelete(row)">
            删除
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Empty state CTA (shown when not loading, no error, and store is empty) -->
    <div
      v-if="!store.loading && !store.error && store.isEmpty"
      class="rule-list__empty-cta"
    >
      <p class="empty-cta__text">还没有任何合规规则</p>
      <AppButton variant="primary" @click="goNew">+ 新增第一条规则</AppButton>
    </div>

    <!-- Confirm modal for delete -->
    <ConfirmModal
      :visible="confirmVisible"
      title="确认删除规则"
      :message="`确认删除规则 #${pendingRule?.id}？删除后立即失效。`"
      confirm-text="确认删除"
      cancel-text="取消"
      :danger="true"
      @confirm="executeDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
.rule-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}

.rule-list__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.rule-list__search {
  flex: 1;
  min-width: 200px;
  max-width: 360px;
}

.rule-list__header-actions {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
}

.rule-list__error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--danger-surface, #fef2f2);
  border: 1px solid var(--danger-border, #fca5a5);
  border-radius: var(--radius-sm);
  color: var(--danger, #dc2626);
  font-size: var(--text-sm);
}

.rule-list__row-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: center;
}

.rule-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  background: var(--surface-high);
  color: var(--on-surface-variant);
  white-space: nowrap;
}

.rule-pattern {
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  color: var(--on-surface);
}

.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.status-dot::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot--active {
  color: var(--success, #16a34a);
}

.status-dot--active::before {
  background: var(--success, #16a34a);
}

.status-dot--inactive {
  color: var(--on-surface-variant);
}

.status-dot--inactive::before {
  background: var(--on-surface-variant);
}

.rule-list__empty-cta {
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
