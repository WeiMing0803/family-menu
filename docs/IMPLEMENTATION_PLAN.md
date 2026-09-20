# 家庭点餐小程序实施计划

> 依据：`docs/项目设计文档.md` v1.0  
> 当前状态：阶段三完成，准备进入前后端联调
> 更新时间：2026-09-20

## 1. 目标与边界

本项目先交付一个可以独立运行、可以用 HTTP 调试、可以被微信小程序继续接入的 ASP.NET Core 10 Web API。第一版后端覆盖设计文档中定义的核心闭环：登录、家庭关系、菜品管理、今日点餐、历史记录和 SignalR 实时通知。

本轮不实现小程序页面、图片上传、生产部署脚本和微信云托管配置。这些内容会在后续阶段接入，后端会预留配置和接口边界。

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

- [ ] 根据接口返回结构接入微信小程序
- [ ] 接入 Vant Weapp 页面和家庭/菜单/点餐交互
- [ ] 接入 SignalR 客户端重连和变更刷新
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
