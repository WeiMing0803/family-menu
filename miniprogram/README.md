# Family Menu 小程序

当前前端已完成可运行的最小联调闭环：

- `services/api.ts`：统一请求、Bearer Token、ProblemDetails 错误处理。
- `services/auth.ts`：微信 `wx.login` 与 Development `openId` 两种登录模式。
- 首页：家庭状态、今日点餐、清空今日点餐。
- 菜单：分类、搜索、喜欢、快速点餐、新增/编辑菜品。
- 历史记录和家庭管理：创建家庭、邀请码加入、成员查看。

## 本地联调

后端默认地址是 `http://localhost:5080`。开发环境默认使用 `development` 登录模式，和后端 `AllowDevelopmentOpenId` 配置配套。真机联调时请把 `API_BASE_URL` 改成局域网可访问的 HTTPS 地址（开发者工具可勾选“不校验合法域名”）。需要真微信登录时，将 `miniprogram/services/config.ts` 的 `LOGIN_MODE` 改为 `wechat`，并为后端配置微信 AppId/AppSecret。

若使用 Vant Weapp，执行 `npm install` 后在微信开发者工具中选择“工具 → 构建 npm”。当前首批页面使用原生组件保持无依赖即可启动，Vant 依赖已写入 `package.json`，后续页面可直接按 `/miniprogram_npm/@vant/weapp/...` 引入。
