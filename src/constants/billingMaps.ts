// 服务类型中文标签
export const serviceTypeLabels: Record<string, string> = {
  llm_chat: 'LLM 对话',
  llm_vision: 'LLM 视觉',
  embedding: '向量嵌入',
  rerank: '重排序',
  cos_upload: 'COS 上传',
  file_extract: '文件提取',
  vector_db: '向量数据库'
}

// 业务操作中文标签
export const operationLabels: Record<string, string> = {
  sop_node_execute: 'SOP 节点执行',
  sop_chat_stream: 'SOP 对话',
  sop_text_edit: 'SOP 文本编辑',
  sop_quality_check: 'SOP 质量检查',
  sop_parse_file_text: 'SOP 文件解析',
  sop_parse_file_query: 'SOP 文件查询',
  sop_image_read: 'SOP 图片识别',
  sop_file_upload: 'SOP 文件上传',
  salesrag_chat: '销售问答',
  salesrag_intent_analysis: '意图分析',
  salesrag_rerank: '搜索重排',
  salesrag_strategy_select: '策略选择',
  salesrag_ingest_upload: '知识库上传',
  salesrag_profile_analyze: '客户画像分析',
  salesrag_chat_style_analyze: '聊天风格分析',
  salesrag_ocr: 'OCR 识别'
}

// 服务类型下拉选项（含"全部"）
export const serviceTypeFilterOptions = [
  { label: '全部类型', value: '' },
  ...Object.entries(serviceTypeLabels).map(([value, label]) => ({ label, value }))
]

// 服务类型下拉选项（不含"全部"，用于表单）
export const serviceTypeFormOptions = Object.entries(serviceTypeLabels).map(([value, label]) => ({ label, value }))

// 供应商下拉选项
export const providerFilterOptions = [
  { label: '全部供应商', value: '' },
  { label: '火山引擎', value: 'volcengine' },
  { label: '阿里云', value: 'aliyun' },
  { label: '腾讯云', value: 'tencent' }
]

export const providerFormOptions = [
  { label: '火山引擎', value: 'volcengine' },
  { label: '阿里云', value: 'aliyun' },
  { label: '腾讯云', value: 'tencent' }
]

// 操作下拉选项（含"全部"）
export const operationFilterOptions = [
  { label: '全部操作', value: '' },
  ...Object.entries(operationLabels).map(([value, label]) => ({ label, value }))
]

// 费用格式化
export function formatCost(cents: number): string {
  if (cents >= 100) return (cents / 100).toFixed(2) + ' 元'
  return cents + ' 分'
}
