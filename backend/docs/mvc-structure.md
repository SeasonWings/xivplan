# 后端 MVC 目录结构

本后端采用分层结构，核心原则：

- Controller 只处理请求/响应编排，不直接访问数据库
- Service 承载业务规则与跨实体流程
- Model/Repository 统一封装数据库访问
- View 仅负责 DTO/VO 组装与响应格式
- 中间件按功能拆分并可注入依赖

## 目录

- business/
  - config/：环境配置读取
  - controllers/：HTTP Controller（Express handler）
  - docs/：OpenAPI 生成
  - di/：依赖注入容器
  - errors/：统一异常类型
  - external/：外部系统封装（邮件等）
  - http/：HTTP 应用组装
  - middleware/：鉴权/权限/异常等中间件
  - models/：Repository/DAO
  - routes/：路由装配（将 Controller + 中间件组合）
  - services/：业务服务
  - views/：DTO/VO 与响应格式
  - ws/：WebSocket 模块

## 入口

- app.js：创建容器、组装 HTTP + WS、启动 server
- /api/openapi.json：OpenAPI JSON
- /api/docs：Swagger UI（CDN）

