<script setup lang="ts">
import { useRouter } from "vue-router";
import AppButton from "@/components/common/AppButton.vue";

const router = useRouter();
</script>

<template>
  <div class="not-found">
    <h1 class="not-found__code">404</h1>
    <p class="not-found__text">页面不存在</p>
    <AppButton variant="secondary" @click="router.push('/')"
      >返回首页</AppButton
    >
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: var(--space-4);
}

.not-found__code {
  font-family: var(--font-headline);
  font-size: 5rem;
  font-weight: 700;
  color: var(--on-surface-variant);
  line-height: 1;
}

.not-found__text {
  font-size: var(--text-lg);
  color: var(--on-surface-variant);
}
</style>
