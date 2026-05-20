<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import {
  LayoutDashboard,
  Users,
  FileText,
  PlayCircle,
  BarChart3,
  Receipt,
  Settings,
  TrendingUp,
  ArrowUpDown,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Coins,
  ShoppingCart,
  Layers,
  ListChecks,
  ScrollText,
  Server,
  Sigma,
  Landmark,
} from "lucide-vue-next";

const props = defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{ "update:collapsed": [value: boolean] }>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

function toggleCollapsed() {
  const newVal = !props.collapsed;
  emit("update:collapsed", newVal);
  localStorage.setItem("sidebar_collapsed", String(newVal));
}

onMounted(() => {
  if (window.innerWidth < 768 && !props.collapsed) {
    emit("update:collapsed", true);
    localStorage.setItem("sidebar_collapsed", "true");
  }
});

const navItems = [
  { name: "dashboard", label: "仪表盘", icon: LayoutDashboard, path: "/" },
  { name: "users", label: "用户管理", icon: Users, path: "/users" },
  { name: "templates", label: "SOP模板", icon: FileText, path: "/templates" },
  { name: "runs", label: "运行监控", icon: PlayCircle, path: "/runs" },
  {
    name: "billing-overview",
    label: "用量概览",
    icon: BarChart3,
    path: "/billing",
  },
  {
    name: "billing-records",
    label: "用量明细",
    icon: Receipt,
    path: "/billing/records",
  },
  {
    name: "billing-analytics",
    label: "消费分析",
    icon: TrendingUp,
    path: "/billing/analytics",
  },
  {
    name: "billing-tier-changes",
    label: "升级记录",
    icon: ArrowUpDown,
    path: "/billing/tier-changes",
  },
  {
    name: "billing-pricing",
    label: "定价管理",
    icon: Settings,
    path: "/billing/pricing",
  },
  // Q3: credits-system B2B 月度结算报表（运营月末对账用）
  // Path must align with router/index.ts (router's parent route is "/" not "/admin").
  // Earlier "/admin/b2b-billing" produced 404 — fixed in b2b-billing-rules-rewrite hotfix.
  {
    name: "B2BBillingReport",
    label: "B2B 月度结算",
    icon: Landmark,
    path: "/b2b-billing",
  },
  { name: "credits", label: "额度管理", icon: Coins, path: "/credits" },
  {
    name: "credits-user-types",
    label: "用户类型倍率",
    icon: Sigma,
    path: "/credits/user-types",
  },
  { name: "orders", label: "订单管理", icon: ShoppingCart, path: "/orders" },
  {
    name: "AIServices",
    label: "AI 服务",
    icon: Layers,
    path: "/ai-services",
  },
  {
    name: "AITasks",
    label: "任务配置",
    icon: ListChecks,
    path: "/ai-tasks",
  },
  {
    name: "AIAuditLogs",
    label: "AI 审计日志",
    icon: ScrollText,
    path: "/ai-audit-logs",
  },
  {
    name: "AIProvidersList",
    label: "AI 供应商",
    icon: Server,
    path: "/ai-providers",
  },
  // F.4: R2 estimation coefficient management (under AI Services group)
  {
    name: "EstimationCoefficients",
    label: "估算系数",
    icon: Sigma,
    path: "/ai-services/coefficients",
  },
];

function isActive(item: (typeof navItems)[0]) {
  if (item.path === "/") return route.path === "/";
  // 如果存在更具体的子路由匹配，当前项不应高亮
  const hasMoreSpecific = navItems.some(
    (other) =>
      other.path !== item.path &&
      other.path.startsWith(item.path) &&
      route.path.startsWith(other.path),
  );
  if (hasMoreSpecific) return false;
  return route.path.startsWith(item.path);
}

function navigate(path: string) {
  router.push(path);
}

function handleLogout() {
  authStore.logout();
  router.push("/login");
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
      <button
        class="sidebar__toggle"
        aria-label="切换侧边栏"
        @click="toggleCollapsed()"
      >
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
          <span v-if="!collapsed" class="nav-item__label">{{
            item.label
          }}</span>
        </Transition>
      </button>
    </nav>

    <div class="sidebar__footer">
      <div v-if="!collapsed" class="sidebar__user">
        <div class="user-avatar">
          {{ authStore.user?.nickname?.charAt(0) || "A" }}
        </div>
        <span class="user-name">{{
          authStore.user?.nickname || "管理员"
        }}</span>
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
  background: var(--bg);
  border-right: 1px solid var(--outline-variant);
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
  color: var(--on-primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--text-lg);
  font-family: var(--font-headline);
  flex-shrink: 0;
}

.logo-text {
  color: var(--on-background);
  font-family: var(--font-headline);
  font-size: var(--text-base);
  font-weight: 700;
  white-space: nowrap;
}

.sidebar__toggle {
  color: var(--on-surface-variant);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.sidebar__toggle:hover {
  background: var(--surface-high);
}

.sidebar--collapsed .sidebar__header {
  justify-content: center;
}

.sidebar--collapsed .sidebar__toggle {
  position: static;
}

.sidebar__nav {
  flex: 1;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--on-surface-variant);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}

.nav-item:hover {
  background: var(--surface-high);
  transform: translateX(1px);
}

.nav-item--active {
  background: var(--surface-lowest);
  color: var(--tertiary);
  border-right: 2px solid var(--tertiary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.nav-item__icon {
  flex-shrink: 0;
  color: inherit;
}

.nav-item__label {
  font-size: 13px;
  font-weight: 500;
}

.nav-item--active .nav-item__label {
  font-weight: 600;
}

.sidebar__footer {
  padding: var(--space-3);
  border-top: 1px solid var(--outline-variant);
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
  color: var(--on-primary);
  border-radius: 50%;
  border: 1px solid var(--outline-variant);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: 600;
  flex-shrink: 0;
}

.user-name {
  color: var(--on-background);
  font-size: var(--text-sm);
  white-space: nowrap;
}

.nav-item--logout {
  color: var(--on-surface-variant);
}

.nav-item--logout:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

/* Collapsed state icon colors */
.sidebar--collapsed .nav-item__icon {
  color: var(--on-surface-variant);
}

.sidebar--collapsed .nav-item--active .nav-item__icon {
  color: var(--tertiary);
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
