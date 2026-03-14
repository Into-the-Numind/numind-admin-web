// 服务类型中文标签
export const serviceTypeLabels: Record<string, string> = {
  llm_chat: 'LLM 对话',
  llm_vision: 'LLM 视觉',
  embedding: '向量嵌入',
  rerank: '重排序',
  cos_upload: '文件存储',
  file_extract: '文件提取',
  vector_db: '向量数据库'
}

// 供应商中文标签（与后端 provider 字段完全对齐）
export const providerLabels: Record<string, string> = {
  volc: '火山方舟',
  ali: '阿里百炼',
  dmxapi: 'DMXAPI',
  cos: '腾讯云 COS',
  vikingdb: '火山 VikingDB',
  dashvector: '阿里 DashVector',
  bailian: '阿里百炼服务'
}

// 业务操作中文标签（与后端 operation 字段完全对齐）
export const operationLabels: Record<string, string> = {
  // SOP 工作流
  sop_node_execute: 'SOP 节点执行',
  sop_chat_stream: 'SOP 对话',
  sop_text_edit: 'SOP 文本编辑',
  sop_quality_check: 'SOP 质量检查',
  sop_parse_file_text: 'SOP 文件解析',
  sop_parse_file_query: 'SOP 文件查询',
  sop_image_read: 'SOP 图片识别',
  sop_file_upload: 'SOP 文件上传',
  // 销售智能体
  salesrag_generate_answer: '知识检索回答',
  salesrag_chat_generate: '销售对话生成',
  salesrag_intent_analysis: '意图分析',
  salesrag_strategy_select: '策略选择',
  salesrag_rerank: '搜索重排',
  salesrag_tagging: '知识库打标',
  salesrag_ingest: '知识库导入',
  salesrag_ingest_upload: '知识库上传',
  salesrag_analyze_profile: '客户画像分析',
  salesrag_analyze_profile_text: '客户画像(文本)',
  salesrag_chat_style_text: '聊天风格(文本)',
  salesrag_chat_style_image: '聊天风格(图片)',
  salesrag_ocr: 'OCR 识别',
  // 其他
  ali_vision_analyze: '图片分析',
  bailian_upload_lease: '百炼上传租约',
  bailian_add_file: '百炼文件导入'
}

// 功能模块分组（将 operation 归类为业务模块）
export const moduleGroups: Record<string, { label: string; operations: string[] }> = {
  sop: {
    label: 'SOP 工作流',
    operations: ['sop_node_execute', 'sop_chat_stream', 'sop_text_edit', 'sop_quality_check',
      'sop_parse_file_text', 'sop_parse_file_query', 'sop_image_read', 'sop_file_upload']
  },
  salesrag: {
    label: '销售智能体',
    operations: ['salesrag_generate_answer', 'salesrag_chat_generate', 'salesrag_intent_analysis',
      'salesrag_strategy_select', 'salesrag_rerank', 'salesrag_tagging', 'salesrag_ingest',
      'salesrag_ingest_upload', 'salesrag_analyze_profile', 'salesrag_analyze_profile_text',
      'salesrag_chat_style_text', 'salesrag_chat_style_image', 'salesrag_ocr']
  },
  other: {
    label: '其他服务',
    operations: ['ali_vision_analyze', 'bailian_upload_lease', 'bailian_add_file']
  }
}

// 获取 operation 所属的模块 key
export function getModuleKey(operation: string): string {
  for (const [key, group] of Object.entries(moduleGroups)) {
    if (group.operations.includes(operation)) return key
  }
  return 'other'
}

// 服务类型筛选选项
export const serviceTypeFilterOptions = [
  { label: '全部类型', value: '' },
  ...Object.entries(serviceTypeLabels).map(([value, label]) => ({ label, value }))
]

export const serviceTypeFormOptions = Object.entries(serviceTypeLabels).map(([value, label]) => ({ label, value }))

// 供应商筛选选项（与后端对齐）
export const providerFilterOptions = [
  { label: '全部供应商', value: '' },
  ...Object.entries(providerLabels).map(([value, label]) => ({ label, value }))
]

export const providerFormOptions = Object.entries(providerLabels).map(([value, label]) => ({ label, value }))

// 操作筛选选项
export const operationFilterOptions = [
  { label: '全部操作', value: '' },
  ...Object.entries(operationLabels).map(([value, label]) => ({ label, value }))
]

// 费用格式化
export function formatCost(cents: number): string {
  if (cents >= 100) return '\u00A5' + (cents / 100).toFixed(2)
  if (cents > 0) return cents + ' 分'
  return '\u00A50.00'
}

// 毛利率格式化
export function formatMarginRate(cost: number, revenue: number): string {
  if (revenue === 0) return '\u2014'
  const rate = ((revenue - cost) / revenue) * 100
  return rate.toFixed(1) + '%'
}
