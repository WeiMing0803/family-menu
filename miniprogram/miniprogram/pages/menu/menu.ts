import { addOrderItem, ApiError, getFamilyOrNull, getTodayOrder, listDishes, toggleFavorite } from '../../services/api'
import { login } from '../../services/auth'
import type { DishResponse, FamilyResponse } from '../../services/models'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()
let unsubscribeDishChanges: (() => void) | null = null
let unsubscribeOrderChanges: (() => void) | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let menuLoadVersion = 0

function clearSearchTimer(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = null
}

Page({
  data: {
    loading: true,
    family: null as FamilyResponse | null,
    dishes: [] as Array<DishResponse & { ordered: boolean; selected: boolean }>,
    cartItems: [] as DishResponse[],
    showCart: false,
    submittingCart: false,
    categories: ['全部', '早餐', '午餐', '晚餐', '其他'],
    currentCategory: '全部',
    search: '',
    errorMessage: ''
  },

  onShow() {
    unsubscribeDishChanges?.()
    unsubscribeDishChanges = subscribeRealtime('DishChanged', () => void this.load())
    unsubscribeOrderChanges?.()
    unsubscribeOrderChanges = subscribeRealtime('OrderChanged', () => void this.load())
    void this.load()
  },

  onHide() {
    unsubscribeDishChanges?.()
    unsubscribeDishChanges = null
    unsubscribeOrderChanges?.()
    unsubscribeOrderChanges = null
    clearSearchTimer()
  },

  async load(): Promise<void> {
    const requestVersion = ++menuLoadVersion
    this.setData({ loading: true, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (!family) {
        void stopRealtime()
        if (requestVersion === menuLoadVersion) {
          this.setData({ loading: false, family: null, dishes: [], cartItems: [], showCart: false })
        }
        return
      }
      startRealtime()
      const [dishes, order] = await Promise.all([
        listDishes({
          category: this.data.currentCategory === '全部' ? undefined : this.data.currentCategory,
          search: this.data.search.trim() || undefined
        }),
        getTodayOrder()
      ])
      if (requestVersion !== menuLoadVersion) return
      const orderedDishIds = new Set(order.items.map((item) => item.dishId))
      const cartItems = this.data.cartItems
        .filter((item) => !orderedDishIds.has(item.id))
        .map((item) => dishes.find((dish) => dish.id === item.id) || item)
      const remainingSelectedIds = new Set(cartItems.map((item) => item.id))
      const dishesWithOrderState = dishes.map((dish) => ({
        ...dish,
        ordered: orderedDishIds.has(dish.id),
        selected: remainingSelectedIds.has(dish.id)
      }))
      this.setData({ loading: false, family, dishes: dishesWithOrderState, cartItems })
    } catch (error) {
      if (requestVersion !== menuLoadVersion) return
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: error instanceof ApiError ? error.message : '暂时无法加载菜单' })
    }
  },

  selectCategory(event: WechatMiniprogram.TouchEvent): void {
    clearSearchTimer()
    const category = event.currentTarget.dataset.category as string
    this.setData({ currentCategory: category })
    void this.load()
  },

  onSearchInput(event: WechatMiniprogram.Input): void {
    this.setData({ search: event.detail.value })
    clearSearchTimer()
    searchTimer = setTimeout(() => {
      searchTimer = null
      void this.load()
    }, 300)
  },

  onSearchConfirm(): void {
    clearSearchTimer()
    void this.load()
  },

  clearSearch(): void {
    clearSearchTimer()
    this.setData({ search: '' })
    void this.load()
  },

  toggleCart(event: WechatMiniprogram.TouchEvent): void {
    const dishId = Number(event.currentTarget.dataset.id)
    const dish = this.data.dishes.find((item) => item.id === dishId)
    if (!dish || this.data.submittingCart) return
    if (dish.ordered) {
      wx.showToast({ title: '这道菜已在今日点餐中', icon: 'none' })
      return
    }
    const cartItems = dish.selected
      ? this.data.cartItems.filter((item) => item.id !== dishId)
      : [...this.data.cartItems, dish]
    const selectedDishIds = new Set(cartItems.map((item) => item.id))
    this.setData({
      cartItems,
      dishes: this.data.dishes.map((item) => ({ ...item, selected: selectedDishIds.has(item.id) }))
    })
  },

  openCart(): void {
    this.setData({ showCart: true })
  },

  closeCart(): void {
    if (this.data.submittingCart) return
    this.setData({ showCart: false })
  },

  keepCartOpen(): void {
    // Catch the sheet tap so it does not bubble to the mask and close it.
  },

  removeCartItem(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.submittingCart) return
    const dishId = Number(event.currentTarget.dataset.id)
    const cartItems = this.data.cartItems.filter((item) => item.id !== dishId)
    this.setData({
      cartItems,
      dishes: this.data.dishes.map((item) => item.id === dishId ? { ...item, selected: false } : item)
    })
  },

  clearCart(): void {
    if (this.data.submittingCart) return
    this.setData({
      cartItems: [],
      dishes: this.data.dishes.map((item) => ({ ...item, selected: false }))
    })
  },

  async submitCart(): Promise<void> {
    if (!this.data.cartItems.length || this.data.submittingCart) return
    const selected = [...this.data.cartItems]
    const selectedDishIds = new Set(selected.map((item) => item.id))
    this.setData({ submittingCart: true })
    try {
      for (const dish of selected) {
        await addOrderItem(dish.id)
      }
      this.setData({
        cartItems: [],
        showCart: false,
        submittingCart: false,
        dishes: this.data.dishes.map((item) => ({
          ...item,
          ordered: item.ordered || selectedDishIds.has(item.id),
          selected: false
        }))
      })
      wx.showToast({ title: `已加入 ${selected.length} 道菜`, icon: 'success' })
      void this.load()
    } catch (error) {
      this.setData({ submittingCart: false })
      void this.load()
      wx.showToast({ title: error instanceof ApiError ? error.message : '加入失败，请重试', icon: 'none' })
    }
  },

  async toggleFavorite(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const dishId = Number(event.currentTarget.dataset.id)
    try {
      const updated = await toggleFavorite(dishId)
      const current = this.data.dishes.find((dish) => dish.id === updated.id)
      const dishes = this.data.dishes.map((dish) => dish.id === updated.id
        ? { ...updated, ordered: current?.ordered || false, selected: current?.selected || false }
        : dish)
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

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  }
})
