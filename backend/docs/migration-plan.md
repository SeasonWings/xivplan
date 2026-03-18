# 迁移计划（零回归）

## 目标

- 在不改变现有对外接口行为的前提下，将后端整体重构为 MVC
- 通过测试锁定行为，确保每次迁移后全量测试通过

## 步骤

1. 建立 MVC 基础设施
   - DI 容器、统一异常、中间件、HTTP 装配
   - OpenAPI 输出入口
2. 先补集成测试锁定行为
   - 覆盖 `/api/health`、`/api/openapi.json`、核心业务接口的成功/失败路径
3. 分模块迁移
   - 每迁移一个模块：路由切换到新 Controller，旧实现保留但不再作为入口
   - 迁移后：运行 `pnpm test` 确认零回归
4. Model 单元测试覆盖率门禁
   - 对 `business/models` 维持覆盖率阈值（lines/functions/statements ≥ 80%）
5. 上线前检查
   - 预生产环境回归 + 指标观测（/metrics）

