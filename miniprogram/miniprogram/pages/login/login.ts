import { ApiError, getFamilyOrNull } from '../../services/api'
import { login } from '../../services/auth'
import { LOGIN_MODE } from '../../services/config'

const app = getApp<IAppOption>()

Page({
  data: {
    loading: false,
    errorMessage: '',
    loginButtonText: LOGIN_MODE === 'development' ? '本地开发登录' : '微信登录',
    loginHint: LOGIN_MODE === 'development'
      ? '当前使用本地联调身份，无需微信授权。'
      : '使用微信账号登录。'
  },

  async startLogin(): Promise<void> {
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
