// 加载环境变量
require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { testConnection } = require('./db');
const { testEmailConnection } = require('./email');
const communityRoutes = require('./routes/community');
const authRoutes = require('./routes/auth');
const feedbackRoutes = require('./routes/feedback');
const logger = require('./services/logger');
const promClient = require('prom-client');

// 创建Express应用
const app = express();

// 跨域配置
app.use((req, res, next) => {
    // 设置CORS响应头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    logger.log('debug', 'http', 'http.cors', {
        method: req.method,
        url: req.url,
        origin: req.headers.origin || 'no-origin',
    });

    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        logger.log('debug', 'http', 'http.cors_preflight', { method: req.method, url: req.url });
        return res.status(200).end();
    }

    next();
});
// 中间件配置
app.use(bodyParser.json({ limit: '50mb' })); // 支持大文件上传
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(logger.createMiddleware());

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/feedback', feedbackRoutes);

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

promClient.collectDefaultMetrics({ prefix: 'xivplan_' });
const cursorSyncDelaySeconds = new promClient.Histogram({
    name: 'cursor_sync_delay_seconds',
    help: 'Cursor relay delay in seconds (server receive -> server broadcast)',
    labelNames: ['room_id'],
    buckets: [0.005, 0.01, 0.02, 0.05, 0.08, 0.12, 0.2, 0.5, 1],
});

const cursorLostPacketsTotal = new promClient.Counter({
    name: 'cursor_lost_packets_total',
    help: 'Estimated lost cursor packets (sequence gaps) observed by server',
    labelNames: ['room_id'],
});

app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});

// 静态文件服务(开发环境)
app.use(express.static(path.join(__dirname, 'dist')));

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({
    server,
    perMessageDeflate: {
        zlibDeflateOptions: {
            level: 3,
        },
        zlibInflateOptions: {},
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        concurrencyLimit: 10,
        threshold: 1024,
    },
});

// 房间管理
const rooms = new Map();

class Room {
    constructor(id) {
        this.id = id;
        this.clients = new Set();
        this.hostId = null; // 房主ID
        this.sceneData = null;
        this.snapshotSeq = 0;
        this.sceneSeq = 0;
        this.actionLog = [];
        this.lastUpdated = Date.now();
        this.allowGuestEdit = true; // 默认允许访客编辑
        this.userEditPermissions = new Map(); // 用户编辑权限映射
        this.nextShortId = 1;
        this.cursorPackets = new Map(); // shortId -> { payload: Buffer, recvAt: number }
        this.cursorFecGroupId = 1;
        this.cursorFecIndex = 0;
        this.cursorFecBatches = [];
    }

    addClient(client) {
        let candidate = this.nextShortId;
        const used = new Set(
            Array.from(this.clients)
                .map((c) => c.shortId)
                .filter((x) => typeof x === 'number'),
        );
        while (used.has(candidate)) {
            candidate = (candidate % 255) + 1;
        }
        client.shortId = candidate;
        this.nextShortId = (candidate % 255) + 1;
        this.clients.add(client);
        client.roomId = this.id;

        // 确保第一个加入的用户（创建者）总是房主
        if (!this.hostId) {
            this.hostId = client.userId;
            logger.ws('info', 'ws.room.host_assigned', {
                connId: client.connId,
                roomId: this.id,
                hostId: this.hostId,
                userId: client.userId,
                userName: client.userName,
            });
        }

        // 设置用户编辑权限：房主默认有编辑权限，其他用户默认没有编辑权限
        this.userEditPermissions.set(client.userId, client.userId === this.hostId);

        // 向新加入的客户端发送当前房间的场景数据
        if (this.sceneData) {
            client.send(
                JSON.stringify({
                    type: 'scene_sync',
                    data: this.sceneData,
                    seq: this.snapshotSeq || 0,
                }),
            );
        }

        if (this.actionLog && this.actionLog.length > 0) {
            client.send(
                JSON.stringify({
                    type: 'scene_action_log',
                    fromSeq: this.snapshotSeq || 0,
                    actions: this.actionLog,
                }),
            );
        }

        // 立即发送房主信息给新加入的客户端
        client.send(
            JSON.stringify({
                type: 'host_info',
                hostId: this.hostId,
            }),
        );

        // 发送用户权限列表给新加入的客户端
        this.sendUserPermissions(client);

        // 广播用户加入事件
        this.broadcast(
            JSON.stringify({
                type: 'user_joined',
                userId: client.userId,
                users: Array.from(this.clients).map((c) => ({
                    id: c.userId,
                    name: c.userName,
                    avatar: c.userAvatar,
                    canEdit: this.userEditPermissions.get(c.userId) || false,
                    shortId: c.shortId,
                })),
            }),
            client,
        );
    }

