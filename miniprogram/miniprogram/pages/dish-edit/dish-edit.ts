import { ApiError, createDish, listDishes, updateDish } from '../../services/api'

Page({
  data: {
    dishId: null as number | null,
    isEdit: false,
    name: '',
    category: '晚餐',
    remark: '',
    isFavorite: false,
    saving: false,
    errorMessage: ''
  },

  onLoad(options: Record<string, string | undefined>): void {
    const dishId = options.id ? Number(options.id) : null
    if (!dishId) return
    this.setData({ dishId, isEdit: true })
    void this.loadDish(dishId)
  },

  async loadDish(dishId: number): Promise<void> {
    try {
      const dishes = await listDishes()
      const dish = dishes.find((item) => item.id === dishId)
      if (!dish) throw new Error('菜品不存在')
      this.setData({
        name: dish.name,
        category: dish.category,
        remark: dish.remark || '',
        isFavorite: dish.isFavorite
      })
    } catch (error) {
      this.setData({ errorMessage: error instanceof ApiError ? error.message : '无法加载菜品' })
    }
  },

  onNameInput(event: WechatMiniprogram.Input): void {
    this.setData({ name: event.detail.value })
  },

  onCategoryInput(event: WechatMiniprogram.Input): void {
    this.setData({ category: event.detail.value })
  },

  onRemarkInput(event: WechatMiniprogram.Input): void {
    this.setData({ remark: event.detail.value })
  },

  async save(): Promise<void> {
    const name = this.data.name.trim()
    if (!name) {
      this.setData({ errorMessage: '请填写菜名' })
      return
    }
    this.setData({ saving: true, errorMessage: '' })
    try {
      const payload = {
        name,
        category: this.data.category.trim() || '其他',
        remark: this.data.remark.trim() || undefined,
        isFavorite: this.data.isFavorite
      }
      if (this.data.dishId) {
        await updateDish(this.data.dishId, payload)
      } else {
        await createDish(payload)
      }
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      this.setData({ saving: false, errorMessage: error instanceof ApiError ? error.message : '保存失败' })
    }
  }
})
