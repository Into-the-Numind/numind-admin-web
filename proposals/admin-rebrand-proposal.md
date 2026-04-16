# Admin 品牌重构 — 提案

## §1 方案概述

将管理后台从当前的紫蓝通用 SaaS 风格，重构为企业级蓝灰工业风格。参考 Superclaw OS 的设计语言：中性蓝灰色调、Manrope 标题字体、极小圆角、浅色 Sidebar、多层 Surface 体系。覆盖全部 17 个页面 + 公共组件 + Layout。

重构后，管理端将呈现专业、克制、数据密度优先的企业管理台气质，与用户端的翠绿品牌形成差异化但同样高品质的体验。

## §2 报价与周期
- 预估工作量：3 天
- 报价：内部项目
- 交付时间线：2026-04-19

## §3 技术可行性

### 现有功能复用
- **DataTable 组件**：已有，需调整样式 token（圆角、字体、颜色）
- **AppButton / AppInput / AppSelect**：已有，需调整样式
- **StatusBadge / StatsCard / ConfirmModal**：已有，需调整样式
- **AdminLayout / AdminSidebar**：已有，需大幅重构样式（Sidebar 从深色改浅色）
- **AppToast**：已有，需调整颜色
- **路由 / Store / API 层**：完全复用，不改动

### 技术风险
1. **字体加载性能**：引入 5 个 Google Fonts 字体族。缓解：使用 `font-display: swap` + 预加载关键字体（Manrope/Inter），非关键字体（Space Grotesk/Noto Sans SC）延迟加载
2. **视觉回归风险**：17 个页面同时改动，可能漏改某些内联样式。缓解：S5 阶段逐页 QA 截图验证
3. **Sidebar 深浅切换**：从深色背景改为浅色，需要全面调整文本色、hover 态、active 态、icon 色。变动最大的单一组件

### 涉及仓库
- [ ] numind-server
- [ ] numind-web-v3
- [x] numind-admin-web

### AI 可观测性
- N/A（不涉及 LLM 调用）

## §4 产品需求定义 — PRD

### 用户故事
1. 作为管理员，我需要一个专业、克制的管理界面，以便在日常运营中高效操作而不感到 "廉价SaaS" 感
2. 作为管理员，我需要所有页面风格统一，以便在不同功能模块间切换时无割裂感

### 验收标准

#### AC-1：Design Token 全面替换
- [ ] `variables.css` 所有颜色 token 替换为参考设计色板（蓝灰体系）
- [ ] 引入 5 层 Surface 体系 token（lowest → highest）
- [ ] 引入 4 个字体族 token（headline/body/label/mono）
- [ ] 圆角 token 调整为参考设计值（2px 默认，最大 12px）
- [ ] 状态色 token 引入（success/warning/danger/info）

#### AC-2：Sidebar 重构
- [ ] 背景从深紫蓝 (`#1E1B4B`) 改为浅色 (slate-50)
- [ ] 文本色、hover 态、active 态全部适配浅色背景
- [ ] Active 项使用右边框蓝色强调 + 白色背景 + 蓝色文本
- [ ] Logo 区域样式适配
- [ ] 底部按钮和状态指示器适配

#### AC-3：Top Header 引入
- [ ] 新增顶部导航栏（搜索框 + 通知/帮助/设置图标 + 用户头像）
- [ ] 白色背景 + 底部细边框 + 微阴影
- [ ] 搜索框使用参考设计的灰底无边框样式

#### AC-4：字体系统
- [ ] 引入 Google Fonts：Manrope、Inter、Space Grotesk、JetBrains Mono、Noto Sans SC
- [ ] 页面标题/区块标题使用 Manrope（font-headline）
- [ ] 正文/表格内容使用 Inter（font-body）
- [ ] 标签/分类文字使用 Space Grotesk（font-label）
- [ ] 代码/ID/数值使用 JetBrains Mono（font-mono）
- [ ] 中文内容使用 Noto Sans SC（font-noto）

#### AC-5：标签与排版风格
- [ ] 分类标签/表头统一使用全大写 + 超宽字距 (tracking-widest) + 极小字号 (10-11px)
- [ ] Stats 卡片使用左边框色条强调
- [ ] 页面副标题使用 `text-xs uppercase tracking-[0.2em]` 面包屑风格

#### AC-6：17 个 View 页面全部适配
- [ ] DashboardView — stats grid + table 样式适配
- [ ] BillingOverviewView — 内联 table 统一改用 DataTable 或统一样式
- [ ] PricingAnalyticsView — 输入框改用 AppInput，整体样式适配
- [ ] UsageRecordsView — 日期输入改用统一组件，样式适配
- [ ] UsersView — 样式适配 + modal 统一
- [ ] CreditUsersView — 样式适配 + modal 统一
- [ ] TierChangeLogsView — 样式适配
- [ ] TemplatesView — 卡片改为 DataTable（管理端硬规则）
- [ ] TemplateEditView — 表单样式适配
- [ ] RunsView — 样式适配 + 展开面板样式
- [ ] PricingRulesView — 样式适配
- [ ] OrdersView — 样式适配
- [ ] LLMProvidersView — 样式适配
- [ ] LLMModelsView — 样式适配
- [ ] AIService/ServicesList — 样式适配
- [ ] AIService/TasksList — 样式适配
- [ ] AIService/AuditLogs — 样式适配
- [ ] LoginView — 背景/颜色/字体全面适配
- [ ] NotFoundView — 样式适配

#### AC-7：组件统一
- [ ] 所有 table 统一使用 DataTable 组件（消除 Dashboard/BillingOverview 的内联 table）
- [ ] 所有输入框统一使用 AppInput（消除原生 HTML input）
- [ ] 所有 modal 统一结构（复用 ConfirmModal 或统一 inline modal 模式）
- [ ] 所有 action 按钮统一为 AppButton

#### AC-8：Lint & Type-check 通过
- [ ] `npm run lint` 退出码 0
- [ ] `npm run type-check` 退出码 0

### 边界情况
- **Sidebar 折叠态**：浅色主题下折叠态 icon 颜色需与展开态一致
- **Dark mode**：参考设计有 dark mode class，但当前 admin 不支持。本次不实现 dark mode，仅 light mode
- **超长文本**：表头全大写后英文可能变长，需确认不溢出
- **中文字体回退**：Noto Sans SC 加载慢时，系统字体应能正确渲染

### 权限规则
- 不涉及权限变更。管理端仍使用 admin_token 鉴权

### UI 行为规格
- 页面位置：管理端全局
- 布局要求：保持现有 Sidebar + Main Content 布局，新增 Top Header
- 交互模式：不改变现有交互，仅更换视觉样式
- 状态处理：loading/empty/error/success 4 状态保持不变，仅更换颜色和字体
