import { login } from '../../services/auth'
import { ApiError, clearTodayOrder, getFamilyOrNull, getTodayOrder } from '../../services/api'
import type { FamilyResponse, OrderResponse } from '../../services/models'
import { shortDate } from '../../utils/date'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()
let unsubscribeOrderChanges: (() => void) | null = null
let unsubscribeDishChanges: (() => void) | null = null

Page({
  data: {
    loading: true,
    family: null as FamilyResponse | null,
    order: null as OrderResponse | null,
    errorMessage: '',
    todayLabel: ''
  },

  onShow() {
    unsubscribeOrderChanges?.()
    unsubscribeDishChanges?.()
    unsubscribeOrderChanges = subscribeRealtime('OrderChanged', () => void this.load())
    unsubscribeDishChanges = subscribeRealtime('DishChanged', () => void this.load())
    void this.load()
  },

  onHide() {
    unsubscribeOrderChanges?.()
    unsubscribeDishChanges?.()
    unsubscribeOrderChanges = null
    unsubscribeDishChanges = null
  },

  async load(): Promise<void> {
    this.setData({ loading: true, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (!family) {
        void stopRealtime()
        this.setData({ loading: false, family: null, order: null })
        return
      }
      startRealtime()
      const order = await getTodayOrder()
      this.setData({
        loading: false,
        family,
        order,
        todayLabel: shortDate(order.orderDate)
      })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      const message = error instanceof ApiError ? error.message : '暂时无法加载今日点餐'
      this.setData({ loading: false, errorMessage: message })
    }
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  },

  goLogin(): void {
    wx.reLaunch({ url: '/pages/login/login' })
  },

  goMenu(): void {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  goHistory(): void {
    wx.switchTab({ url: '/pages/history/history' })
  },

  async clearOrder(): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '清空今日点餐？',
        content: '清空后仍可在历史记录中查看。',
        confirmColor: '#e57442',
        success: (result) => resolve(result.confirm)
      })
    })
    if (!confirmed) return

    try {
      await clearTodayOrder()
      wx.showToast({ title: '已清空', icon: 'success' })
      await this.load()
    } catch (error) {
      wx.showToast({ title: error instanceof ApiError ? error.message : '操作失败', icon: 'none' })
    }
  }
})
