import { createDish, deleteDish, listDishes, toggleFavorite, updateDish } from '../../services/api'
import { confirmAction, errorText, toast } from '../../utils/ui'
import type { DetailEvent } from '../../utils/ui'

const CATEGORIES = ['早餐', '午餐', '晚餐', '其他']

Page({
  data: {
    dishId: null as number | null,
    isEdit: false,
    loading: false,
    name: '',
    category: '晚餐',
    categories: CATEGORIES,
    remark: '',
    isFavorite: false,
    saving: false,
    deleting: false,
    nameError: '',
    errorMessage: ''
  },

  onLoad(options: Record<string, string | undefined>): void {
    const dishId = options.id ? Number(options.id) : null
    if (!dishId) return
    this.setData({ dishId, isEdit: true, loading: true })
    void this.loadDish(dishId)
  },

  async loadDish(dishId: number): Promise<void> {
    try {
      const dish = (await listDishes()).find((item) => item.id === dishId)
      if (!dish) throw new Error('这道菜已被删除')
      this.setData({
        loading: false,
        name: dish.name,
        category: CATEGORIES.includes(dish.category) ? dish.category : '其他',
        remark: dish.remark || '',
        isFavorite: dish.isFavorite
      })
    } catch (error) {
      this.setData({ loading: false, errorMessage: errorText(error, '无法加载菜品') })
    }
  },

  onNameChange(event: DetailEvent<string>): void {
    this.setData({ name: event.detail, nameError: '' })
  },

  selectCategory(event: WechatMiniprogram.TouchEvent): void {
    this.setData({ category: event.currentTarget.dataset.category as string })
  },

  onRemarkChange(event: DetailEvent<string>): void {
    this.setData({ remark: event.detail })
  },

  onFavoriteChange(event: DetailEvent<boolean>): void {
    this.setData({ isFavorite: event.detail })
  },

  async save(): Promise<void> {
    if (this.data.saving || this.data.deleting) return
    const name = this.data.name.trim()
    if (!name) {
      this.setData({ nameError: '请填写菜名' })
      return
    }
    this.setData({ saving: true, errorMessage: '' })
    try {
      const payload = {
        name,
        category: this.data.category,
        remark: this.data.remark.trim() || undefined
      }
      if (this.data.dishId) {
        await updateDish(this.data.dishId, { ...payload, isFavorite: this.data.isFavorite })
      } else {
        // 新建接口不接收“喜欢”，创建后再切换一次。
        const created = await createDish(payload)
        if (this.data.isFavorite) await toggleFavorite(created.id)
      }
      toast('已保存', 'success')
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      this.setData({ saving: false, errorMessage: errorText(error, '保存失败') })
    }
  },

  async remove(): Promise<void> {
    const dishId = this.data.dishId
    if (!dishId || this.data.saving || this.data.deleting) return
    const confirmed = await confirmAction(
      '删除这道菜？',
      `「${this.data.name}」将从菜单中移除。点过的菜会保留在历史记录里，因此无法删除。`,
      { confirmText: '删除', danger: true }
    )
    if (!confirmed) return

    this.setData({ deleting: true, errorMessage: '' })
    try {
      await deleteDish(dishId)
      toast('已删除', 'success')
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      this.setData({ deleting: false, errorMessage: errorText(error, '删除失败') })
    }
  }
})
