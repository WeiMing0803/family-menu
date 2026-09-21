import { ApiError, getFamilyOrNull } from '../../services/api'
import { login } from '../../services/auth'

const app = getApp<IAppOption>()

Page({
  data: {
    loading: false,
    errorMessage: ''
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
