import { get, post, put, del } from './request'

export interface SopTemplate {
  id: number
  name: string
  description: string
  status: number
  prompt: string
  created_at: string
  updated_at: string
}

export interface TemplatesResponse {
  total: number
  templates: SopTemplate[]
}

export interface SopNode {
  id: number
  template_id: number
  name: string
  status: number
  base_url: string
  model_name: string
  api_key?: string
  timeout_seconds: number
  sort: number
  prompt: string
}

export interface NodesResponse {
  total: number
  nodes: SopNode[]
}

export function getTemplatesApi(offset = 0, limit = 20) {
  return get<TemplatesResponse>('/v1/admin/sop/templates', { params: { offset, limit } })
}

export function getTemplateApi(id: number) {
  return get<SopTemplate>(`/v1/admin/sop/templates/${id}`)
}

export function createTemplateApi(data: Pick<SopTemplate, 'name' | 'description' | 'prompt'>) {
  return post<SopTemplate>('/v1/admin/sop/templates', data)
}

export function updateTemplateApi(id: number, data: Partial<SopTemplate>) {
  return put<void>(`/v1/admin/sop/templates/${id}`, data)
}

export function deleteTemplateApi(id: number) {
  return del<void>(`/v1/admin/sop/templates/${id}`)
}

export function getTemplateNodesApi(templateId: number) {
  return get<NodesResponse>(`/v1/admin/sop/templates/${templateId}/nodes`)
}

export function createNodeApi(data: Omit<SopNode, 'id' | 'status'>) {
  return post<SopNode>('/v1/admin/sop/nodes', data)
}

export function getNodeApi(id: number) {
  return get<SopNode>(`/v1/admin/sop/nodes/${id}`)
}

export function updateNodeApi(id: number, data: Partial<SopNode>) {
  return put<void>(`/v1/admin/sop/nodes/${id}`, data)
}

export function deleteNodeApi(id: number) {
  return del<void>(`/v1/admin/sop/nodes/${id}`)
}
