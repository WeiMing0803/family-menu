import { ApiError, getOrderHistory } from '../../services/api'
import { login } from '../../services/auth'
import type { OrderResponse } from '../../services/models'
import { shortDate } from '../../utils/date'
import { subscribeRealtime } from '../../services/realtime'

let unsubscribeOrderChanges: (() => void) | null = null

Page({
  data: {
    loading: true,
    orders: [] as Array<OrderResponse & { displayDate: string }>,
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
      const orders = (await getOrderHistory()).map((order) => ({
        ...order,
        displayDate: shortDate(order.orderDate)
      }))
      this.setData({ loading: false, orders })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: error instanceof ApiError ? error.message : '暂时无法加载历史记录' })
    }
  },

  goToday(): void {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goMenu(): void {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  }
})
