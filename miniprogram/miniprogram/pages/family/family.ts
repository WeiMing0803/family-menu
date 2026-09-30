import { createFamily, getFamilyOrNull, getMembers, joinFamily, leaveFamily } from '../../services/api'
import { login, logout } from '../../services/auth'
import { LOGIN_MODE, STORAGE_KEYS } from '../../services/config'
import type { FamilyResponse, MemberResponse } from '../../services/models'
import { startRealtime, stopRealtime, subscribeRealtime } from '../../services/realtime'
import { confirmAction, errorText, isUnauthorized, nameInitial, toast } from '../../utils/ui'
import type { DetailEvent } from '../../utils/ui'

const app = getApp<IAppOption>()
let unsubscribeFamilyChanges: (() => void) | null = null

const MAX_MEMBERS = 2
const INVITE_CODE_PATTERN = /^[A-Za-z2-9]{6}$/

type MemberView = MemberResponse & { initial: string; isMe: boolean }

Page({
  data: {
    loading: true,
    busy: false,
    errorMessage: '',
    family: null as FamilyResponse | null,
    members: [] as MemberView[],
    maxMembers: MAX_MEMBERS,
    familyName: '',
    inviteCode: '',
    fromInvite: false,
    signOutText: LOGIN_MODE === 'development' ? '切换测试身份' : '退出登录'
  },

  onLoad(options: Record<string, string | undefined>): void {
    // 从分享链接进入：先暂存邀请码，未登录时登录后会回到这里自动填入。
    const code = (options.inviteCode || '').toUpperCase()
    if (INVITE_CODE_PATTERN.test(code)) wx.setStorageSync(STORAGE_KEYS.pendingInvite, code)
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

  async onPullDownRefresh() {
    await this.load()
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    const family = this.data.family
    if (!family) return { title: '家庭点餐：和家人一起决定今天吃什么', path: '/pages/index/index' }
    return {
      title: `邀请你加入「${family.name}」，一起决定今天吃什么`,
      path: `/pages/family/family?inviteCode=${family.inviteCode}`
    }
  },

  async load(): Promise<void> {
    this.setData({ loading: !this.data.family && !this.data.members.length, busy: false, errorMessage: '' })
    try {
      const auth = await login()
      app.globalData.user = auth.user
      const family = await getFamilyOrNull()
      app.globalData.family = family
      if (!family) {
        void stopRealtime()
        const pending = wx.getStorageSync(STORAGE_KEYS.pendingInvite) as string | undefined
        this.setData({
          loading: false,
          family: null,
          members: [],
          inviteCode: pending || this.data.inviteCode,
          fromInvite: !!pending
        })
        return
      }
      wx.removeStorageSync(STORAGE_KEYS.pendingInvite)
      startRealtime()
      const members = (await getMembers()).map((member) => ({
        ...member,
        initial: nameInitial(member.nickName),
        isMe: member.id === auth.user.id
      }))
      this.setData({ loading: false, family, members, fromInvite: false })
    } catch (error) {
      if (isUnauthorized(error)) {
        wx.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.setData({ loading: false, errorMessage: errorText(error, '暂时无法加载家庭信息') })
    }
  },

  onFamilyNameChange(event: DetailEvent<string>): void {
    this.setData({ familyName: event.detail })
  },

  onInviteCodeChange(event: DetailEvent<string>): void {
    this.setData({ inviteCode: event.detail.toUpperCase() })
  },

  async create(): Promise<void> {
    await this.mutateFamily(() => createFamily(this.data.familyName), '家庭已创建')
  },

  async join(): Promise<void> {
    if (!INVITE_CODE_PATTERN.test(this.data.inviteCode.trim())) {
      this.setData({ errorMessage: '请输入 6 位邀请码' })
      return
    }
    await this.mutateFamily(() => joinFamily(this.data.inviteCode), '已加入家庭')
  },

  async mutateFamily(action: () => Promise<FamilyResponse>, successText: string): Promise<void> {
    if (this.data.busy) return
    this.setData({ busy: true, errorMessage: '' })
    try {
      app.globalData.family = await action()
      wx.removeStorageSync(STORAGE_KEYS.pendingInvite)
      // 服务端只在建立连接时把连接加入家庭分组，加入家庭后需要重新连接。
      await stopRealtime()
      toast(successText, 'success')
      await this.load()
    } catch (error) {
      this.setData({ busy: false, errorMessage: errorText(error, '操作失败') })
    }
  },

  copyInviteCode(): void {
    if (!this.data.family) return
    wx.setClipboardData({
      data: this.data.family.inviteCode,
      success: () => toast('邀请码已复制', 'success')
    })
  },

  async leave(): Promise<void> {
    const family = this.data.family
    if (!family || this.data.busy) return
    const confirmed = await confirmAction(
      '退出家庭？',
      `退出后将看不到「${family.name}」的菜单和点餐。家庭数据会保留，之后可以用邀请码 ${family.inviteCode} 重新加入。`,
      { confirmText: '退出家庭', danger: true }
    )
    if (!confirmed) return

    this.setData({ busy: true, errorMessage: '' })
    try {
      await leaveFamily()
      await stopRealtime()
      app.globalData.family = null
      toast('已退出家庭', 'success')
      this.setData({ family: null, members: [] })
      await this.load()
    } catch (error) {
      this.setData({ busy: false, errorMessage: errorText(error, '操作失败') })
    }
  },

  async signOut(): Promise<void> {
    const isDevelopment = LOGIN_MODE === 'development'
    const confirmed = await confirmAction(
      isDevelopment ? '切换测试身份？' : '退出当前登录？',
      isDevelopment ? '将回到登录页重新选择测试身份。' : '下次打开小程序时需要重新登录。'
    )
    if (!confirmed) return
    logout()
    app.globalData.user = undefined
    app.globalData.family = null
    wx.reLaunch({ url: '/pages/login/login' })
  }
})
