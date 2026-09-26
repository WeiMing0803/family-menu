import { ApiError, createFamily, getFamilyOrNull, getMembers, joinFamily } from '../../services/api'
import { login, logout } from '../../services/auth'
import type { FamilyResponse, MemberResponse } from '../../services/models'
import { startRealtime, stopRealtime } from '../../services/realtime'

const app = getApp<IAppOption>()

Page({
  data: {
    loading: true,
    busy: false,
    family: null as FamilyResponse | null,
    members: [] as Array<MemberResponse & { initial: string }>,
    familyName: '',
    inviteCode: '',
    errorMessage: ''
  },

  onShow() {
    void this.load()
  },

  async load(): Promise<void> {
    this.setData({ loading: true, busy: false, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (family) startRealtime()
      else void stopRealtime()
      const members = family
        ? (await getMembers()).map((member) => ({ ...member, initial: member.nickName.slice(0, 1) }))
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
      wx.showToast({ title: '家庭已更新', icon: 'success' })
      await this.load()
    } catch (error) {
      this.setData({ busy: false, errorMessage: error instanceof ApiError ? error.message : '操作失败' })
    }
  },

  copyInviteCode(): void {
    if (!this.data.family) return
    wx.setClipboardData({ data: this.data.family.inviteCode })
  },

  async signOut(): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '退出当前登录？',
        content: '下次打开小程序时需要重新登录。',
        confirmColor: '#bd4b38',
        success: (result) => resolve(result.confirm)
      })
    })
    if (!confirmed) return
    logout()
    wx.reLaunch({ url: '/pages/login/login' })
  },

  goToday(): void {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goMenu(): void {
    wx.switchTab({ url: '/pages/menu/menu' })
  },

  goHistory(): void {
    wx.switchTab({ url: '/pages/history/history' })
  }
})
