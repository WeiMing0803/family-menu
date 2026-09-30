import { getFamilyOrNull } from '../../services/api'
import { getDevelopmentIdentity, login, setDevelopmentIdentity } from '../../services/auth'
import { DEVELOPMENT_IDENTITIES, LOGIN_MODE, STORAGE_KEYS } from '../../services/config'
import { errorText, nameInitial } from '../../utils/ui'

const app = getApp<IAppOption>()

Page({
  data: {
    loading: false,
    errorMessage: '',
    isDevelopment: LOGIN_MODE === 'development',
    identities: DEVELOPMENT_IDENTITIES.map((identity) => ({
      ...identity,
      initial: nameInitial(identity.nickName)
    })),
    selectedOpenId: '',
    loginButtonText: LOGIN_MODE === 'development' ? '以测试身份登录' : '微信一键登录',
    loginHint: LOGIN_MODE === 'development'
      ? '本地联调模式：两台手机分别选择 A、B，即可模拟两位家庭成员。'
      : '登录即表示同意使用微信身份创建家庭菜单账号。'
  },

  onLoad(): void {
    const current = getDevelopmentIdentity()
    this.setData({ selectedOpenId: current?.openId || DEVELOPMENT_IDENTITIES[0].openId })
  },

  selectIdentity(event: WechatMiniprogram.TouchEvent): void {
    if (this.data.loading) return
    this.setData({ selectedOpenId: event.currentTarget.dataset.openid as string })
  },

  async startLogin(): Promise<void> {
    if (this.data.loading) return
    if (this.data.isDevelopment) {
      const identity = this.data.identities.find((item) => item.openId === this.data.selectedOpenId)
      if (!identity) {
        this.setData({ errorMessage: '请选择测试身份' })
        return
      }
      setDevelopmentIdentity({ openId: identity.openId, nickName: identity.nickName })
    }

    this.setData({ loading: true, errorMessage: '' })
    try {
      const auth = await login(true)
      app.globalData.user = auth.user
      app.globalData.family = await getFamilyOrNull()
      // 从邀请链接进入且还没有家庭时，直接去家庭页完成加入。
      const pendingInvite = wx.getStorageSync(STORAGE_KEYS.pendingInvite) as string | undefined
      wx.reLaunch({ url: pendingInvite && !app.globalData.family ? '/pages/family/family' : '/pages/index/index' })
    } catch (error) {
      this.setData({ loading: false, errorMessage: errorText(error, '登录失败，请稍后再试') })
    }
  }
})
