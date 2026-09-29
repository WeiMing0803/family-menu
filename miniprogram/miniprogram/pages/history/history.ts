import { ApiError, getOrderHistory } from '../../services/api'
import { login } from '../../services/auth'
import type { OrderResponse } from '../../services/models'
import { shortDate } from '../../utils/date'
import { subscribeRealtime } from '../../services/realtime'

let unsubscribeOrderChanges: (() => void) | null = null
const statusLabels: Record<string, string> = {
  Active: '进行中',
  Completed: '已完成',
  Cancelled: '已取消'
}

function shortTime(value?: string | null): string {
  if (!value) return ''
  const normalizedValue = value.replace(/(\.\d{3})\d+/, '$1')
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue)
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

Page({
  data: {
    loading: true,
    orders: [] as Array<OrderResponse & { displayDate: string; displayTime: string; displayStatus: string }>,
    errorMessage: ''
  },

  onShow() {
    unsubscribeOrderChanges?.()
    unsubscribeOrderChanges = subscribeRealtime('OrderChanged', () => void this.load())
    void this.load()
  },

  onHide() {
    unsubscribeOrderChanges?.()
    unsubscribeOrderChanges = null
  },

  async load(): Promise<void> {
    this.setData({ loading: true, errorMessage: '' })
    try {
      await login()
      const orders = (await getOrderHistory()).map((order) => {
        return {
          ...order,
          displayDate: shortDate(order.orderDate),
          displayTime: shortTime(order.createdAt || order.items[0]?.createdAt),
          displayStatus: statusLabels[order.status] || order.status
        }
      })
      this.setData({ loading: false, orders })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: error instanceof ApiError ? error.message : '暂时无法加载历史记录' })
    }
  },
})
