# 家庭点餐小程序实施计划

> 依据：`docs/项目设计文档.md` v1.0  
> 当前状态：阶段四进行中；基础页面/API 联调和 SignalR 客户端实现已完成，新增依赖的 npm 重建及小程序/真机验证待完成
> 更新时间：2026-09-26

## 1. 目标与边界

本项目先交付一个可以独立运行、可以用 HTTP 调试、可以被微信小程序继续接入的 ASP.NET Core 10 Web API。第一版后端覆盖设计文档中定义的核心闭环：登录、家庭关系、菜品管理、今日点餐、历史记录和 SignalR 实时通知。

阶段一至三先交付后端基线；阶段四开始接入小程序页面和联调。本轮前端先实现登录、家庭状态、菜单和今日点餐最小闭环，图片上传、生产部署脚本、微信云托管配置、SignalR 客户端和真机验证继续按后续任务推进。

## 2. 分阶段路线

### 阶段一：后端项目基线（已完成）

- [x] 创建 `backend/FamilyMenu.Api` .NET 10 Web API 项目
- [x] 创建可由 Visual Studio 2026 打开的 `backend/FamilyMenu.Backend.sln`
- [x] 建立 Models、DTOs、Data、Services、Controllers、Hubs 目录
- [x] 配置 SQLite + EF Core 数据模型和索引
- [x] 实现开发环境可用的 JWT 登录流程
- [x] 实现家庭创建、邀请码加入、家庭信息和成员查询
- [x] 实现菜品查询、创建、更新、删除、喜欢切换
- [x] 实现今日点餐、点餐项修改/删除、清空和历史查询
- [x] 实现 SignalR `/hubs/family` 及家庭组广播
- [x] 配置健康检查、CORS、OpenAPI 基础支持
- [x] 通过 `dotnet build` 和最小启动检查

### 阶段二：仓库工程化文件（已完成）

- [x] 添加 `.REMED`，记录本地运行、配置和交付约定
- [x] 添加根目录默认 `.gitignore`
- [x] 检查 SQLite 数据库、密钥、构建产物不会进入 Git

### 阶段三：微信登录与安全加固

- [x] 配置微信 `jscode2session` 交换流程
- [x] 将开发环境的 `openId` 登录回退限制在 Development 环境
- [x] 补充 JWT 密钥管理、生产 CORS、HTTPS 和日志脱敏
- [x] 增加统一错误响应和更完整的输入校验

### 阶段四：前后端联调

- [x] 根据接口返回结构接入微信小程序基础工程、请求封装和登录流程
- [x] 完成家庭状态、今日点餐、菜单、菜品编辑、历史记录和家庭管理页面基础交互
- [x] 写入 Vant Weapp 依赖和 npm 构建约定；首批页面先使用原生组件保持开箱可运行
- [x] 在微信开发者工具完成基础工程实际编译，并验证 Vant npm 构建（用户确认）
- [x] 接入 SignalR 客户端重连和变更刷新
- [ ] 重建 SignalR npm 产物，并在微信开发者工具验证小程序客户端
- [ ] 真机验证微信登录、网络域名和实时更新

### 阶段五：测试与部署

- [ ] 增加服务层和 API 集成测试
- [ ] 完成 EF Core Migration 并替换当前的 `EnsureCreated`
- [ ] 增加数据库备份、回滚和升级说明
- [ ] 完成 Oracle Cloud / 微信云托管部署配置
- [ ] 完成上线前数据、密钥和日志检查

## 6. EF Core Migration 待办记录

### 当前状态

当前项目在 `Program.cs` 中使用 `Database.EnsureCreatedAsync()`：

- 首次启动时自动创建 SQLite 数据库和数据表。
- 当前不需要执行数据库脚本或 `dotnet ef database update`。
- 适合项目早期开发和接口联调。
- 数据库文件默认位于 `backend/FamilyMenu.Api/family.db`，并已加入 `.gitignore`。

### 后续切换目标

当实体模型和第一版接口结构稳定后，改用 EF Core Migration：

1. 添加 `Microsoft.EntityFrameworkCore.Design` 依赖。
2. 安装或确认 `dotnet-ef` 工具。
3. 创建初始迁移，例如：

   ```powershell
   dotnet ef migrations add InitialCreate
   ```

4. 将迁移文件提交到仓库。
5. 将启动逻辑从 `EnsureCreatedAsync()` 改为执行迁移：

   ```csharp
   await db.Database.MigrateAsync();
   ```

