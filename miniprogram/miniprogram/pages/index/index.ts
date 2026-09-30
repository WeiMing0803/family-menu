import { login } from '../../services/auth'
import {
  ApiError,
  clearTodayOrder,
  deleteOrderItem,
  getFamilyOrNull,
  getTodayOrder,
  updateOrderItem
} from '../../services/api'
import type { FamilyResponse, OrderItemResponse, OrderItemStatus, OrderResponse } from '../../services/models'
import { shortDate } from '../../utils/date'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()
let unsubscribers: Array<() => void> = []

const statusLabels: Record<string, string> = {
  Done: '已做完',
  Cancelled: '不吃了'
}

type OrderItemView = OrderItemResponse & { statusLabel: string }

function toItemViews(order: OrderResponse): OrderItemView[] {
  return order.items.map((item) => ({ ...item, statusLabel: statusLabels[item.status] || '' }))
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function confirm(title: string, content: string, confirmColor = '#e57442'): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({ title, content, confirmColor, success: (result) => resolve(result.confirm), fail: () => resolve(false) })
  })
}

Page({
  data: {
    loading: true,
    family: null as FamilyResponse | null,
    order: null as OrderResponse | null,
    items: [] as OrderItemView[],
    busyItemId: 0,
    errorMessage: '',
    todayLabel: ''
  },

  onShow() {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    unsubscribers = [
      subscribeRealtime('OrderChanged', () => void this.load()),
      subscribeRealtime('DishChanged', () => void this.load()),
      subscribeRealtime('FamilyChanged', () => void this.load())
    ]
    void this.load()
  },

  onHide() {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    unsubscribers = []
  },

  applyOrder(order: OrderResponse): void {
    this.setData({
      order,
      items: toItemViews(order),
      todayLabel: shortDate(order.orderDate)
    })
  },

  async load(): Promise<void> {
    this.setData({ loading: !this.data.order, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (!family) {
        void stopRealtime()
        this.setData({ loading: false, family: null, order: null, items: [] })
        return
      }
      // Realtime updates are optional; a socket setup failure must not block
      // the initial HTTP requests that populate the home page.
      try {
        startRealtime()
      } catch (error) {
        console.error('[今日页] 实时连接启动失败', error)
      }
      const order = await getTodayOrder()
      this.setData({ loading: false, family })
      this.applyOrder(order)
    } catch (error) {
      console.error('[今日页] 加载失败', error)
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'errMsg' in error
            ? String((error as { errMsg?: unknown }).errMsg || '暂时无法加载今日点餐')
            : '暂时无法加载今日点餐'
      this.setData({ loading: false, errorMessage: message })
    }
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  },

  goMenu(): void {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  findItem(event: WechatMiniprogram.TouchEvent): OrderItemView | undefined {
    const itemId = Number(event.currentTarget.dataset.id)
    return this.data.items.find((item) => item.id === itemId)
  },

  async runItemAction(itemId: number, action: () => Promise<OrderResponse | void>): Promise<void> {
    if (this.data.busyItemId) return
    this.setData({ busyItemId: itemId })
    try {
      const order = await action()
      if (order) this.applyOrder(order)
      else await this.load()
    } catch (error) {
      wx.showToast({ title: errorText(error, '操作失败'), icon: 'none' })
    } finally {
      this.setData({ busyItemId: 0 })
    }
  },

  openItemActions(event: WechatMiniprogram.TouchEvent): void {
    const item = this.findItem(event)
    if (!item || this.data.busyItemId) return

    const actions: Array<{ label: string; run: () => void }> = item.status === 'Pending'
      ? [
          { label: '已做完', run: () => this.setItemStatus(item, 'Done') },
          { label: '不吃了', run: () => this.setItemStatus(item, 'Cancelled') }
        ]
      : [{ label: '恢复为想吃', run: () => this.setItemStatus(item, 'Pending') }]
    actions.push(
      { label: item.remark ? '修改备注' : '添加备注', run: () => void this.editRemark(item) },
      { label: '删除这道菜', run: () => void this.removeItem(item) }
    )

    wx.showActionSheet({
      alertText: item.dishName,
      itemList: actions.map((action) => action.label),
      success: (result) => actions[result.tapIndex]?.run()
    })
  },

  setItemStatus(item: OrderItemView, status: OrderItemStatus): void {
    void this.runItemAction(item.id, () => updateOrderItem(item.id, { status }))
  },

  async editRemark(item: OrderItemView): Promise<void> {
    const remark = await new Promise<string | null>((resolve) => {
      wx.showModal({
        title: `备注：${item.dishName}`,
        editable: true,
        placeholderText: '例如：少辣、多放葱',
        content: item.remark || '',
        confirmColor: '#e57442',
        success: (result) => resolve(result.confirm ? (result.content || '') : null),
        fail: () => resolve(null)
      })
    })
    if (remark === null) return
    // 空字符串会被后端视为清除备注。
    await this.runItemAction(item.id, () => updateOrderItem(item.id, { remark: remark.trim().slice(0, 500) }))
  },

  async removeItem(item: OrderItemView): Promise<void> {
    if (!await confirm('删除这道菜？', `将「${item.dishName}」从今日点餐中移除。`, '#bd4b38')) return
    await this.runItemAction(item.id, () => deleteOrderItem(item.id))
  },

  async clearOrder(): Promise<void> {
    if (!await confirm('清空今日点餐？', '清空后仍可在历史记录中查看。')) return

    try {
      await clearTodayOrder()
      wx.showToast({ title: '已清空', icon: 'success' })
      await this.load()
    } catch (error) {
      wx.showToast({ title: errorText(error, '操作失败'), icon: 'none' })
    }
  }
})