    removeClient(client) {
        const isHost = client.userId === this.hostId;
        this.clients.delete(client);

        // 如果离开的是房主且还有其他用户，自动将房主身份传给第一个用户
        if (isHost && this.clients.size > 0) {
            const newHost = Array.from(this.clients)[0];
            this.hostId = newHost.userId;

            // 更新新房主的编辑权限为true
            this.userEditPermissions.set(this.hostId, true);

            // 广播房主变更事件
            this.broadcast(
                JSON.stringify({
                    type: 'host_changed',
                    hostId: this.hostId,
                }),
            );

            // 重新广播用户权限列表
            this.clients.forEach((client) => {
                this.sendUserPermissions(client);
            });
        }

        // 广播用户离开事件
        this.broadcast(
            JSON.stringify({
                type: 'user_left',
                userId: client.userId,
                users: Array.from(this.clients).map((c) => ({
                    id: c.userId,
                    name: c.userName,
                    avatar: c.userAvatar,
                    canEdit: this.userEditPermissions.get(c.userId) || false,
                    shortId: c.shortId,
                })),
            }),
        );

        // 如果房间为空，清理房间
        if (this.clients.size === 0) {
            rooms.delete(this.id);
        }
    }

    broadcast(message, excludeClient = null) {
        for (const client of this.clients) {
            if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
    }

    // 发送用户权限列表给指定客户端
    sendUserPermissions(client) {
        const permissions = {};
        this.userEditPermissions.forEach((canEdit, userId) => {
            permissions[userId] = canEdit;
        });

        client.send(
            JSON.stringify({
                type: 'user_permissions',
                permissions: permissions,
            }),
        );
    }

    // 设置用户编辑权限
    setUserEditPermission(userId, canEdit) {
        // 房主权限不能被修改
        if (userId === this.hostId) {
            return false;
        }

        this.userEditPermissions.set(userId, canEdit);

        // 广播权限变更
        this.broadcast(
            JSON.stringify({
                type: 'user_permission_changed',
                userId: userId,
                canEdit: canEdit,
            }),
        );

        return true;
    }

    updateScene(data, sender) {
        // 检查发送者是否有编辑权限
        if (!this.userEditPermissions.get(sender.userId)) {
            // 发送错误消息给发送者
            sender.send(
                JSON.stringify({
                    type: 'error',
                    message: '您没有权限编辑场景',
                }),
            );
            return;
        }

        this.sceneData = data;
        this.snapshotSeq = this.sceneSeq;
        this.actionLog = [];
        this.lastUpdated = Date.now();

        // 广播场景更新
        this.broadcast(
            JSON.stringify({
                type: 'scene_update',
                data: data,
                senderId: sender.userId,
            }),
            sender,
        );
    }

    onCursorPacket(sender, payload, seq) {
        const now = Date.now();
        const flags = payload && payload.length > 0 ? payload.readUInt8(0) : 0;
        const isKeepalive = (flags & 0x02) !== 0;
        const prev = this.cursorPackets.get(sender.shortId);
        const activeAt = prev ? prev.activeAt : now;
        this.cursorPackets.set(sender.shortId, {
            payload,
            recvAt: now,
            activeAt: isKeepalive ? activeAt : now,
            senderId: sender.userId,
            seq,
        });
    }
}

// 生成唯一ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// WebSocket连接处理
wss.on('connection', (ws, req) => {
    // 生成用户ID
    ws.userId = generateId();
    ws.userName = `User_${Math.floor(Math.random() * 1000)}`;
    ws.userAvatar = null;
    ws.connId = logger.generateId('ws');

    logger.ws('info', 'ws.connection.open', {
        connId: ws.connId,
        userId: ws.userId,
        ip: req?.socket?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
    });

    // 发送用户信息给客户端
    ws.send(
        JSON.stringify({
            type: 'user_info',
            userId: ws.userId,
            userName: ws.userName,
            userAvatar: ws.userAvatar,
        }),
    );

    // 消息处理
    ws.on('message', (message, isBinary) => {
        try {
            if (isBinary) {
                const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
                if (buf.length >= 1 && buf[0] === 0xc1) {
                    if (ws.roomId) {
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            if (buf.length !== 28) {
                                return;
                            }
                            const seq = buf.readUInt16LE(2);
                            const prevSeq = ws.lastCursorSeq;
                            if (typeof prevSeq === 'number') {
                                const diff = (seq - prevSeq - 1 + 65536) % 65536;
                                if (diff > 0 && diff < 32768) {
                                    cursorLostPacketsTotal.inc({ room_id: ws.roomId }, diff);
                                }
                            }
                            ws.lastCursorSeq = seq;
                            room.onCursorPacket(ws, buf.subarray(1), seq);
                        }
                    }
                }
                return;
            }

            const text = typeof message === 'string' ? message : Buffer.from(message).toString('utf8');
            const data = JSON.parse(text);

            switch (data.type) {
                case 'ping':
                    // 收到客户端心跳，回复pong
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;

                case 'join_room':
                    logger.ws('info', 'ws.room.join_request', {
                        connId: ws.connId,
                        userId: ws.userId,
                        roomId: data.roomId,
                    });
                    const roomId = data.roomId || generateId();
                    let room = rooms.get(roomId);
                    const isNewRoom = !room;

                    if (isNewRoom) {
                        room = new Room(roomId);
                        rooms.set(roomId, room);
                        logger.ws('info', 'ws.room.created', { connId: ws.connId, userId: ws.userId, roomId: roomId });
                    }

                    // 如果用户已在其他房间，先离开
                    if (ws.roomId) {
                        const oldRoom = rooms.get(ws.roomId);
                        if (oldRoom) {
                            oldRoom.removeClient(ws);
                        }
                    }

                    // 添加客户端到房间
                    room.addClient(ws);

                    // 如果是新房间，确保房主信息被正确设置并广播
                    if (isNewRoom && room.hostId) {
                        logger.ws('info', 'ws.room.host_info_broadcast', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: roomId,
                            hostId: room.hostId,
                        });
                        // 再次明确地向所有客户端广播房主信息
                        room.broadcast(
                            JSON.stringify({
                                type: 'host_info',
                                hostId: room.hostId,
                            }),
                        );
                    }

                    // 发送房间信息
                    ws.send(
                        JSON.stringify({
                            type: 'room_joined',
                            roomId: roomId,
                            shortId: ws.shortId,
                        }),
                    );

                    logger.ws('info', 'ws.room.joined', {
                        connId: ws.connId,
                        userId: ws.userId,
                        roomId: roomId,
                        shortId: ws.shortId,
                        isNewRoom,
                    });
                    break;

                case 'update_scene':
                    if (ws.roomId) {
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            // 验证权限：检查用户是否有编辑权限
                            if (room.userEditPermissions.get(ws.userId)) {
                                room.updateScene(data.scene, ws);
                            } else {
                                logger.ws('warn', 'ws.scene.update_rejected', {
                                    connId: ws.connId,
                                    userId: ws.userId,
                                    roomId: ws.roomId,
                                    reason: 'no_permission',
                                });
                                ws.send(
                                    JSON.stringify({
                                        type: 'error',
                                        message: '您没有权限编辑场景，房主已禁用访客编辑功能',
                                    }),
                                );
                            }
                        }
                    }
                    break;

                case 'scene_action':
                    if (ws.roomId && data.action) {
                        logger.ws('info', 'ws.scene.action', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: ws.roomId,
                            actionType: data.action?.type,
                            transient: !!data.action?.transient,
                        });
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            if (!room.userEditPermissions.get(ws.userId)) {
                                ws.send(
                                    JSON.stringify({
                                        type: 'error',
                                        message: '您没有权限编辑场景',
                                    }),
                                );
                                break;
                            }

                            room.sceneSeq = (room.sceneSeq || 0) + 1;
                            const entry = { seq: room.sceneSeq, senderId: ws.userId, action: data.action };
                            if (!data.action.transient) {
                                room.actionLog.push(entry);
                            }
                            room.lastUpdated = Date.now();

                            room.broadcast(
                                JSON.stringify({
                                    type: 'scene_action',
                                    ...entry,
                                }),
                            );
                        }
                    }
                    break;

                case 'scene_snapshot':
                    if (ws.roomId && data.scene) {
                        let snapshotBytes = 0;
                        try {
                            snapshotBytes = Buffer.byteLength(JSON.stringify(data.scene));
                        } catch {}
                        logger.ws('info', 'ws.scene.snapshot', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: ws.roomId,
                            seq: typeof data.seq === 'number' ? data.seq : undefined,
                            bytes: snapshotBytes,
                        });
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            if (!room.userEditPermissions.get(ws.userId)) {
                                ws.send(
                                    JSON.stringify({
                                        type: 'error',
                                        message: '您没有权限编辑场景',
                                    }),
                                );
                                break;
                            }

                            room.sceneData = data.scene;
                            const seq = typeof data.seq === 'number' ? data.seq : room.sceneSeq || 0;
                            room.snapshotSeq = seq;
                            room.actionLog = room.actionLog.filter((x) => x.seq > seq);
                            room.lastUpdated = Date.now();
                        }
                    }
                    break;

                case 'set_user_name':
                    if (data.name && data.name.trim()) {
                        const oldName = ws.userName;
                        ws.userName = data.name.trim();

                        if (ws.roomId) {
                            const room = rooms.get(ws.roomId);
                            if (room) {
                                room.broadcast(
                                    JSON.stringify({
                                        type: 'user_name_changed',
                                        userId: ws.userId,
                                        oldName: oldName,
                                        newName: ws.userName,
                                        users: Array.from(room.clients).map((c) => ({
                                            id: c.userId,
                                            name: c.userName,
                                            avatar: c.userAvatar,
                                            canEdit: room.userEditPermissions.get(c.userId) || false,
                                            shortId: c.shortId,
                                        })),
                                    }),
                                );
                            }
                        }
                    }
                    break;

                case 'set_user_profile': {
                    const newName = typeof data.name === 'string' ? data.name.trim() : '';
                    const hasAvatar = Object.prototype.hasOwnProperty.call(data, 'avatar');
                    const newAvatar =
                        hasAvatar && typeof data.avatar === 'string'
                            ? data.avatar.trim() || null
                            : hasAvatar
                              ? null
                              : undefined;

                    logger.ws('info', 'ws.user.profile', {
                        connId: ws.connId,
                        userId: ws.userId,
                        roomId: ws.roomId,
                        name: newName || undefined,
                        hasAvatar: hasAvatar,
                    });

                    const oldName = ws.userName;
                    let changed = false;
                    if (newName) {
                        ws.userName = newName;
                        changed = true;
                    }
                    if (hasAvatar) {
                        ws.userAvatar = newAvatar;
                        changed = true;
                    }

                    if (changed && ws.roomId) {
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            room.broadcast(
                                JSON.stringify({
                                    type: 'user_name_changed',
                                    userId: ws.userId,
                                    oldName: oldName,
                                    newName: ws.userName,
                                    users: Array.from(room.clients).map((c) => ({
                                        id: c.userId,
                                        name: c.userName,
                                        avatar: c.userAvatar,
                                        canEdit: room.userEditPermissions.get(c.userId) || false,
                                        shortId: c.shortId,
                                    })),
                                }),
                            );
                        }
                    }
                    break;
                }

                case 'chat_message':
                    if (ws.roomId && data.message && data.message.trim()) {
                        logger.ws('info', 'ws.chat.message', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: ws.roomId,
                            length: String(data.message).length,
                        });
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            room.broadcast(
                                JSON.stringify({
                                    type: 'chat_message',
                                    userId: ws.userId,
                                    userName: ws.userName,
                                    userAvatar: ws.userAvatar,
                                    message: data.message.trim(),
                                    timestamp: Date.now(),
                                }),
                            );
                        }
                    }
                    break;

                case 'transfer_host':
                    if (ws.roomId && data.newHostId) {
                        const room = rooms.get(ws.roomId);
                        logger.ws('info', 'ws.room.transfer_host', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: ws.roomId,
                            newHostId: data.newHostId,
                        });

                        // 只有当前房主可以移交权限
                        if (!room) {
                            logger.ws('warn', 'ws.room.transfer_host_failed', {
                                connId: ws.connId,
                                userId: ws.userId,
                                roomId: ws.roomId,
                                reason: 'room_not_found',
                            });
                        } else if (ws.userId !== room.hostId) {
                            logger.ws('warn', 'ws.room.transfer_host_failed', {
                                connId: ws.connId,
                                userId: ws.userId,
                                roomId: ws.roomId,
                                reason: 'not_host',
                            });
                        } else {
                            // 检查新房主是否在房间内
                            const newHostClient = Array.from(room.clients).find((c) => c.userId === data.newHostId);
                            if (!newHostClient) {
                                logger.ws('warn', 'ws.room.transfer_host_failed', {
                                    connId: ws.connId,
                                    userId: ws.userId,
                                    roomId: ws.roomId,
                                    newHostId: data.newHostId,
                                    reason: 'target_not_in_room',
                                });
                            } else {
                                const oldHostId = room.hostId;
                                room.hostId = data.newHostId;
                                logger.ws('info', 'ws.room.transfer_host_succeeded', {
                                    connId: ws.connId,
                                    userId: ws.userId,
                                    roomId: ws.roomId,
                                    oldHostId,
                                    newHostId: data.newHostId,
                                });

                                // 更新新房主的编辑权限为true
                                room.userEditPermissions.set(room.hostId, true);

                                // 同时发送host_changed和host_info事件，确保所有客户端都能正确更新房主状态
                                const hostChangedMessage = JSON.stringify({
                                    type: 'host_changed',
                                    hostId: room.hostId,
                                    oldHostId: oldHostId,
                                    roomId: ws.roomId,
                                });

                                const hostInfoMessage = JSON.stringify({
                                    type: 'host_info',
                                    hostId: room.hostId,
                                    roomId: ws.roomId,
                                });

                                logger.ws('info', 'ws.room.host_broadcast', {
                                    connId: ws.connId,
                                    userId: ws.userId,
                                    roomId: ws.roomId,
                                    clients: room.clients.size,
                                });
                                room.broadcast(hostChangedMessage);
                                room.broadcast(hostInfoMessage);

                                // 重新广播用户权限列表
                                room.clients.forEach((client) => {
                                    room.sendUserPermissions(client);
                                });
                            }
                        }
                    } else {
                        logger.ws('warn', 'ws.room.transfer_host_failed', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: ws.roomId,
                            reason: 'missing_params',
                        });
                    }
                    break;

                // 处理设置用户编辑权限
                case 'set_user_edit_permission':
                    if (ws.roomId) {
                        const room = rooms.get(ws.roomId);
                        if (room && ws.userId === room.hostId) {
                            const result = room.setUserEditPermission(data.userId, Boolean(data.canEdit));
                            logger.ws('info', 'ws.room.user_edit_permission', {
                                connId: ws.connId,
                                userId: ws.userId,
                                roomId: room.id,
                                targetUserId: data.userId,
                                canEdit: Boolean(data.canEdit),
                                ok: result,
                            });

                            if (!result) {
                                // 发送错误消息给请求者
                                ws.send(
                                    JSON.stringify({
                                        type: 'error',
                                        message: '无法修改房主的编辑权限',
                                    }),
                                );
                            }
                        } else {
                            logger.ws('warn', 'ws.room.user_edit_permission_rejected', {
                                connId: ws.connId,
                                userId: ws.userId,
                                roomId: ws.roomId,
                                reason: 'not_host',
                            });
                            // 发送错误消息给请求者
                            ws.send(
                                JSON.stringify({
                                    type: 'error',
                                    message: '只有房主可以设置用户编辑权限',
                                }),
                            );
                        }
                    }
                    break;
                default:
                    logger.ws('warn', 'ws.message.unknown', {
                        connId: ws.connId,
                        userId: ws.userId,
                        roomId: ws.roomId,
                        type: data.type,
                    });
                    break;
            }
        } catch (error) {
            logger.ws('error', 'ws.message.error', {
                connId: ws.connId,
                userId: ws.userId,
                roomId: ws.roomId,
                error: { name: error.name, message: error.message, stack: error.stack },
            });
        }
    });

    // 连接关闭处理
    ws.on('close', (code, reason) => {
        logger.ws('info', 'ws.connection.close', {
            connId: ws.connId,
            userId: ws.userId,
            roomId: ws.roomId,
            code,
            reason: reason ? reason.toString() : undefined,
        });

        if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.removeClient(ws);
            }
        }
    });

    // 错误处理
    ws.on('error', (error) => {
        logger.ws('error', 'ws.connection.error', {
            connId: ws.connId,
            userId: ws.userId,
            roomId: ws.roomId,
            error: { name: error.name, message: error.message, stack: error.stack },
        });
    });
});

