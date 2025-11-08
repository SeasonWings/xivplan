# FFXIV Raid Planner WebSocket服务器

这是Final Fantasy XIV Raid Planner的多人协作功能后端服务器。

## 功能

- WebSocket服务器，支持多人实时协作
- 房间管理系统
- 用户会话管理
- 场景数据同步
- 聊天功能支持

## 运行说明

### 1. 安装依赖

```bash
npm install
# 或者使用pnpm
pnpm install
```

### 2. 启动服务器

```bash
node server.js
```

默认端口为3000。可以通过环境变量更改：

```bash
PORT=8080 node server.js
```

### 3. 生产环境部署

对于生产环境，建议使用PM2等进程管理工具：

```bash
# 安装PM2
npm install -g pm2

# 使用PM2启动服务器
pm run start:prod
```

或者直接：

```bash
pm install -g pm2
pm install
pm install ws
pm install nodemon --save-dev
npm run dev
```