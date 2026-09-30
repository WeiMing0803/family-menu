import { addOrderItem, getFamilyOrNull, getTodayOrder, listDishes, toggleFavorite } from '../../services/api'
import { login } from '../../services/auth'
import type { DishResponse, FamilyResponse } from '../../services/models'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'
import { errorText, isUnauthorized, toast } from '../../utils/ui'
import type { DetailEvent } from '../../utils/ui'

const app = getApp<IAppOption>()
let unsubscribers: Array<() => void> = []
let searchTimer: ReturnType<typeof setTimeout> | null = null
let menuLoadVersion = 0

type DishView = DishResponse & { ordered: boolean; selected: boolean }

function clearSearchTimer(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = null
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    family: null as FamilyResponse | null,
    dishes: [] as DishView[],
    cartItems: [] as DishResponse[],
    cartSummary: '',
    showCart: false,
    submittingCart: false,
    categories: ['全部', '早餐', '午餐', '晚餐', '其他'],
    currentCategory: '全部',
    favoriteOnly: false,
    search: ''
  },

  onShow() {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    unsubscribers = [
      subscribeRealtime('DishChanged', () => void this.load()),
      subscribeRealtime('OrderChanged', () => void this.load())
    ]
    void this.load()
  },

  onHide() {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    unsubscribers = []
    clearSearchTimer()
  },

  async onPullDownRefresh() {
    await this.load()
    wx.stopPullDownRefresh()
  },

  async load(): Promise<void> {
    const requestVersion = ++menuLoadVersion
    this.setData({ loading: !this.data.dishes.length, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (!family) {
        void stopRealtime()
        if (requestVersion === menuLoadVersion) {
          this.setData({ loading: false, family: null, dishes: [], showCart: false })
          this.applyCart([])
        }
        return
      }
      startRealtime()
      const [dishes, order] = await Promise.all([
        listDishes({
          category: this.data.currentCategory === '全部' ? undefined : this.data.currentCategory,
          search: this.data.search.trim() || undefined,
          favorite: this.data.favoriteOnly || undefined
        }),
        getTodayOrder()
      ])
      if (requestVersion !== menuLoadVersion) return
      const orderedIds = new Set(order.items.map((item) => item.dishId))
      // 已被家人点掉的菜从已选里移除；仍在已选里的用最新数据替换。
      const cartItems = this.data.cartItems
        .filter((item) => !orderedIds.has(item.id))
        .map((item) => dishes.find((dish) => dish.id === item.id) || item)
      const selectedIds = new Set(cartItems.map((item) => item.id))
      this.setData({
        loading: false,
        family,
        dishes: dishes.map((dish) => ({ ...dish, ordered: orderedIds.has(dish.id), selected: selectedIds.has(dish.id) }))
      })
      this.applyCart(cartItems)
    } catch (error) {
      if (requestVersion !== menuLoadVersion) return
      if (isUnauthorized(error)) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: errorText(error, '暂时无法加载菜单') })
    }
  },

  applyCart(cartItems: DishResponse[]): void {
    const selectedIds = new Set(cartItems.map((item) => item.id))
    this.setData({
      cartItems,
      cartSummary: cartItems.length ? `已选 ${cartItems.length} 道 · ${cartItems.map((item) => item.name).join('、')}` : '还没有选菜',
      dishes: this.data.dishes.map((dish) => ({ ...dish, selected: selectedIds.has(dish.id) })),
      showCart: this.data.showCart && cartItems.length > 0
    })
  },

  selectCategory(event: WechatMiniprogram.TouchEvent): void {
    clearSearchTimer()
    this.setData({ currentCategory: event.currentTarget.dataset.category as string })
    void this.load()
  },

  toggleFavoriteFilter(): void {
    clearSearchTimer()
    this.setData({ favoriteOnly: !this.data.favoriteOnly })
    void this.load()
  },

  onSearchChange(event: DetailEvent<string>): void {
    this.setData({ search: event.detail })
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

  onSearchClear(): void {
    clearSearchTimer()
    this.setData({ search: '' })
    void this.load()
  },

  toggleCart(event: WechatMiniprogram.TouchEvent): void {
    const dishId = Number(event.currentTarget.dataset.id)
    const dish = this.data.dishes.find((item) => item.id === dishId)
    if (!dish || this.data.submittingCart) return
    if (dish.ordered) {
      toast('这道菜已在今日点餐中')
      return
    }
    this.applyCart(dish.selected
      ? this.data.cartItems.filter((item) => item.id !== dishId)
      : [...this.data.cartItems, dish])
  },

  openCart(): void {
    if (this.data.cartItems.length) this.setData({ showCart: true })
  },

  closeCart(): void {
    if (!this.data.submittingCart) this.setData({ showCart: false })
  },

  removeCartItem(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.submittingCart) return
    const dishId = Number(event.currentTarget.dataset.id)
    this.applyCart(this.data.cartItems.filter((item) => item.id !== dishId))
  },

  clearCart(): void {
    if (!this.data.submittingCart) this.applyCart([])
  },

  async submitCart(): Promise<void> {
    if (!this.data.cartItems.length || this.data.submittingCart) return
    const selected = [...this.data.cartItems]
    this.setData({ submittingCart: true })
    try {
      for (const dish of selected) {
        await addOrderItem(dish.id)
      }
      this.setData({ submittingCart: false, showCart: false })
      this.applyCart([])
      toast(`已加入 ${selected.length} 道菜`, 'success')
    } catch (error) {
      this.setData({ submittingCart: false })
      toast(errorText(error, '加入失败，请重试'))
    }
    void this.load()
  },

  async toggleFavorite(event: WechatMiniprogram.TouchEvent): Promise<void> {
    const dishId = Number(event.currentTarget.dataset.id)
    try {
      const updated = await toggleFavorite(dishId)
      this.setData({
        dishes: this.data.dishes.map((dish) => dish.id === updated.id ? { ...dish, isFavorite: updated.isFavorite } : dish)
      })
    } catch (error) {
      toast(errorText(error, '操作失败'))
    }
  },

  openCreate(): void {
    wx.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  },

  openEdit(event: WechatMiniprogram.TouchEvent): void {
    wx.navigateTo({ url: `/pages/dish-edit/dish-edit?id=${Number(event.currentTarget.dataset.id)}` })
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  }
})
