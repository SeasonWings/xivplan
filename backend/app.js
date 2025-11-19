const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 简单的文件服务，用于开发环境
    const filePath = path.join(__dirname, req.url === '/' ? '/dist/index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = 'text/html';

    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpeg';
            break;
        case '.svg':
            contentType = 'image/svg+xml';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 房间管理
const rooms = new Map();

class Room {
    constructor(id) {
        this.id = id;
        this.clients = new Set();
        this.hostId = null; // 房主ID
        this.sceneData = null;
        this.lastUpdated = Date.now();
        this.allowGuestEdit = true; // 默认允许访客编辑
        this.userEditPermissions = new Map(); // 用户编辑权限映射
    }

    addClient(client) {
        this.clients.add(client);
        client.roomId = this.id;

        // 确保第一个加入的用户（创建者）总是房主
        if (!this.hostId) {
            this.hostId = client.userId;
            console.log(`User ${client.userId} (${client.userName}) set as host for room ${this.id}`);
        }

        // 设置用户编辑权限：房主默认有编辑权限，其他用户默认没有编辑权限
        this.userEditPermissions.set(client.userId, client.userId === this.hostId);

        // 向新加入的客户端发送当前房间的场景数据
        if (this.sceneData) {
            client.send(
                JSON.stringify({
                    type: 'scene_sync',
                    data: this.sceneData,
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
                    canEdit: this.userEditPermissions.get(c.userId) || false,
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
                    canEdit: this.userEditPermissions.get(c.userId) || false,
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
}

// 生成唯一ID
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// WebSocket连接处理
wss.on('connection', (ws) => {
    // 生成用户ID
    ws.userId = generateId();
    ws.userName = `User_${Math.floor(Math.random() * 1000)}`;

    console.log(`New connection: ${ws.userId}`);

    // 发送用户信息给客户端
    ws.send(
        JSON.stringify({
            type: 'user_info',
            userId: ws.userId,
            userName: ws.userName,
        }),
    );

    // 消息处理
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'ping':
                    // 收到客户端心跳，回复pong
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;

                case 'join_room':
                    const roomId = data.roomId || generateId();
                    let room = rooms.get(roomId);
                    const isNewRoom = !room;

                    if (isNewRoom) {
                        room = new Room(roomId);
                        rooms.set(roomId, room);
                        console.log(`创建新房间: ${roomId}`);
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
                        console.log(`新房间 ${roomId} 房主设置为: ${room.hostId}`);
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
                        }),
                    );

                    console.log(`User ${ws.userId} joined room ${roomId}`);
                    break;

                case 'update_scene':
                    if (ws.roomId) {
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            // 验证权限：检查用户是否有编辑权限
                            if (room.userEditPermissions.get(ws.userId)) {
                                room.updateScene(data.scene, ws);
                            } else {
                                console.log(`场景更新拒绝: 用户 ${ws.userId} 无权限编辑场景`);
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
                                            canEdit: room.userEditPermissions.get(c.userId) || false,
                                        })),
                                    }),
                                );
                            }
                        }
                    }
                    break;

                case 'chat_message':
                    if (ws.roomId && data.message && data.message.trim()) {
                        const room = rooms.get(ws.roomId);
                        if (room) {
                            room.broadcast(
                                JSON.stringify({
                                    type: 'chat_message',
                                    userId: ws.userId,
                                    userName: ws.userName,
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
                        console.log(
                            `收到房主移交请求 - 房间ID: ${ws.roomId}, 当前用户ID: ${ws.userId}, 目标用户ID: ${data.newHostId}`,
                        );

                        // 只有当前房主可以移交权限
                        if (!room) {
                            console.log(`房主移交失败 - 房间不存在: ${ws.roomId}`);
                        } else if (ws.userId !== room.hostId) {
                            console.log(`房主移交失败 - 用户不是房主: ${ws.userId}`);
                        } else {
                            // 检查新房主是否在房间内
                            const newHostClient = Array.from(room.clients).find((c) => c.userId === data.newHostId);
                            if (!newHostClient) {
                                console.log(`房主移交失败 - 目标用户不在房间内: ${data.newHostId}`);
                            } else {
                                const oldHostId = room.hostId;
                                room.hostId = data.newHostId;
                                console.log(`房主权限从 ${oldHostId} 成功移交给 ${data.newHostId}，房间: ${ws.roomId}`);

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

                                // 确保广播到所有客户端
                                console.log(`向房间内所有用户(${room.clients.size}人)广播房主变更事件`);
                                room.broadcast(hostChangedMessage);
                                room.broadcast(hostInfoMessage);

                                // 重新广播用户权限列表
                                room.clients.forEach((client) => {
                                    room.sendUserPermissions(client);
                                });
                            }
                        }
                    } else {
                        console.log('房主移交失败 - 参数不完整');
                    }
                    break;

                // 处理设置用户编辑权限
                case 'set_user_edit_permission':
                    if (ws.roomId) {
                        const room = rooms.get(ws.roomId);
                        if (room && ws.userId === room.hostId) {
                            const result = room.setUserEditPermission(data.userId, Boolean(data.canEdit));
                            console.log(
                                `设置用户编辑权限: 房间=${room.id}, 用户=${data.userId}, 允许编辑=${Boolean(data.canEdit)}`,
                            );

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
                            console.log(`设置编辑权限拒绝: 用户 ${ws.userId} 不是房主`);
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
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // 连接关闭处理
    ws.on('close', () => {
        console.log(`Connection closed: ${ws.userId}`);

        if (ws.roomId) {
            const room = rooms.get(ws.roomId);
            if (room) {
                room.removeClient(ws);
            }
        }
    });

    // 错误处理
    ws.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
    });
});

// 启动服务器
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}`);
});

// 定期清理长时间未活跃的房间（超过1小时）
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        if (now - room.lastUpdated > 3600000 && room.clients.size === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} cleaned up due to inactivity`);
        }
    });
}, 300000); // 每5分钟检查一次
