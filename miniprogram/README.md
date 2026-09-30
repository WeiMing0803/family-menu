# Family Menu 小程序

- `services/api.ts`：统一请求、Bearer Token、ProblemDetails 错误处理。
- `services/auth.ts`：微信 `wx.login` 与 Development 测试身份两种登录模式。
- `services/realtime.ts`：SignalR WebSocket 客户端、自动重连和页面变更订阅。
- 今日：按「想吃 / 已做完 / 不吃了」分组，点击菜品打开操作菜单，左滑删除，清空今日点餐。
- 菜单：搜索、分类和「喜欢」筛选，勾选后通过底部结算条加入今日点餐，新增 / 编辑 / 删除菜品。
- 历史：近 7 天常吃榜，按天的点餐时间线。
- 家庭：创建家庭、邀请码加入、分享邀请链接、成员列表、退出家庭。

## 界面与样式

- 组件库使用 [Vant Weapp](https://vant-ui.github.io/vant-weapp/)，常用组件在 `app.json` 的 `usingComponents` 中全局注册，页面无需重复声明。
- 设计变量（奶油绿配色、圆角、间距）和 Vant 主题变量都以 CSS 变量定义在 `app.less` 的 `page {}` 中，页面样式只引用变量，不写死颜色。
- `project.config.json` 的 `lessSetting.commonUseFilePath` 指向 `styles/mixins.less`，该文件会被引入每个 `.less`，只能放 Less 变量和 mixin。
- 公共组件：`components/dish-avatar`（没有图片时按分类取色、显示菜名首字）、`components/empty-state`（空状态）。
- 底部 tabBar 图标位于 `assets/tabbar/`，由 [Tabler Icons](https://tabler.io/icons)（MIT）按主题色渲染为 81×81 PNG。
- Vant 图标字体默认从 `at.alicdn.com` 加载，真机上首次打开需要网络。

## 本地联调

后端默认地址是 `http://localhost:5080`。开发环境默认使用 `development` 登录模式，和后端 `AllowDevelopmentOpenId` 配置配套，登录页可选择测试用户 A / B。真机联调时请把 `API_BASE_URL` 改成局域网可访问的地址，并在手机上打开调试模式，详见 `docs/双机联调测试指南.md`。需要真微信登录时，将 `miniprogram/services/config.ts` 的 `LOGIN_MODE` 改为 `wechat`，并为后端配置微信 AppId/AppSecret。

`package.json` 中的依赖变更后，执行 `npm install`，再在微信开发者工具中选择“工具 → 构建 npm”。项目编译前会补齐 SignalR 的 CommonJS 子模块；如果开发者工具未启用自定义预处理命令，在构建 npm 后运行 `node scripts/prepare-signalr-miniprogram.js`。

SignalR 使用与后端同源的 `/hubs/family` WebSocket 地址，复用本地 Token，并在页面显示且已加入家庭时建立连接。今日页订阅点餐、菜品和家庭变更，菜单页订阅菜品和点餐变更，历史页订阅点餐变更，家庭页订阅家庭变更；断线后自动重连，恢复连接后重新加载数据；应用切到后台时断开，返回前台后重连。真机运行仍要求 API/Hub 使用微信合法域名和 HTTPS/WSS。
