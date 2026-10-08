# 家庭点餐 Family Menu

一个给家里人用的点餐微信小程序：家人共享一份菜单，每个人都可以把想吃的菜加进「今日点餐」，做饭的人照着做，所有人的操作实时同步到其他人的手机上。

仓库包含两部分：

- **`miniprogram/`**：微信原生小程序（TypeScript + Less + Vant Weapp）
- **`backend/`**：ASP.NET Core Web API + SignalR 实时推送，数据存放在 SQLite

## 功能

| 页面 | 能做什么 |
|---|---|
| 今日 | 查看今天点了哪些菜，按「想吃 / 已做完 / 不吃了」分组；标记状态、添加备注、删除、清空今日点餐 |
| 菜单 | 按分类和「喜欢」筛选、搜索菜品；勾选后加入今日点餐；新增、编辑、删除菜品 |
| 历史 | 近 7 天常吃榜，按天查看过去的点餐记录 |
| 家庭 | 创建家庭（可设置 2–5 人上限）、用 6 位邀请码或分享链接邀请家人加入、查看成员、退出家庭 |

任何一位家人新增菜品、点菜或修改状态，其他人的页面都会自动刷新，不需要下拉刷新。

## 技术栈

| 部分 | 技术 |
|---|---|
| 小程序 | 微信原生小程序、TypeScript、Less、[Vant Weapp](https://vant-ui.github.io/vant-weapp/) 1.x |
| 实时通信 | [SignalR](https://learn.microsoft.com/aspnet/core/signalr/)（服务端 ASP.NET Core SignalR，客户端 `@microsoft/signalr`，经 WebSocket 连接） |
| 后端 | .NET 10、ASP.NET Core Web API（Controller）、ProblemDetails 统一错误格式、限流、健康检查 |
| 数据 | Entity Framework Core 10 + SQLite |
| 认证 | 微信 `wx.login` 换取 openid → 后端签发 JWT；开发环境可用测试身份免微信登录 |

## 目录结构

```
family-menu/
├── backend/
│   ├── FamilyMenu.Backend.sln
│   └── FamilyMenu.Api/
│       ├── Controllers/      # auth / family / dishes / orders 接口
│       ├── Services/         # 业务逻辑（家庭、菜品、点餐、登录）
│       ├── Hubs/FamilyHub.cs # SignalR Hub，按家庭分组推送变更
│       ├── Models/           # 实体与 DTO
│       ├── Data/             # EF Core DbContext
│       └── Program.cs        # 依赖注入、认证、启动时建库
├── miniprogram/
│   ├── project.config.json   # 用微信开发者工具打开 miniprogram/ 这一层
│   ├── scripts/              # SignalR CommonJS 适配脚本
│   └── miniprogram/
│       ├── pages/            # 今日 / 菜单 / 历史 / 家庭 / 登录 / 菜品编辑
│       ├── components/       # 公共组件
│       └── services/         # 请求封装、登录、实时连接、接口配置
└── docs/                     # 设计文档、实施计划、双机联调指南
```

## 快速开始

### 环境要求

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Node.js 18+ 和 npm
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### 1. 启动后端

```bash
cd backend/FamilyMenu.Api
dotnet run
```

- 默认监听 `http://0.0.0.0:5080`，以 Development 环境运行。
- 首次启动会在当前目录自动创建 SQLite 数据库 `family.db`，无需手动建库或执行迁移。
- 浏览器打开 `http://localhost:5080/health`，看到 `Healthy` 即启动成功。
- Development 环境下可以在 `http://localhost:5080/openapi/v1.json` 查看接口定义。

### 2. 运行小程序

```bash
cd miniprogram
npm install
```

1. 用微信开发者工具「导入项目」，目录选 `miniprogram/`（`project.config.json` 所在的那一层）。
2. 菜单栏「工具 → 构建 npm」。
3. 如果开发者工具没有自动执行自定义预处理命令，构建 npm 后再执行一次：

   ```bash
   node scripts/prepare-signalr-miniprogram.js
   ```

4. 修改 [`miniprogram/miniprogram/services/config.ts`](miniprogram/miniprogram/services/config.ts) 中的 `API_BASE_URL`：
   - 只在开发者工具模拟器里调试：`http://localhost:5080/api`
   - 用手机真机预览：改成电脑的局域网 IP，例如 `http://192.168.1.95:5080/api`
5. 在开发者工具「详情 → 本地设置」中勾选「不校验合法域名」，然后编译运行。

### 3. 登录和体验

开发模式（`LOGIN_MODE = 'development'`）下不走微信授权，登录页可以选择「测试用户 A」或「测试用户 B」。

1. 用测试用户 A 登录，进入「家庭」页创建家庭，得到 6 位邀请码。
2. 在另一台设备（或切换身份后）用测试用户 B 登录，输入邀请码加入家庭。
3. 在一边添加菜品、点菜，另一边会实时看到变化。

用两台手机测试实时同步的完整步骤（局域网、防火墙、调试模式等）见 [双机联调测试指南](docs/双机联调测试指南.md)。

## 配置说明

后端配置在 [`appsettings.json`](backend/FamilyMenu.Api/appsettings.json)，开发环境的覆盖值在 `appsettings.Development.json`。

| 配置项 | 说明 |
|---|---|
| `ConnectionStrings:Default` | SQLite 连接字符串，默认 `Data Source=family.db` |
| `Jwt:Secret` | JWT 签名密钥，至少 32 个字符。开发环境已提供示例值，**生产环境必须另行设置** |
| `Jwt:ExpirationMinutes` | 登录有效期，默认 10080 分钟（7 天） |
| `Wechat:AppId` / `Wechat:AppSecret` | 小程序 AppId 和 AppSecret，真实微信登录时必填 |
| `Wechat:AllowDevelopmentOpenId` | 是否允许测试身份登录，只能在 Development 环境开启 |
| `Family:TimeZone` | 计算「今天」使用的时区，默认 `Asia/Shanghai` |
| `Cors:AllowedOrigins` | 允许的跨域来源，生产环境至少配置一个 |

AppSecret、JWT 密钥这类敏感值不要写进仓库，用 User Secrets 或环境变量配置：

```bash
cd backend/FamilyMenu.Api
dotnet user-secrets init
dotnet user-secrets set "Wechat:AppId" "你的AppId"
dotnet user-secrets set "Wechat:AppSecret" "你的AppSecret"
```

环境变量写法用双下划线代替冒号，例如 `Jwt__Secret`。

## 接口概览

除登录外，所有接口都需要在请求头携带 `Authorization: Bearer <token>`。

| 模块 | 接口 |
|---|---|
| 登录 | `POST /api/auth/login`、`GET /api/auth/me` |
| 家庭 | `GET /api/family`、`POST /api/family/create`、`POST /api/family/join`、`POST /api/family/leave`、`GET /api/family/members` |
| 菜品 | `GET /api/dishes`、`POST /api/dishes`、`PUT /api/dishes/{id}`、`DELETE /api/dishes/{id}`、`PUT /api/dishes/{id}/favorite` |
| 点餐 | `GET /api/orders/today`、`POST /api/orders/items`、`PUT /api/orders/items/{id}`、`DELETE /api/orders/items/{id}`、`POST /api/orders/clear`、`GET /api/orders/history`、`GET /api/orders/stats` |
| 实时 | SignalR Hub `/hubs/family`，推送 `FamilyChanged`、`DishChanged`、`OrderChanged` 事件 |

## 上线前检查

1. 把 `config.ts` 中的 `LOGIN_MODE` 改为 `'wechat'`，`API_BASE_URL` 改为正式的 HTTPS 地址。
2. 后端以 Production 环境运行，配置 `Jwt:Secret`、`Wechat:AppId`、`Wechat:AppSecret` 和 `Cors:AllowedOrigins`；`AllowDevelopmentOpenId` 保持 `false`。
3. API 使用 HTTPS，SignalR 使用 WSS；在微信公众平台把后端域名加入 request 和 socket 合法域名。
4. 如果部署在反向代理后面，在 `ForwardedHeaders:KnownProxies` 中填写代理地址。

## 相关文档

- [项目设计文档](docs/项目设计文档.md)
- [实施计划](docs/IMPLEMENTATION_PLAN.md)
- [双机联调测试指南](docs/双机联调测试指南.md)
- [小程序说明](miniprogram/README.md)：页面结构、样式约定、实时连接细节