function buildCursorBatch(room) {
    const ACTIVE_MS = parseInt(process.env.CURSOR_ACTIVE_MS || '300', 10);
    const PURGE_MS = parseInt(process.env.CURSOR_PURGE_MS || '5000', 10);
    const now = Date.now();
    const records = [];
    const toDelete = [];
    room.cursorPackets.forEach((v, shortId) => {
        if (!v) return;
        if (now - v.recvAt > PURGE_MS) {
            toDelete.push(shortId);
            return;
        }
        const activeAt = typeof v.activeAt === 'number' ? v.activeAt : v.recvAt;
        if (now - activeAt > ACTIVE_MS) {
            return;
        }
        records.push({ shortId, payload: v.payload, recvAt: v.recvAt });
    });
    for (const id of toDelete) {
        room.cursorPackets.delete(id);
    }
    if (records.length === 0) return null;

    const recordSize = 1 + 1 + 2 + 8 + 16;
    const headerSize = 1 + 2 + 1 + 1;
    const buf = Buffer.allocUnsafe(headerSize + records.length * recordSize);
    let offset = 0;
    buf[offset++] = 0xd1;
    buf.writeUInt16LE(room.cursorFecGroupId, offset);
    offset += 2;
    buf[offset++] = room.cursorFecIndex;
    buf[offset++] = records.length;

    for (const r of records) {
        buf[offset++] = r.shortId & 0xff;
        buf[offset++] = r.payload.readUInt8(0);
        buf.writeUInt16LE(r.payload.readUInt16LE(1), offset);
        offset += 2;
        r.payload.copy(buf, offset, 3, 3 + 8 + 16);
        offset += 8 + 16;
        const delaySeconds = (Date.now() - r.recvAt) / 1000;
        cursorSyncDelaySeconds.observe({ room_id: room.id }, delaySeconds);
    }

    return buf;
}

