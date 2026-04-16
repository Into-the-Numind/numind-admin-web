# Admin 品牌重构 — 对齐 DESIGN.md 设计系统

## 来源
- 提出人：用户（zhiyuchen）
- 提出日期：2026-04-16

## 需求描述
将 numind-admin-web 的整体视觉风格从当前的 Tailwind 默认值（紫蓝 indigo + sans-serif）重构为 DESIGN.md 定义的莫小派品牌系统（翠绿 + 衬线 heading + 多层 shadow），覆盖全部 17 个页面，实现用户端与管理端的品牌统一。

用户原话："帮我将 admin web 的 UI/UX 进行重构，目前的样子不好看"；"侧重于整体风格，要重构 17 个页面，不然最后感觉不统一"。

## 业务目标
1. **品牌统一**：管理端与用户端 (numind-web-v3) 使用同一套品牌语言（色彩、字体、间距、圆角、阴影），消除"两个产品"的割裂感
2. **视觉品质提升**：从 Tailwind 默认的通用 SaaS 感升级为"刊物气质 + 工业可靠"的莫小派设计语言
3. **组件一致性**：消除页面间的 table/modal/input/button 不统一问题

## 优先级
高

## Triage
- 推荐轨道：Standard
- 分类理由：
  1. 数据库 schema 变更：否
  2. 新增 API 端点：否
  3. 新外部服务集成：否
  4. 影响文件数：>3（17 个 view + 8 个组件 + 2 个 layout + styles）
  5. 高风险业务逻辑（支付/权限）：否
- 人类决定：确认 Standard

## 现状分析

### 当前 admin 与 DESIGN.md 的差距

| 维度 | 当前 admin | DESIGN.md 目标 |
|------|-----------|---------------|
| 主色 | `#4F46E5` (indigo) | `hsl(160, 72%, 40%)` (翠绿) |
| Sidebar | `#1E1B4B` (深紫蓝) | `hsl(160, 45%, 28%)` (深绿) |
| Heading 字体 | 系统 sans-serif | Georgia + 宋体（衬线） |
| 圆角 | 0.375rem-1rem (4 级) | 6px-20px + pill (5 级，T-shirt 命名) |
| 阴影 | 3 级 | 5 级（含 shadow-focus + shadow-card） |
| 间距命名 | 数字索引 (--space-1 到 --space-8) | T-shirt size (--space-xs 到 --space-4xl) |
| 状态色 | success/warning/danger/info 已定义 | v3 缺失，需在本 feature 中统一引入 |
| 背景 | `#F9FAFB` 纯色 | `#F7F8FB` + gradient |
| 文本色 | `#111827` (近纯黑) | `#1A1D26` (近黑带暖色) |

### 组件不一致问题

1. **表格**：部分 view 用 DataTable 组件，Dashboard/BillingOverview 用内联 table
2. **输入框**：UsageRecords/PricingAnalytics 用原生 HTML input，未用 AppInput
3. **Modal**：ConfirmModal (复用组件) 与多处自定义 inline modal 共存
4. **Action 按钮**：AppButton vs `.icon-btn` 样式不统一
5. **状态显示**：StatusBadge 组件 vs 各 view 内联定义的 color map

## 范围
- 17 个 view 页面全部重构
- 8 个公共组件 token 替换
- 2 个 layout 组件重构
- `src/styles/variables.css` 全面替换为 DESIGN.md token
- 引入状态色 token（success/warning/danger/info）

## 备注
- 纯前端重构，不涉及后端改动
- blocker `frontend-design-system` 已于 2026-04-10 完成
- 侧重风格统一，bug 修复不在本次范围
