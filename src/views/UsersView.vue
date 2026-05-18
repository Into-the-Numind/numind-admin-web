<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import {
  getUsersApi,
  resetPasswordApi,
  type User,
  type UserListParams,
} from "@/api/users";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppInput from "@/components/common/AppInput.vue";
import ConfirmModal from "@/components/common/ConfirmModal.vue";
import { Search, KeyRound } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { formatDate } from "@/utils/format";

const toast = useToast();
const users = ref<User[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const search = ref("");
const loading = ref(false);
const error = ref("");
const processing = ref(false);

// Modal states
const confirmVisible = ref(false);
const confirmTitle = ref("");
const confirmMessage = ref("");
const confirmDanger = ref(false);
const pendingAction = ref<(() => Promise<void>) | null>(null);

const passwordResult = ref("");
const passwordModalVisible = ref(false);

const columns: Column[] = [
  { key: "id", title: "ID", width: "60px" },
  { key: "username", title: "用户名", width: "120px" },
  { key: "nickname", title: "昵称", width: "120px" },
  { key: "total_sop_runs", title: "SOP次数", width: "90px", align: "right" },
  { key: "created_at", title: "注册时间", width: "140px" },
  { key: "actions", title: "操作", width: "180px" },
];

async function fetchUsers() {
  loading.value = true;
  error.value = "";
  try {
    const params: UserListParams = {
      offset: (page.value - 1) * pageSize,
      limit: pageSize,
    };
    if (search.value) params.search = search.value;
    const res = await getUsersApi(params);
    users.value = res.users;
    total.value = res.total;
  } catch (e) {
    error.value = (e as Error).message || "加载用户列表失败";
  } finally {
    loading.value = false;
  }
}

function openConfirm(
  title: string,
  message: string,
  danger: boolean,
  action: () => Promise<void>,
) {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmDanger.value = danger;
  pendingAction.value = action;
  confirmVisible.value = true;
}

async function executeConfirm() {
  if (processing.value) return;
  processing.value = true;
  try {
    if (pendingAction.value) {
      await pendingAction.value();
      pendingAction.value = null;
    }
    confirmVisible.value = false;
    await fetchUsers();
  } catch (e) {
    toast.error((e as Error).message || "操作失败");
  } finally {
    processing.value = false;
  }
}

function handleResetPassword(user: User) {
  openConfirm(
    "重置密码",
    `确定要重置用户 "${user.nickname}" 的密码吗？`,
    true,
    async () => {
      const res = await resetPasswordApi(user.id);
      passwordResult.value = res.new_password;
      passwordModalVisible.value = true;
    },
  );
}

let searchTimer: ReturnType<typeof setTimeout>;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    fetchUsers();
  }, 400);
});

watch(page, fetchUsers);

onMounted(fetchUsers);
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <p class="page-breadcrumb">Users / Management</p>
        <h1 class="page-title">用户管理</h1>
      </div>
    </div>

    <div v-if="error" class="error-alert">{{ error }}</div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-input">
        <AppInput
          v-model="search"
          placeholder="搜索用户名、昵称、手机号..."
          size="md"
        >
          <template #prefix>
            <Search :size="16" style="color: var(--gray-400); flex-shrink: 0" />
          </template>
        </AppInput>
      </div>
    </div>

    <!-- Table -->
    <DataTable
      :columns="columns"
      :data="users"
      :loading="loading"
      :total="total"
      :page="page"
      :page-size="pageSize"
      @update:page="page = $event"
    >
      <template #cell-created_at="{ row }">
        <span class="text-muted">{{
          formatDate(String((row as User).created_at))
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="action-buttons">
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="processing"
            @click.stop="handleResetPassword(row as User)"
          >
            <KeyRound :size="14" />
            重置
          </AppButton>
        </div>
      </template>
    </DataTable>

    <!-- Confirm Modal -->
    <ConfirmModal
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      @confirm="executeConfirm"
      @cancel="confirmVisible = false"
    />

    <!-- Password Result Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="passwordModalVisible"
          class="modal-overlay"
          @click.self="passwordModalVisible = false"
          @keydown.esc="passwordModalVisible = false"
        >
          <div class="modal-card" role="dialog" aria-modal="true">
            <h3 class="modal-title">密码已重置</h3>
            <p class="modal-message">新密码如下，请妥善保管：</p>
            <div class="password-display">{{ passwordResult }}</div>
            <div class="modal-actions">
              <AppButton variant="primary" @click="passwordModalVisible = false"
                >确定</AppButton
              >
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.filter-input {
  flex: 1;
  min-width: 200px;
  max-width: 360px;
}

.action-buttons {
  display: flex;
  gap: var(--space-1);
}

.text-muted {
  color: var(--on-surface-variant);
  font-size: var(--text-xs);
}

.password-display {
  background: var(--surface-low);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  text-align: center;
  letter-spacing: 0.1em;
  color: var(--on-surface);
  user-select: all;
}
</style>
