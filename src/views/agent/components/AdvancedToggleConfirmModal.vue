<script setup lang="ts">
import ConfirmModal from "@/components/common/ConfirmModal.vue";

interface Props {
  visible: boolean;
}

defineProps<Props>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <ConfirmModal
    :visible="visible"
    title="⚠️ 切换到高级模式"
    confirm-text="切换到高级模式"
    cancel-text="取消"
    :danger="true"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  >
    <div class="advanced-toggle-body">
      <p>高级模式允许你直接编写系统提示词，适合有 AI 使用经验的配置者。</p>
      <p><strong>注意</strong>：</p>
      <ul>
        <li>切换后，当前问卷内容会转换为 Prompt 文本</li>
        <li><strong>无法切回问卷模式</strong>（问卷结构会丢失）</li>
        <li>写错了可以从历史版本回滚</li>
      </ul>
    </div>
  </ConfirmModal>
</template>

<style scoped>
.advanced-toggle-body {
  font-size: var(--text-sm);
}

.advanced-toggle-body ul {
  margin: var(--space-2) 0 0 var(--space-5);
}

.advanced-toggle-body li {
  margin-bottom: var(--space-2);
}
</style>
