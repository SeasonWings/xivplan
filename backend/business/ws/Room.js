const WebSocket = require('ws');

module.exports = class Room {
    constructor(id, { logger }) {
        this.id = id;
        this.logger = logger;
        this.clients = new Set();
        this.hostId = null;
        this.sceneData = null;
        this.snapshotSeq = 0;
        this.sceneSeq = 0;
        this.actionLog = [];
        this.lastUpdated = Date.now();
        this.allowGuestEdit = true;
        this.userEditPermissions = new Map();
        this.nextShortId = 1;
        this.cursorPackets = new Map();
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

        if (!this.hostId) {
            this.hostId = client.userId;
            this.logger.ws('info', 'ws.room.host_assigned', {
                connId: client.connId,
                roomId: this.id,
                hostId: this.hostId,
                userId: client.userId,
                userName: client.userName,
            });
        }

        this.userEditPermissions.set(client.userId, client.userId === this.hostId);

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

        client.send(
            JSON.stringify({
                type: 'host_info',
                hostId: this.hostId,
            }),
        );

        this.sendUserPermissions(client);

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

    removeClient(client, rooms) {
        const isHost = client.userId === this.hostId;
        this.clients.delete(client);

        if (isHost && this.clients.size > 0) {
            const newHost = Array.from(this.clients)[0];
            this.hostId = newHost.userId;
            this.userEditPermissions.set(this.hostId, true);

            this.broadcast(
                JSON.stringify({
                    type: 'host_changed',
                    hostId: this.hostId,
                }),
            );

            this.clients.forEach((c) => {
                this.sendUserPermissions(c);
            });
        }

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

        if (this.clients.size === 0 && rooms) {
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

    setUserEditPermission(userId, canEdit) {
        if (userId === this.hostId) {
            return false;
        }

        this.userEditPermissions.set(userId, canEdit);

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
        if (!this.userEditPermissions.get(sender.userId)) {
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
};
