import { login } from './services/auth'
import { getFamilyOrNull } from './services/api'
import { startRealtime, stopRealtime } from './services/realtime'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    const logs = (wx.getStorageSync('logs') as number[] | undefined) || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs.slice(0, 20))

    // 页面会再次调用登录以处理冷启动竞态；这里预热缓存，减少首页首次等待。
    void login()
      .then(async (auth) => {
        this.globalData.user = auth.user
        this.globalData.family = await getFamilyOrNull()
        if (this.globalData.family) startRealtime()
      })
      .catch(() => {
        // 首页/登录页负责展示可操作的错误状态，这里不阻断小程序启动。
      })
  },

  onShow() {
    if (this.globalData.family) startRealtime()
  },

  onHide() {
    void stopRealtime()
  }
})
