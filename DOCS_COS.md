# COS 图片 URL 替换系统配置说明

本系统旨在将前端使用的图片资源（如职业图标、场景背景、标记等）统一替换为腾讯云 COS（对象存储）URL。

## 1. 系统架构

- **后端**: 负责管理 COS 配置（Base URL 和 启用状态）。支持通过环境变量配置初始值，并提供 API 供管理员获取配置。
- **前端**: 在应用启动时从后端获取 COS 配置。如果获取失败，则不启用 COS 替换。
- **动态替换**: 前端所有图片引用均通过 `wrapImageUrl` 工具函数处理，根据配置动态生成 COS URL 或保留本地路径。

## 2. 后端配置

### 2.1 环境变量 (.env)

在 `backend/.env` 中配置以下项：

```bash
# 腾讯云 COS 基础配置
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket
COS_REGION=ap-shanghai

# COS 访问域名（用于图片 URL 替换）
COS_BASE_URL=https://your-cos-bucket-url.cos.ap-shanghai.myqcloud.com
```

## 3. 代码中使用

在前端代码中，使用 `wrapImageUrl` 处理图片路径：

```typescript
import { wrapImageUrl } from './util/cos';

const iconUrl = wrapImageUrl('/actor/DRK.png');
// 如果 COS 启用，返回: https://cos-url.com/actor/DRK.png
// 如果 COS 禁用，返回: /actor/DRK.png
```

## 4. 降级与错误处理

1. **后端 API 不可用**: 前端将捕获异常，COS 替换将不会启用，系统将继续使用本地资源。
2. **COS 服务不可用**: 如果 COS 存储本身出现故障，建议在后端通过管理接口将 `enabled` 设为 `false`，系统将立即降级使用本地资源（前提是本地 `public` 目录下存有相同资源）。
3. **配置更新**: 配置更改后，前端刷新页面即可生效。

## 5. 测试

- **前端测试**: `npm test src/util/cos.test.ts`
- **后端测试**: `npx jest backend/test/integration/config.test.js`
