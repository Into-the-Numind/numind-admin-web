export const runStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'gray' },
  running: { label: '运行中', color: 'info' },
  succeeded: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'danger' }
}

export const nodeStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '等待', color: 'gray' },
  running: { label: '运行', color: 'info' },
  succeeded: { label: '完成', color: 'success' },
  failed: { label: '失败', color: 'danger' }
}

export const templateStatusLabels: Record<string, { label: string; color: string }> = {
  '1': { label: '启用', color: 'success' },
  '0': { label: '禁用', color: 'gray' }
}

export const tierLabels: Record<string, { label: string; color: string }> = {
  free: { label: '免费版', color: 'gray' },
  standard: { label: '标准版', color: 'info' },
  premium: { label: '高级版', color: 'warning' }
}

export const userStatusLabels: Record<string, { label: string; color: string }> = {
  '0': { label: '启用', color: 'success' },
  '1': { label: '禁用', color: 'danger' }
}