function buildCursorFecParity(room, b0, b1, b2) {
    const maxLen = Math.max(b0.length, b1.length, b2.length);
    const parity = Buffer.allocUnsafe(maxLen);
    parity.fill(0);
    for (let i = 0; i < maxLen; i++) {
        const v0 = i < b0.length ? b0[i] : 0;
        const v1 = i < b1.length ? b1[i] : 0;
        const v2 = i < b2.length ? b2[i] : 0;
        parity[i] = v0 ^ v1 ^ v2;
    }

    const header = Buffer.allocUnsafe(1 + 2 + 6);
    header[0] = 0xd2;
    header.writeUInt16LE(room.cursorFecGroupId, 1);
    header.writeUInt16LE(b0.length, 3);
    header.writeUInt16LE(b1.length, 5);
    header.writeUInt16LE(b2.length, 7);
    return Buffer.concat([header, parity]);
}

setInterval(() => {
    rooms.forEach((room) => {
        if (room.clients.size === 0) return;
        const batch = buildCursorBatch(room);
        if (!batch) return;
        room.cursorFecBatches[room.cursorFecIndex] = batch;

        for (const client of room.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(batch);
            }
        }

        room.cursorFecIndex++;
        if (room.cursorFecIndex >= 3) {
            const b0 = room.cursorFecBatches[0];
            const b1 = room.cursorFecBatches[1];
            const b2 = room.cursorFecBatches[2];
            if (b0 && b1 && b2) {
                const parity = buildCursorFecParity(room, b0, b1, b2);
                for (const client of room.clients) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(parity);
                    }
                }
            }
            room.cursorFecIndex = 0;
            room.cursorFecGroupId = (room.cursorFecGroupId + 1) % 65536;
            if (room.cursorFecGroupId === 0) room.cursorFecGroupId = 1;
            room.cursorFecBatches = [];
        }
    });
}, 20);

