import { ApiError, getFamilyOrNull } from '../../services/api'
import { getDevelopmentIdentity, login, setDevelopmentIdentity } from '../../services/auth'
import { DEVELOPMENT_IDENTITIES, LOGIN_MODE } from '../../services/config'

const app = getApp<IAppOption>()

Page({
  data: {
    loading: false,
    errorMessage: '',
    isDevelopment: LOGIN_MODE === 'development',
    identities: DEVELOPMENT_IDENTITIES.map((identity) => ({ ...identity })),
    selectedOpenId: '',
    loginButtonText: LOGIN_MODE === 'development' ? '以测试身份登录' : '微信登录',
    loginHint: LOGIN_MODE === 'development'
      ? '本地联调模式：两台手机分别选择 A、B，即可模拟两位家庭成员。'
      : '使用微信账号登录。'
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
    if (this.data.isDevelopment) {
      const identity = this.data.identities.find((item) => item.openId === this.data.selectedOpenId)
      if (!identity) {
        this.setData({ errorMessage: '请选择测试身份' })
        return
      }
      setDevelopmentIdentity(identity)
    }

    this.setData({ loading: true, errorMessage: '' })
    try {
      const auth = await login(true)
      app.globalData.user = auth.user
      app.globalData.family = await getFamilyOrNull()
      wx.reLaunch({ url: '/pages/index/index' })
    } catch (error) {
      this.setData({ loading: false, errorMessage: error instanceof ApiError ? error.message : '登录失败，请稍后再试' })
    }
  }
})
