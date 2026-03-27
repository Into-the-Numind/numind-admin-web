import { get } from './request'

// ====== Types ======

export interface Order {
  id: number
  order_no: string
  user_id: number
  payer_id: number
  product_type: string
  months: number
  amount: number
  pay_channel: string
  pay_status: string
  trade_no: string
  paid_at: string | null
  expired_at: string
  created_at: string
}

export interface OrderListResponse {
  total: number
  items: Order[]
}

// ====== API Functions ======

export function listOrders(offset = 0, limit = 20) {
  return get<OrderListResponse>('/v1/admin/orders', { params: { offset, limit } })
}

export function getOrder(orderId: number) {
  return get<Order>(`/v1/admin/orders/${orderId}`)
}
