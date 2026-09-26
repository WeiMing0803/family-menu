# Family Menu 小程序

当前前端已完成可运行的最小联调闭环：

- `services/api.ts`：统一请求、Bearer Token、ProblemDetails 错误处理。
- `services/auth.ts`：微信 `wx.login` 与 Development `openId` 两种登录模式。
- `services/realtime.ts`：SignalR WebSocket 客户端、自动重连和页面变更订阅。
- 首页：家庭状态、今日点餐、清空今日点餐。
- 菜单：分类、搜索、喜欢、快速点餐、新增/编辑菜品。
- 历史记录和家庭管理：创建家庭、邀请码加入、成员查看。

## 本地联调

后端默认地址是 `http://localhost:5080`。开发环境默认使用 `development` 登录模式，和后端 `AllowDevelopmentOpenId` 配置配套。真机联调时请把 `API_BASE_URL` 改成局域网可访问的 HTTPS 地址（开发者工具可勾选“不校验合法域名”）。需要真微信登录时，将 `miniprogram/services/config.ts` 的 `LOGIN_MODE` 改为 `wechat`，并为后端配置微信 AppId/AppSecret。

`package.json` 中的依赖变更后，执行 `npm install`，再在微信开发者工具中选择“工具 → 构建 npm”。Vant 目前仍是已安装依赖，首批页面继续使用原生组件。

SignalR 使用与后端同源的 `/hubs/family` WebSocket 地址，复用本地 Token，并在页面显示且已加入家庭时建立连接。首页订阅菜品和点餐变更，菜单页订阅菜品变更，历史页订阅点餐变更；断线后自动重连，恢复连接后重新加载数据；应用切到后台时断开，返回前台后重连。真机运行仍要求 API/Hub 使用微信合法域名和 HTTPS/WSS。
