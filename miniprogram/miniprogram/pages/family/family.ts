import { ApiError, createFamily, getFamilyOrNull, getMembers, joinFamily, leaveFamily } from '../../services/api'
import { login, logout } from '../../services/auth'
import { LOGIN_MODE } from '../../services/config'
import type { FamilyResponse, MemberResponse } from '../../services/models'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()
let unsubscribeFamilyChanges: (() => void) | null = null

function confirm(title: string, content: string, confirmText = '确定'): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmText,
      confirmColor: '#bd4b38',
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false)
    })
  })
}

Page({
  data: {
    loading: true,
    busy: false,
    family: null as FamilyResponse | null,
    members: [] as Array<MemberResponse & { initial: string; isMe: boolean }>,
    familyName: '',
    inviteCode: '',
    errorMessage: '',
    signOutText: LOGIN_MODE === 'development' ? '切换测试身份' : '退出登录'
  },

  onShow() {
    unsubscribeFamilyChanges?.()
    unsubscribeFamilyChanges = subscribeRealtime('FamilyChanged', () => void this.load())
    void this.load()
  },

  onHide() {
    unsubscribeFamilyChanges?.()
    unsubscribeFamilyChanges = null
  },

  async load(): Promise<void> {
    this.setData({ loading: !this.data.family, busy: false, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (family) startRealtime()
      else void stopRealtime()
      const members = family
        ? (await getMembers()).map((member) => ({
            ...member,
            initial: member.nickName.slice(0, 1),
            isMe: member.id === auth.user.id
          }))
        : []
      this.setData({ loading: false, family, members })
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: error instanceof ApiError ? error.message : '暂时无法加载家庭信息' })
    }
  },

  onFamilyNameInput(event: WechatMiniprogram.Input): void {
    this.setData({ familyName: event.detail.value })
  },

  onInviteCodeInput(event: WechatMiniprogram.Input): void {
    this.setData({ inviteCode: event.detail.value.toUpperCase() })
  },

  async create(): Promise<void> {
    await this.mutateFamily(() => createFamily(this.data.familyName))
  },

  async join(): Promise<void> {
    if (this.data.inviteCode.trim().length !== 6) {
      this.setData({ errorMessage: '请输入 6 位邀请码' })
      return
    }
    await this.mutateFamily(() => joinFamily(this.data.inviteCode))
  },

  async mutateFamily(action: () => Promise<FamilyResponse>): Promise<void> {
    this.setData({ busy: true, errorMessage: '' })
    try {
      const family = await action()
      app.globalData.family = family
      // 服务端只在建立连接时把连接加入家庭分组，加入家庭后需要重新连接。
      await stopRealtime()
      wx.showToast({ title: '家庭已更新', icon: 'success' })
      await this.load()
    } catch (error) {
      this.setData({ busy: false, errorMessage: error instanceof ApiError ? error.message : '操作失败' })
    }
  },

  copyInviteCode(): void {
    if (!this.data.family) return
    wx.setClipboardData({
      data: this.data.family.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  },

  async leave(): Promise<void> {
    const family = this.data.family
    if (!family || this.data.busy) return
    const confirmed = await confirm(
      '退出家庭？',
      `退出后将看不到「${family.name}」的菜单和点餐。家庭数据会保留，之后可以用邀请码 ${family.inviteCode} 重新加入。`,
      '退出家庭'
    )
    if (!confirmed) return

    this.setData({ busy: true, errorMessage: '' })
    try {
      await leaveFamily()
      await stopRealtime()
      app.globalData.family = null
      wx.showToast({ title: '已退出家庭', icon: 'success' })
      this.setData({ family: null, members: [] })
      await this.load()
    } catch (error) {
      this.setData({ busy: false, errorMessage: error instanceof ApiError ? error.message : '操作失败' })
    }
  },

  async signOut(): Promise<void> {
    const confirmed = await confirm(
      LOGIN_MODE === 'development' ? '切换测试身份？' : '退出当前登录？',
      LOGIN_MODE === 'development' ? '将回到登录页重新选择测试身份。' : '下次打开小程序时需要重新登录。'
    )
    if (!confirmed) return
    logout()
    app.globalData.user = undefined
    app.globalData.family = null
    wx.reLaunch({ url: '/pages/login/login' })
  },
})
