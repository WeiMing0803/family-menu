import { login } from '../../services/auth'
import {
  clearTodayOrder,
  deleteOrderItem,
  getFamilyOrNull,
  getMembers,
  getTodayOrder,
  updateOrderItem
} from '../../services/api'
import type { FamilyResponse, MemberResponse, OrderItemResponse, OrderItemStatus, OrderResponse } from '../../services/models'
import { dayLabel } from '../../utils/date'
import { confirmAction, errorText, isUnauthorized, nameInitial, promptText, toast } from '../../utils/ui'
import type { DetailEvent } from '../../utils/ui'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()
let unsubscribers: Array<() => void> = []

type ItemView = OrderItemResponse & { addedByName: string }
type MemberView = MemberResponse & { initial: string; isMe: boolean }
type SheetAction = { name: string; key: string; color?: string }

Page({
  data: {
    loading: true,
    errorMessage: '',
    family: null as FamilyResponse | null,
    members: [] as MemberView[],
    dateLabel: '',
    pending: [] as ItemView[],
    done: [] as ItemView[],
    cancelled: [] as ItemView[],
    itemCount: 0,
    busyItemId: 0,
    sheetShow: false,
    sheetTitle: '',
    sheetActions: [] as SheetAction[],
    sheetItemId: 0
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

  async onPullDownRefresh() {
    await this.load()
    wx.stopPullDownRefresh()
  },

  applyOrder(order: OrderResponse, memberList?: MemberView[]): void {
    const members = memberList || this.data.members
    const names = new Map(members.map((member) => [member.id, member.isMe ? '我' : member.nickName]))
    const items: ItemView[] = order.items.map((item) => ({ ...item, addedByName: names.get(item.addedBy) || '' }))
    this.setData({
      dateLabel: dayLabel(order.orderDate),
      pending: items.filter((item) => item.status === 'Pending'),
      done: items.filter((item) => item.status === 'Done'),
      cancelled: items.filter((item) => item.status === 'Cancelled'),
      itemCount: items.length
    })
  },

  async load(): Promise<void> {
    this.setData({ loading: !this.data.family, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (!family) {
        void stopRealtime()
        this.setData({ loading: false, family: null, members: [] })
        return
      }
      // 实时连接失败不能影响首页的 HTTP 数据加载。
      try {
        startRealtime()
      } catch (error) {
        console.error('[今日页] 实时连接启动失败', error)
      }
      const [order, memberList] = await Promise.all([getTodayOrder(), getMembers()])
      const members = memberList.map((member) => ({
        ...member,
        initial: nameInitial(member.nickName),
        isMe: member.id === auth.user.id
      }))
      this.setData({ loading: false, family, members })
      this.applyOrder(order, members)
    } catch (error) {
      console.error('[今日页] 加载失败', error)
      if (isUnauthorized(error)) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: errorText(error, '暂时无法加载今日点餐') })
    }
  },

  goFamily(): void {
    wx.switchTab({ url: '/pages/family/family' })
  },

  goMenu(): void {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  findItem(itemId: number): ItemView | undefined {
    return [...this.data.pending, ...this.data.done, ...this.data.cancelled].find((item) => item.id === itemId)
  },

  async runItemAction(itemId: number, action: () => Promise<OrderResponse | void>): Promise<void> {
    if (this.data.busyItemId) return
    this.setData({ busyItemId: itemId })
    try {
      const order = await action()
      if (order) this.applyOrder(order)
      else await this.load()
    } catch (error) {
      toast(errorText(error, '操作失败'))
    } finally {
      this.setData({ busyItemId: 0 })
    }
  },

  setStatus(itemId: number, status: OrderItemStatus): void {
    void this.runItemAction(itemId, () => updateOrderItem(itemId, { status }))
  },

  markDone(event: WechatMiniprogram.TouchEvent): void {
    this.setStatus(Number(event.currentTarget.dataset.id), 'Done')
  },

  restore(event: WechatMiniprogram.TouchEvent): void {
    this.setStatus(Number(event.currentTarget.dataset.id), 'Pending')
  },

  openItemActions(event: WechatMiniprogram.TouchEvent): void {
    const item = this.findItem(Number(event.currentTarget.dataset.id))
    if (!item || this.data.busyItemId) return
    const actions: SheetAction[] = item.status === 'Pending'
      ? [{ name: '已做完', key: 'done' }, { name: '不吃了', key: 'cancel' }]
      : [{ name: '恢复为想吃', key: 'restore' }]
    actions.push(
      { name: item.remark ? '修改备注' : '添加备注', key: 'remark' },
      { name: '删除', key: 'delete', color: '#c8553d' }
    )
    this.setData({ sheetShow: true, sheetTitle: item.dishName, sheetActions: actions, sheetItemId: item.id })
  },

  closeSheet(): void {
    this.setData({ sheetShow: false })
  },

  onSheetSelect(event: DetailEvent<SheetAction>): void {
    const itemId = this.data.sheetItemId
    this.setData({ sheetShow: false })
    switch (event.detail.key) {
      case 'done': this.setStatus(itemId, 'Done'); break
      case 'cancel': this.setStatus(itemId, 'Cancelled'); break
      case 'restore': this.setStatus(itemId, 'Pending'); break
      case 'remark': void this.editRemark(itemId); break
      case 'delete': void this.removeItem(itemId); break
    }
  },

  async editRemark(itemId: number): Promise<void> {
    const item = this.findItem(itemId)
    if (!item) return
    const remark = await promptText(`备注：${item.dishName}`, item.remark || '', '例如：少辣、多放葱')
    if (remark === null) return
    // 空字符串会被后端视为清除备注。
    await this.runItemAction(itemId, () => updateOrderItem(itemId, { remark: remark.trim().slice(0, 500) }))
  },

  onSwipeDelete(event: WechatMiniprogram.TouchEvent): void {
    void this.removeItem(Number(event.currentTarget.dataset.id))
  },

  async removeItem(itemId: number): Promise<void> {
    const item = this.findItem(itemId)
    if (!item) return
    if (!await confirmAction('删除这道菜？', `将「${item.dishName}」从今日点餐中移除。`, { confirmText: '删除', danger: true })) return
    await this.runItemAction(itemId, () => deleteOrderItem(itemId))
  },

  async clearOrder(): Promise<void> {
    if (!await confirmAction('清空今日点餐？', '清空后仍可在历史记录中查看。', { confirmText: '清空', danger: true })) return
    try {
      await clearTodayOrder()
      toast('已清空', 'success')
      await this.load()
    } catch (error) {
      toast(errorText(error, '操作失败'))
    }
  }
})
