<script setup lang="ts">
import { ref } from "vue";
import DataTable, { type Column } from "@/components/common/DataTable.vue";
import NoticeBanner from "@/components/common/NoticeBanner.vue";

interface SessionRow {
  id: number;
  student: string;
  agentName: string;
  startedAt: string;
  duration: string;
  creditsUsed: number;
  status: string;
}

// v1 永远返回空数组 — 真实数据源 TODO(#14): wire to GET /v1/agent/sessions/active
const sessions = ref<SessionRow[]>([]);

const columns: Column[] = [
  { key: "student", title: "学员", width: "120px" },
  { key: "agentName", title: "Agent", width: "180px" },
  { key: "startedAt", title: "开始时间", width: "120px" },
  { key: "duration", title: "已用时", width: "100px" },
  { key: "creditsUsed", title: "已用积分", width: "120px", align: "right" },
  { key: "status", title: "状态", width: "100px" },
  { key: "actions", title: "操作", width: "200px" },
];
</script>

<template>
  <div class="agent-monitoring">
    <NoticeBanner type="info">
      实时监控功能即将上线（v1 不联机）。当前页面是 UI 预览。
    </NoticeBanner>

    <header class="page-header">
      <h1>Agent 监控</h1>
      <p class="page-subtitle">实时查看学员与 AI 助手的会话</p>
    </header>

    <DataTable
      :columns="columns"
      :data="sessions"
      :loading="false"
      :total="0"
      empty-text="v1 暂不联机，等待后端接入"
    />
  </div>
</template>

<style scoped>
.agent-monitoring {
  padding: var(--space-6);
}

.page-header {
  margin: var(--space-6) 0;
}

.page-header h1 {
  font-size: var(--text-xl);
  font-weight: 700;
}

.page-subtitle {
  color: var(--on-surface-variant);
  margin-top: var(--space-2);
}
</style>