6. 后续模型变更使用新的迁移记录，例如：

   ```powershell
   dotnet ef migrations add AddDishRating
   dotnet ef database update
   ```

### 切换时的注意事项

- 不要在已有正式数据库上直接删除 `family.db`。
- 切换前需要备份 SQLite 数据库。
- 需要检查现有 `EnsureCreated` 创建的数据库与迁移初始快照是否兼容。
- 生产环境部署时应明确执行迁移的时机，并准备失败回滚方案。
- 完成迁移后，更新 `.REMED` 和本节状态，删除“不需要执行数据库脚本”的旧说明。

### 验收标准

- 新环境可以通过 `dotnet ef database update` 创建完整数据库。
- 现有数据库可以平滑升级，不丢失用户、家庭、菜品和点餐数据。
- 应用启动不再依赖 `EnsureCreatedAsync()`。
- 初始迁移和后续迁移文件已纳入 Git。

## 3. 第一阶段的后端设计

### 3.1 项目结构

```text
backend/FamilyMenu.Api/
├── Controllers/
│   ├── AuthController.cs
│   ├── FamilyController.cs
│   ├── DishesController.cs
│   └── OrdersController.cs
├── Data/
│   └── AppDbContext.cs
├── Hubs/
│   └── FamilyHub.cs
├── Models/
│   ├── Entities/
│   └── Dtos/
├── Services/
│   ├── AuthService.cs
│   ├── FamilyService.cs
│   ├── DishService.cs
│   └── OrderService.cs
├── Options/
│   └── AuthenticationOptions.cs
├── Program.cs
├── appsettings.json
└── appsettings.Development.json
```

### 3.2 API 约定

- 基础路径：`/api`
- 需要登录的 API 使用 `Authorization: Bearer <JWT>`
- 未加入家庭的用户只能访问认证和家庭加入相关接口
- 所有家庭数据按当前用户的 `FamilyId` 隔离
- 家庭默认最多两名成员
- 变更菜品时广播 `DishChanged`
- 变更点餐时广播 `OrderChanged`
- SignalR 地址：`/hubs/family`

### 3.3 本地登录约定

开发环境允许用 `openId` 直接模拟微信登录，便于在没有微信 AppID/AppSecret 时调试。生产环境必须提供 `code`，由服务端调用微信 `jscode2session` 获取 `openid`；生产环境不接受客户端直接传入的 `openId`。

示例请求：

```json
POST /api/auth/login
{
  "openId": "local-user-a",
  "nickName": "用户 A"
}
```

### 3.4 数据一致性策略

- 家庭加入使用数据库事务并检查成员数量
- 点餐项只能引用同一家庭的菜品
- 清空今日点餐将当前订单和明细标记为取消，保留历史可追溯性
- 服务启动时在本地自动创建 SQLite 数据库；后续阶段补充正式 EF Core Migration

## 4. 验收清单

后端阶段完成的最低标准：

1. 在 `backend/FamilyMenu.Api` 执行 `dotnet build` 成功。
2. 启动后健康检查返回成功。
3. 可以用开发登录获得 JWT。
4. 两个开发用户可以创建/加入同一个家庭。
5. 菜品和点餐 API 只能访问当前家庭数据。
6. SQLite 文件能够在本地自动创建。
7. SignalR Hub 能够鉴权并加入家庭组。
8. `.REMED` 和 `.gitignore` 不包含真实密钥或本地数据库。

## 5. 当前进度记录

### 2026-09-20

- 已读取并对齐 `docs/项目设计文档.md`。
- 已确认仓库当前包含后端项目和空的 `miniprogram` 目录。
- 已创建本实施计划。
- 已完成阶段一后端项目、阶段二 `.REMED` 和 `.gitignore`。
- 已通过 `dotnet build --no-restore`。
- 已通过健康检查、开发登录、家庭创建/加入、菜品创建/喜欢、今日点餐、清空和历史记录冒烟测试。
- 注意：当前构建存在 NuGet 审计警告（Microsoft.OpenApi 2.0.0 和 SQLitePCLRaw.lib.e_sqlite3 2.1.11），后续联网条件稳定时应升级并复核依赖版本。
- 已完成阶段三：微信 `jscode2session` 使用命名 HttpClient、5 秒超时和脱敏日志；生产环境强制配置 JWT/微信/CORS，开发 `openId` 回退保持隔离。
- 已加入登录限流、安全响应头、HTTPS/HSTS、统一 ProblemDetails 错误响应和登录/邀请码/菜品/日期输入校验。
- 已验证 Development 登录、`/api/auth/me`、空请求校验和 `/health`；Production 缺少密钥或 CORS 配置时会拒绝启动。

