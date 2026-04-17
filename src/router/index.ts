import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { guest: true, title: "登录" },
    },
    {
      path: "/",
      component: () => import("@/components/layout/AdminLayout.vue"),
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import("@/views/DashboardView.vue"),
          meta: { title: "仪表盘" },
        },
        {
          path: "users",
          name: "users",
          component: () => import("@/views/UsersView.vue"),
          meta: { title: "用户管理" },
        },
        {
          path: "templates",
          name: "templates",
          component: () => import("@/views/TemplatesView.vue"),
          meta: { title: "SOP模板管理" },
        },
        {
          path: "templates/:id/edit",
          name: "template-edit",
          component: () => import("@/views/TemplateEditView.vue"),
          meta: { title: "编辑模板" },
        },
        {
          path: "templates/new",
          name: "template-new",
          component: () => import("@/views/TemplateEditView.vue"),
          meta: { title: "新建模板" },
        },
        {
          path: "runs",
          name: "runs",
          component: () => import("@/views/RunsView.vue"),
          meta: { title: "运行监控" },
        },
        {
          path: "billing",
          name: "billing-overview",
          component: () => import("@/views/BillingOverviewView.vue"),
          meta: { title: "用量概览" },
        },
        {
          path: "billing/records",
          name: "billing-records",
          component: () => import("@/views/UsageRecordsView.vue"),
          meta: { title: "用量明细" },
        },
        {
          path: "billing/analytics",
          name: "billing-analytics",
          component: () => import("@/views/PricingAnalyticsView.vue"),
          meta: { title: "消费分析" },
        },
        {
          path: "billing/tier-changes",
          name: "billing-tier-changes",
          component: () => import("@/views/TierChangeLogsView.vue"),
          meta: { title: "客户升级记录" },
        },
        {
          path: "billing/pricing",
          name: "billing-pricing",
          component: () => import("@/views/PricingRulesView.vue"),
          meta: { title: "定价管理" },
        },
        {
          path: "credits",
          name: "credits",
          component: () => import("@/views/CreditUsersView.vue"),
          meta: { title: "额度管理" },
        },
        {
          path: "orders",
          name: "orders",
          component: () => import("@/views/OrdersView.vue"),
          meta: { title: "订单管理" },
        },
        {
          path: "ai-services",
          name: "AIServices",
          component: () => import("@/views/AIService/ServicesList.vue"),
          meta: { title: "AI 服务管理" },
        },
        {
          path: "ai-services/:id/edit",
          name: "AIServiceEdit",
          component: () => import("@/views/AIService/ServiceEdit.vue"),
          meta: { title: "编辑 AI 服务" },
        },
        {
          path: "ai-tasks",
          name: "AITasks",
          component: () => import("@/views/AIService/TasksList.vue"),
          meta: { title: "任务配置" },
        },
        {
          path: "ai-tasks/:id([^/]+)/edit",
          name: "AITaskEdit",
          component: () => import("@/views/AIService/TaskEdit.vue"),
          meta: { title: "编辑任务配置" },
        },
        {
          path: "ai-audit-logs",
          name: "AIAuditLogs",
          component: () => import("@/views/AIService/AuditLogs.vue"),
          meta: { title: "AI 审计日志" },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/views/NotFoundView.vue"),
      meta: { guest: true, title: "页面不存在" },
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (!to.meta.guest && !authStore.isLoggedIn) {
    return { name: "login" };
  }
  if (to.meta.guest && authStore.isLoggedIn && to.name === "login") {
    return { name: "dashboard" };
  }
  const title = to.meta.title as string | undefined;
  document.title = title ? `${title} - 莫小派管理` : "莫小派管理";
});

export default router;
