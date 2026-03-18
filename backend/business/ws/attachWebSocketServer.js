const WebSocket = require('ws');

const Room = require('./Room');
const startCursorRelay = require('./cursorRelay');
const { generateId } = require('./utils');

module.exports = function attachWebSocketServer(server, { logger, metrics }) {
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

    const rooms = new Map();

    wss.on('connection', (ws, req) => {
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

        ws.send(
            JSON.stringify({
                type: 'user_info',
                userId: ws.userId,
                userName: ws.userName,
                userAvatar: ws.userAvatar,
            }),
        );

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
                                        metrics.cursorLostPacketsTotal.inc({ room_id: ws.roomId }, diff);
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
                        ws.send(JSON.stringify({ type: 'pong' }));
                        break;

                    case 'join_room': {
                        logger.ws('info', 'ws.room.join_request', {
                            connId: ws.connId,
                            userId: ws.userId,
                            roomId: data.roomId,
                        });
                        const roomId = data.roomId || generateId();
                        let room = rooms.get(roomId);
                        const isNewRoom = !room;

                        if (isNewRoom) {
                            room = new Room(roomId, { logger });
                            rooms.set(roomId, room);
                            logger.ws('info', 'ws.room.created', {
                                connId: ws.connId,
                                userId: ws.userId,
                                roomId: roomId,
                            });
                        }

                        if (ws.roomId) {
                            const oldRoom = rooms.get(ws.roomId);
                            if (oldRoom) {
                                oldRoom.removeClient(ws, rooms);
                            }
                        }

                        room.addClient(ws);

                        if (isNewRoom && room.hostId) {
                            logger.ws('info', 'ws.room.host_info_broadcast', {
                                connId: ws.connId,
                                userId: ws.userId,
                                roomId: roomId,
                                hostId: room.hostId,
                            });
                            room.broadcast(
                                JSON.stringify({
                                    type: 'host_info',
                                    hostId: room.hostId,
                                }),
                            );
                        }

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
                    }

                    case 'update_scene':
                        if (ws.roomId) {
                            const room = rooms.get(ws.roomId);
                            if (room) {
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
                                if (!room.userEditPermissions.get(ws.userId) || ws.userId !== room.hostId) {
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

                                room.broadcast(
                                    JSON.stringify({
                                        type: 'scene_sync',
                                        data: room.sceneData,
                                        seq: room.snapshotSeq || 0,
                                    }),
                                    ws,
                                );
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

                                    room.userEditPermissions.set(room.hostId, true);

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
                    room.removeClient(ws, rooms);
                }
            }
        });

        ws.on('error', (error) => {
            logger.ws('error', 'ws.connection.error', {
                connId: ws.connId,
                userId: ws.userId,
                roomId: ws.roomId,
                error: { name: error.name, message: error.message, stack: error.stack },
            });
        });
    });

    const cursorRelayTimer = startCursorRelay(rooms, metrics);

    const cleanupTimer = setInterval(() => {
        const now = Date.now();
        rooms.forEach((room, roomId) => {
            if (now - room.lastUpdated > 3600000 && room.clients.size === 0) {
                rooms.delete(roomId);
                logger.ws('info', 'ws.room.cleanup', { roomId });
            }
        });
    }, 300000);

    return { wss, rooms, cursorRelayTimer, cleanupTimer };
};
