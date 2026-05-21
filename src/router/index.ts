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
          path: "credits/user-types",
          name: "credits-user-types",
          component: () => import("@/views/CreditUserTypesView.vue"),
          meta: { title: "用户类型倍率" },
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
        {
          path: "ai-providers",
          name: "AIProvidersList",
          component: () => import("@/views/AIService/ProvidersList.vue"),
          meta: { title: "AI 供应商管理" },
        },
        {
          path: "ai-providers/new",
          name: "AIProviderCreate",
          component: () => import("@/views/AIService/ProviderEdit.vue"),
          meta: { title: "新增 AI 供应商" },
        },
        {
          path: "ai-providers/:id",
          name: "AIProviderEdit",
          component: () => import("@/views/AIService/ProviderEdit.vue"),
          meta: { title: "编辑 AI 供应商" },
        },
        // F.4: credits-system admin pages
        {
          path: "ai-services/context-budget",
          name: "context-budget",
          component: () => import("@/views/AIService/ContextBudget.vue"),
          meta: { title: "Context Budget", requiresAuth: true },
        },
        {
          path: "ai-services/coefficients",
          name: "EstimationCoefficients",
          component: () => import("@/views/EstimationCoefficientView.vue"),
          meta: { title: "估算系数" },
        },
        // Q3: credits-system B2B 月度结算报表
        {
          path: "b2b-billing",
          name: "B2BBillingReport",
          component: () => import("@/views/B2BBillingReportView.vue"),
          meta: { title: "B2B 月度结算" },
        },
        // AI Agent 助手 (feature #10 agent-mode-configurator-ux)
        {
          // Builder in create mode — mounted at /agents/builder?from=scratch|template:N|copy:N
          // AgentCreateChoose and TemplateGallery redirect here with the query param.
          path: "agents/builder",
          name: "agents-builder",
          component: () => import("@/views/agent/AgentBuilder.vue"),
          meta: { title: "创建助手" },
        },
        {
          path: "agents",
          name: "agents",
          component: () => import("@/views/agent/AgentList.vue"),
          meta: { title: "AI 助手" },
        },
        {
          path: "agents/new",
          name: "agents-new",
          component: () => import("@/views/agent/AgentCreateChoose.vue"),
          meta: { title: "创建助手" },
        },
        {
          path: "agents/new/from-template",
          name: "agents-from-template",
          component: () => import("@/views/agent/TemplateGallery.vue"),
          meta: { title: "选择模板" },
        },
        {
          path: "agents/:id",
          name: "agents-detail",
          component: () => import("@/views/agent/AgentDetail.vue"),
          props: true,
          meta: { title: "助手详情" },
        },
        {
          path: "agents/:id/edit",
          name: "agents-edit",
          component: () => import("@/views/agent/AgentEdit.vue"),
          props: true,
          meta: { title: "编辑助手" },
        },
        {
          path: "agent-monitoring",
          name: "agent-monitoring",
          component: () => import("@/views/agent/AgentMonitoring.vue"),
          meta: { title: "Agent 监控" },
        },
        // Phase C: compliance rule CRUD (feature agent-e2e-rollout)
        {
          path: "compliance-rules",
          name: "compliance-rule-list",
          component: () => import("@/views/compliance/ComplianceRuleList.vue"),
          meta: { title: "合规规则" },
        },
        {
          path: "compliance-rules/new",
          name: "compliance-rule-new",
          component: () => import("@/views/compliance/ComplianceRuleForm.vue"),
          meta: { title: "新增合规规则" },
        },
        {
          path: "compliance-rules/:id",
          name: "compliance-rule-edit",
          component: () => import("@/views/compliance/ComplianceRuleForm.vue"),
          meta: { title: "编辑合规规则" },
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
