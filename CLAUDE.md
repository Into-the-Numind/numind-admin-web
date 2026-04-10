# numind-admin-web — L1 约束文件

> 本文件为 AI 编程助手自动加载的仓库级约束。适用于 numind-admin-web（管理后台前端）。

---

## §1 技术栈声明

- **框架**: Vue 3.4 / TypeScript 5.4 / Vite 5
- **状态管理**: Pinia 2
- **路由**: Vue Router 4
- **HTTP**: Axios
- **图标**: Lucide Vue Next
- **主题**: CSS Variables（不使用外部 UI 框架）

---

## §2 组件与架构规则

- 必须使用 `<script setup lang="ts">` + Composition API
- 状态管理用 Pinia（`src/stores/` 目录）
- HTTP 请求统一使用 `src/api/request.ts` 的 axios 实例，禁止直接 `import axios`
- Token-based auth，token 存储在 localStorage
- 公共组件清单：
  - **Common**: AppButton, AppInput, AppSelect, AppToast, DataTable, StatusBadge, ConfirmModal, StatsCard
  - **Layout**: AdminLayout, AdminSidebar
- **管理页面必须使用表格布局（DataTable），不要用卡片网格**
- 新建组件前优先复用已有公共组件

---

## §3 编码规范

- TypeScript 严格模式（`strict: true`）
- Props 必须定义类型（使用 `defineProps<T>()` 泛型形式）
- 事件 emit 必须声明（使用 `defineEmits<T>()` 泛型形式）
- 模板中禁止使用 `any` 类型
- 文件命名：组件用 PascalCase，工具函数用 camelCase
- 样式使用 `<style scoped>`，主题色通过 CSS Variables 引用

---

## §4 开发命令

```bash
npm run dev         # 本地开发（port 5174，代理 /api → localhost:9099）
npm run lint        # ESLint 检查（含 --fix）
npm run type-check  # TypeScript 类型检查
npm run build       # 构建（含类型检查）
```

修改代码后必须运行 `npm run lint && npm run type-check`，通过后再提交。

---

## §5 项目结构速查

```
src/
├── api/            # API 模块（auth, dashboard, templates, users, billing 等）
├── components/
│   ├── common/     # 公共 UI 组件（AppButton, DataTable, StatsCard 等）
│   └── layout/     # 布局组件（AdminLayout, AdminSidebar）
├── composables/    # 组合式函数（useToast）
├── constants/      # 常量（statusMaps, billingMaps）
├── router/         # 路由配置
├── stores/         # Pinia 状态管理
├── styles/         # 全局样式与 CSS Variables
├── utils/          # 工具函数（format）
└── views/          # 页面组件（DashboardView, UsersView, TemplatesView 等）
```

---

*最后更新：2026-04-04*
