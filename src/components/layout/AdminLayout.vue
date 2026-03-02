<script setup lang="ts">
import { ref } from 'vue'
import AdminSidebar from './AdminSidebar.vue'

const collapsed = ref(localStorage.getItem('sidebar_collapsed') === 'true')
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar v-model:collapsed="collapsed" />
    <main
      class="admin-main"
      :style="{ marginLeft: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }"
    >
      <RouterView v-slot="{ Component }">
        <Transition name="slide" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.admin-main {
  flex: 1;
  background: var(--bg);
  min-height: 100vh;
  transition: margin-left var(--transition-slow);
}

@media (max-width: 768px) {
  .admin-main {
    margin-left: var(--sidebar-collapsed-width) !important;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
