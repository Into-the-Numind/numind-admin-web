# Admin 品牌重构 — 企业蓝灰工业风格

## 来源
- 提出人：用户（zhiyuchen）
- 提出日期：2026-04-16

## 需求描述
将 numind-admin-web 的整体视觉风格从当前的 Tailwind 默认值（紫蓝 indigo + sans-serif）重构为企业级蓝灰工业风格，参考 Superclaw OS 的设计语言。覆盖全部 17 个页面，实现管理端独立的专业视觉体系。

用户原话："帮我将 admin web 的 UI/UX 进行重构，目前的样子不好看"；"侧重于整体风格，要重构 17 个页面，不然最后感觉不统一"；"我不想要翠绿的风格，我想要这个文件的风格"。

## 设计方向决策

**管理端走独立设计语言，不照搬用户端翠绿品牌。**

| 维度 | 参考设计 (Superclaw OS) | 落地决策 |
|------|------------------------|---------|
| 色调 | 中性蓝灰，冷静克制 | 采用，Material Design 3 surface 层级体系 |
| 主色 | `#585f6a` (哑光深灰蓝) | 采用 |
| 强调色 | `#005eb6` (专业蓝) | 采用 |
| 背景 | `#f8f9fb` + 多层 surface | 采用 5 层 surface 体系 |
| Sidebar | 浅色 slate-50，无深色背景 | 采用 |
| 字体 | Manrope + Inter + Space Grotesk + JetBrains Mono | 采用（均为免费 Google Fonts） |
| 圆角 | 极小 (2px 默认) | 采用 |
| 标签 | 全大写 + 超宽字距 + 极小字号 | 采用 |
| 图标 | Material Symbols | **不采用** — 维持 Lucide |
| 表格 | 极简分割线 + hover 高亮 | 采用 |
| Stats 卡片 | 左边框强调色 | 采用 |

### 参考色板（从 code.html 提取）

**Surface 层级体系：**
| Token | 值 | 用途 |
|-------|-----|------|
| surface-container-lowest | `#ffffff` | 卡片/表格背景 |
| surface-container-low | `#f0f4f7` | 次级容器 |
| surface-container | `#e8eff3` | 默认容器 |
| surface-container-high | `#e1e9ee` | 强调容器/hover |
| surface-container-highest | `#d9e4ea` | 最强容器 |
| background | `#f8f9fb` | 页面背景 |

**语义色：**
| Token | 值 | 用途 |
|-------|-----|------|
| primary | `#585f6a` | 主色（CTA、sidebar 强调） |
| tertiary | `#005eb6` | 强调蓝（链接、active 状态） |
| secondary | `#4e6079` | 次要蓝灰 |
| error | `#9f403d` | 错误/危险 |
| on-background | `#2a3439` | 主文本 |
| on-surface-variant | `#566166` | 次要文本 |
| outline | `#717c82` | 边框/分割 |
| outline-variant | `#a9b4b9` | 轻边框 |

### 字体栈

```
headline: Manrope (Google Fonts, 免费)
body: Inter (Google Fonts, 免费)
label: Space Grotesk (Google Fonts, 免费)
mono: JetBrains Mono (Google Fonts, 免费)
chinese: Noto Sans SC (Google Fonts, 免费)
```

## 业务目标
1. **视觉品质提升**：从 Tailwind 默认的通用 SaaS 感升级为企业级工业管理台风格
2. **组件一致性**：消除页面间的 table/modal/input/button 不统一问题
3. **管理端独立品牌**：管理端走专业蓝灰路线，用户端保持翠绿品牌不变

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

### 当前 admin 与目标风格的差距

| 维度 | 当前 admin | 目标风格 |
|------|-----------|---------|
| 主色 | `#4F46E5` (indigo) | `#585f6a` (哑光深灰蓝) |
| 强调色 | 同主色 | `#005eb6` (专业蓝) |
| Sidebar | `#1E1B4B` (深紫蓝暗色) | slate-50 (浅色) |
| 字体 | 系统 sans-serif | Manrope / Inter / Space Grotesk |
| 圆角 | 6px-16px | 2px-12px（更方正） |
| 阴影 | 3 级 | 极轻 shadow-sm 为主 |
| 背景层级 | 单一 #F9FAFB | 5 层 surface 体系 |
| 文本色 | `#111827` (近纯黑) | `#2a3439` (蓝灰) |
| 标签 | 普通大小写 | 全大写 + 超宽字距 |

### 组件不一致问题（需同步修复）

1. 部分 view 用内联 table 而非 DataTable 组件
2. 部分 view 用原生 HTML input 而非 AppInput
3. Modal 模式混用（ConfirmModal 组件 vs 自定义 inline modal）
4. Action 按钮样式不统一（AppButton vs `.icon-btn`）
5. 状态色 map 散落在多处

## 范围
- 17 个 view 页面全部重构
- 8 个公共组件 token 替换 + 样式重写
- 2 个 layout 组件重构（特别是 Sidebar 从深色改浅色）
- `src/styles/variables.css` 全面替换
- 引入 Google Fonts（Manrope / Inter / Space Grotesk / JetBrains Mono / Noto Sans SC）

## 不变的约束
- 图标库维持 Lucide，不换 Material Symbols
- 用户端 (numind-web-v3) 不受影响
- 管理端硬规则不变：必须用 DataTable、4 状态处理、blur 验证、确认 dialog、禁止外部 UI 框架

## 备注
- 纯前端重构，不涉及后端改动
- 参考文件：`/Users/zhiyuchen/Downloads/code.html` (Superclaw OS Data Assets 页面)
