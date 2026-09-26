import { addOrderItem, ApiError, getFamilyOrNull, listDishes, toggleFavorite } from '../../services/api'
import { login } from '../../services/auth'
import type { DishResponse, FamilyResponse } from '../../services/models'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()
let unsubscribeDishChanges: (() => void) | null = null

Page({
  data: {
    loading: true,
    family: null as FamilyResponse | null,
    dishes: [] as DishResponse[],
    categories: ['全部', '早餐', '午餐', '晚餐', '其他'],
    currentCategory: '全部',
    search: '',
    errorMessage: ''
  },

  onShow() {
    unsubscribeDishChanges?.()
    unsubscribeDishChanges = subscribeRealtime('DishChanged', () => void this.load())
    void this.load()
  },

  onHide() {
    unsubscribeDishChanges?.()
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
        this.setData({ loading: false, family: null, dishes: [] })
        return
      }
      startRealtime()
      const dishes = await listDishes({
        category: this.data.currentCategory === '全部' ? undefined : this.data.currentCategory,
        search: this.data.search.trim() || undefined
      })
      this.setData({ loading: false, family, dishes })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: error instanceof ApiError ? error.message : '暂时无法加载菜单' })
    }
  },

  selectCategory(event: WechatMiniprogram.TouchEvent): void {
    const category = event.currentTarget.dataset.category as string
    this.setData({ currentCategory: category })
    void this.load()
  },

  onSearchInput(event: WechatMiniprogram.Input): void {
    this.setData({ search: event.detail.value })
  },

  onSearchConfirm(): void {
    void this.load()
  },

  async quickOrder(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const dishId = Number(event.currentTarget.dataset.id)
    try {
      await addOrderItem(dishId)
      wx.showToast({ title: '已加入今日', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error instanceof ApiError ? error.message : '加入失败', icon: 'none' })
    }
  },

  async toggleFavorite(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const dishId = Number(event.currentTarget.dataset.id)
    try {
      const updated = await toggleFavorite(dishId)
      const dishes = this.data.dishes.map((dish) => dish.id === updated.id ? updated : dish)
      this.setData({ dishes })
    } catch (error) {
      wx.showToast({ title: error instanceof ApiError ? error.message : '操作失败', icon: 'none' })
    }
  },

  openCreate(): void {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  },

  openEdit(event: WechatMiniprogram.TouchEvent): void {
    const dishId = Number(event.currentTarget.dataset.id)
    wx.navigateTo({ url: `/pages/dish-edit/dish-edit?id=${dishId}` })
  },

  goToday(): void {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goHistory(): void {
    wx.switchTab({ url: '/pages/history/history' })
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  }
})