// 启动服务器
const PORT = process.env.PORT || 3001;

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        logger.log('error', 'server', 'server.listen_failed', { port: PORT, code: err.code, message: err.message });
    } else {
        logger.log('error', 'server', 'server.error', {
            port: PORT,
            error: { name: err.name, message: err.message, stack: err.stack },
        });
    }
    process.exit(1);
});

wss.on('error', (err) => {
    logger.log('error', 'ws', 'ws.server.error', { error: { name: err.name, message: err.message, stack: err.stack } });
});

// 测试数据库连接
testConnection().then((connected) => {
    if (!connected) {
        logger.log('warn', 'db', 'db.connection_failed', { feature: 'community' });
    }
});

// 测试邮件服务连接
testEmailConnection().then((connected) => {
    if (!connected) {
        logger.log('warn', 'email', 'email.connection_failed', { feature: 'email' });
    }
});

server.listen(PORT, () => {
    logger.log('info', 'server', 'server.listen', { port: PORT });
    logger.log('info', 'server', 'server.endpoints', {
        websocket: `ws://localhost:${PORT}`,
        api: `http://localhost:${PORT}/api`,
        metrics: `http://localhost:${PORT}/metrics`,
    });
});

// 定期清理长时间未活跃的房间（超过1小时）
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (now - room.lastUpdated > 3600000 && room.clients.size === 0) {
            rooms.delete(roomId);
            logger.ws('info', 'ws.room.cleanup', { roomId });
        }
    });
}, 300000); // 每5分钟检查一次
