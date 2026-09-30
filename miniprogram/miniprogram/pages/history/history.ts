import { getFamilyOrNull, getOrderHistory, getTopDishes } from '../../services/api'
import { login } from '../../services/auth'
import type { DishStatResponse, OrderResponse } from '../../services/models'
import { dayLabel, relativeDay } from '../../utils/date'
import { subscribeRealtime } from '../../services/realtime'
import { errorText, isUnauthorized } from '../../utils/ui'

let unsubscribeOrderChanges: (() => void) | null = null

const orderStatus: Record<string, { label: string; type: string }> = {
  Active: { label: '进行中', type: 'primary' },
  Completed: { label: '已完成', type: 'primary' },
  Cancelled: { label: '已清空', type: 'default' }
}

const itemStatusLabels: Record<string, string> = {
  Done: '做了',
  Cancelled: '没吃'
}

function shortTime(value?: string | null): string {
  if (!value) return ''
  const normalizedValue = value.replace(/(\.\d{3})\d+/, '$1')
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue)
  const date = new Date(hasTimezone ? normalizedValue : `${normalizedValue}Z`)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

type OrderView = OrderResponse & {
  relative: string
  dateText: string
  timeText: string
  statusLabel: string
  statusType: string
  items: Array<OrderResponse['items'][number] & { statusLabel: string }>
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    hasFamily: true,
    orders: [] as OrderView[],
    topDishes: [] as Array<DishStatResponse & { rank: number; barWidth: number }>
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

  async onPullDownRefresh() {
    await this.load()
    wx.stopPullDownRefresh()
  },

  async load(): Promise<void> {
    this.setData({ loading: !this.data.orders.length, errorMessage: '' })
    try {
      await login()
      if (!await getFamilyOrNull()) {
        this.setData({ loading: false, hasFamily: false, orders: [], topDishes: [] })
        return
      }
      const [history, stats] = await Promise.all([getOrderHistory(), getTopDishes(7)])
      const maxTimes = Math.max(1, ...stats.map((stat) => stat.times))
      const topDishes = stats.map((stat, index) => ({
        ...stat,
        rank: index + 1,
        barWidth: Math.max(8, Math.round(stat.times / maxTimes * 100))
      }))
      const orders: OrderView[] = history.map((order) => {
        const status = orderStatus[order.status] || { label: order.status, type: 'default' }
        return {
          ...order,
          relative: relativeDay(order.orderDate),
          dateText: dayLabel(order.orderDate),
          timeText: shortTime(order.createdAt || order.items[0]?.createdAt),
          statusLabel: status.label,
          statusType: status.type,
          items: order.items.map((item) => ({ ...item, statusLabel: itemStatusLabels[item.status] || '' }))
        }
      })
      this.setData({ loading: false, hasFamily: true, orders, topDishes })
    } catch (error) {
      if (isUnauthorized(error)) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: errorText(error, '暂时无法加载历史记录') })
    }
  },

  goMenu(): void {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  }
})
