const WebSocket = require('ws');

function buildCursorBatch(room, cursorSyncDelaySeconds) {
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

module.exports = function startCursorRelay(rooms, { cursorSyncDelaySeconds }) {
    return setInterval(() => {
        rooms.forEach((room) => {
            if (room.clients.size === 0) return;
            const batch = buildCursorBatch(room, cursorSyncDelaySeconds);
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
};