### 2026-09-21

- 已创建微信小程序基础工程，新增 `services/api.ts`、`services/auth.ts`、`services/models.ts` 和本地联调配置。
- 已支持 Development `openId` 登录与微信 `wx.login` 两种模式；Token/User 写入本地存储，401 会清理会话并回到登录页。
- 已完成首页今日点餐、菜单分类/搜索/喜欢/快速点餐、菜品新增/编辑、历史记录、家庭创建/邀请码加入/成员查看和登录兜底页面。
- 已在 `miniprogram/package.json` 声明 Vant Weapp 依赖，并在小程序 README 中记录 `npm install` 与微信开发者工具“构建 npm”步骤；当前首批页面使用原生组件，避免未构建 npm 时无法启动。
- 已通过小程序 JSON 配置和页面路由静态检查；后端 `dotnet build` 成功，并完成 `/health`、Development 登录、家庭、菜品、今日点餐和历史接口冒烟联调。
- 当前环境没有微信开发者工具或 TypeScript 编译器，因此尚未完成小程序 IDE 编译、真机网络域名、微信 code 登录和 SignalR 重连验证；这些保留到阶段四后续工作。

### 2026-09-26

- 复核当前检出：工作区无未提交改动；本地 `main` 相对 `origin/main` 领先 1 个提交、落后 1 个提交，本轮未执行同步或切换分支。
- 当前工作树和 `HEAD` 均没有 `.REMED`；已从历史提交 `d388092` 读取本地运行与交付约定，内容要求本地后端使用 `http://localhost:5080`、Development 可用 `openId` 模拟登录，生产必须使用 HTTPS 并通过环境变量配置密钥。
- 静态检查确认 14 个小程序 JSON 文件均可解析，`app.json` 注册的 6 个页面均有对应源文件。
- `package.json` 声明了 `@vant/weapp` `^1.11.7`，但当前没有 `node_modules` 或 `package-lock.json`，页面仍使用原生组件，尚未实际消费 Vant 组件。
- 微信开发者工具已安装；尝试执行官方 CLI `build-npm` 时，CLI 因 IDE 的服务端口关闭而停止，尚未完成 IDE 编译或 npm 构建。需要在微信开发者工具内启用服务端口后重试 CLI，或直接在 IDE 中打开项目完成编译与“构建 npm”。
- 后端 SignalR Hub、JWT 查询参数鉴权、家庭分组和 `DishChanged` / `OrderChanged` 广播已存在；小程序尚无 SignalR 客户端、自动重连或收到事件后的页面刷新。
- 用户确认已在微信开发者工具完成基础工程编译和 Vant npm 构建。本次新增 SignalR 依赖后再次尝试 CLI 重建，仍因服务端口关闭而未能生成新的 `miniprogram_npm` 产物。
- 通过 npm 安装官方 `@microsoft/signalr` 10.0.11，审计结果为 0 个漏洞；`package.json` 和 `package-lock.json` 已更新。
- 新增 `services/realtime.ts`：通过 `wx.connectSocket` 适配 SignalR WebSocket，使用 JWT、自动重连及指数退避；重连成功后刷新当前已订阅的数据。首页订阅菜品和点餐变更，菜单页订阅菜品变更，历史页订阅点餐变更；切后台断开、回前台重连，退出登录或 API 返回 401 时停止连接。
- 在隔离的临时 SQLite 数据库上完成 API/SignalR 冒烟联调：第二个家庭成员使用查询参数 JWT 建立直连 WebSocket，收到另一成员触发的 `DishChanged` 和 `OrderChanged` 事件。临时数据库已清理。
- 新增客户端相关源文件通过定向 TypeScript 检查。全项目 `tsc` 目前仍会报已有导航栏/日志页类型问题及微信类型声明重复，因此全项目检查不能作为本次改动的通过标准。
- 后续在微信开发者工具中重新执行“工具 → 构建 npm”并编译 SignalR 客户端，再进行模拟器/真机的断线重连与实时刷新验证。
