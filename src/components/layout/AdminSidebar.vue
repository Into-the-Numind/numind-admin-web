<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard,
  Users,
  FileText,
  PlayCircle,
  BarChart3,
  Receipt,
  Settings,
  TrendingUp,
  PanelLeftClose,
  PanelLeft,
  LogOut
} from 'lucide-vue-next'

const props = defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ 'update:collapsed': [value: boolean] }>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function toggleCollapsed() {
  const newVal = !props.collapsed
  emit('update:collapsed', newVal)
  localStorage.setItem('sidebar_collapsed', String(newVal))
}

onMounted(() => {
  if (window.innerWidth < 768 && !props.collapsed) {
    emit('update:collapsed', true)
    localStorage.setItem('sidebar_collapsed', 'true')
  }
})

const navItems = [
  { name: 'dashboard', label: '仪表盘', icon: LayoutDashboard, path: '/' },
  { name: 'users', label: '用户管理', icon: Users, path: '/users' },
  { name: 'templates', label: 'SOP模板', icon: FileText, path: '/templates' },
  { name: 'runs', label: '运行监控', icon: PlayCircle, path: '/runs' },
  { name: 'billing-overview', label: '用量概览', icon: BarChart3, path: '/billing' },
  { name: 'billing-records', label: '用量明细', icon: Receipt, path: '/billing/records' },
  { name: 'billing-analytics', label: '消费分析', icon: TrendingUp, path: '/billing/analytics' },
  { name: 'billing-pricing', label: '定价管理', icon: Settings, path: '/billing/pricing' }
]

function isActive(item: typeof navItems[0]) {
  if (item.path === '/') return route.path === '/'
  // 如果存在更具体的子路由匹配，当前项不应高亮
  const hasMoreSpecific = navItems.some(
    other => other.path !== item.path && other.path.startsWith(item.path) && route.path.startsWith(other.path)
  )
  if (hasMoreSpecific) return false
  return route.path.startsWith(item.path)
}

function navigate(path: string) {
  router.push(path)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': collapsed }">
    <div class="sidebar__header">
      <div class="sidebar__logo">
        <div class="logo-icon">N</div>
        <Transition name="fade">
          <span v-if="!collapsed" class="logo-text">莫小派管理</span>
        </Transition>
      </div>
      <button class="sidebar__toggle" aria-label="切换侧边栏" @click="toggleCollapsed()">
        <PanelLeftClose v-if="!collapsed" :size="18" />
        <PanelLeft v-else :size="18" />
      </button>
    </div>

    <nav class="sidebar__nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ 'nav-item--active': isActive(item) }"
        :title="collapsed ? item.label : undefined"
        @click="navigate(item.path)"
      >
        <component :is="item.icon" :size="20" class="nav-item__icon" />
        <Transition name="fade">
          <span v-if="!collapsed" class="nav-item__label">{{ item.label }}</span>
        </Transition>
      </button>
    </nav>

    <div class="sidebar__footer">
      <div v-if="!collapsed" class="sidebar__user">
        <div class="user-avatar">{{ authStore.user?.nickname?.charAt(0) || 'A' }}</div>
        <span class="user-name">{{ authStore.user?.nickname || '管理员' }}</span>
      </div>
      <button
        class="nav-item nav-item--logout"
        :title="collapsed ? '退出登录' : undefined"
        @click="handleLogout"
      >
        <LogOut :size="20" class="nav-item__icon" />
        <Transition name="fade">
          <span v-if="!collapsed" class="nav-item__label">退出登录</span>
        </Transition>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-slow);
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
  overflow: hidden;
}

.sidebar--collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  min-height: 64px;
}

.sidebar__logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  overflow: hidden;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: #fff;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--text-lg);
  flex-shrink: 0;
}

.logo-text {
  color: #fff;
  font-size: var(--text-base);
  font-weight: 600;
  white-space: nowrap;
}

.sidebar__toggle {
  color: var(--sidebar-text);
  opacity: 0.7;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.sidebar__toggle:hover {
  opacity: 1;
}

.sidebar--collapsed .sidebar__toggle {
  display: none;
}

.sidebar__nav {
  flex: 1;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--sidebar-text);
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--sidebar-hover);
  color: #fff;
}

.nav-item--active {
  background: var(--sidebar-active);
  color: #fff;
}

.nav-item__icon {
  flex-shrink: 0;
}

.nav-item__label {
  font-size: var(--text-sm);
  font-weight: 500;
}

.sidebar__footer {
  padding: var(--space-3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar__user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
  overflow: hidden;
}

.user-avatar {
  width: 32px;
  height: 32px;
  background: var(--primary);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
  flex-shrink: 0;
}

.user-name {
  color: var(--sidebar-text);
  font-size: var(--text-sm);
  white-space: nowrap;
}

.nav-item--logout {
  color: rgba(255, 255, 255, 0.5);
}

.nav-item--logout:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #FCA5A5;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
