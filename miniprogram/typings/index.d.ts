/// <reference path="./types/index.d.ts" />

import type { FamilyResponse, UserResponse } from '../miniprogram/services/models'

declare global {
  interface IAppOption {
    globalData: {
      userInfo?: WechatMiniprogram.UserInfo
      user?: UserResponse
      family?: FamilyResponse | null
    }
    userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback
  }

  // @microsoft/signalr 的类型声明引用了这个 DOM 类型，小程序环境没有 DOM lib，这里单独补上。
  type XMLHttpRequestResponseType = '' | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text'
}

export {}
