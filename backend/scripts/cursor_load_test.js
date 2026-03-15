const WebSocket = require('ws');
const { webcrypto } = require('crypto');

const CURSOR_UPDATE_TYPE = 0xc1;
const CURSOR_BATCH_TYPE = 0xd1;

const IV_BYTES = 8;
const TAG_BITS = 64;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function nowT16() {
    return ((Date.now() / 4) | 0) & 0xffff;
}

function encodePlaintext(x, y, buttons, authMask, t16) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setInt16(0, x, true);
    view.setInt16(2, y, true);
    view.setUint8(4, buttons & 0xff);
    view.setUint8(5, authMask & 0xff);
    view.setUint16(6, t16 & 0xffff, true);
    return new Uint8Array(buf);
}

async function importKey(keyBytes) {
    return await webcrypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(key, iv, plaintext, aad) {
    const encrypted = await webcrypto.subtle.encrypt(
        { name: 'AES-GCM', iv, tagLength: TAG_BITS, additionalData: aad },
        key,
        plaintext,
    );
    return new Uint8Array(encrypted);
}

async function decrypt(key, iv, ciphertextWithTag, aad) {
    try {
        const decrypted = await webcrypto.subtle.decrypt(
            { name: 'AES-GCM', iv, tagLength: TAG_BITS, additionalData: aad },
            key,
            ciphertextWithTag,
        );
        return new Uint8Array(decrypted);
    } catch {
        return null;
    }
}

function parseRoomJoined(msg) {
    try {
        const d = JSON.parse(msg);
        if (d.type === 'room_joined') return d;
    } catch {}
    return null;
}

function parseBatch(buf) {
    if (buf.length < 5 || buf[0] !== CURSOR_BATCH_TYPE) return null;
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const groupId = dv.getUint16(1, true);
    const index = dv.getUint8(3);
    const count = dv.getUint8(4);
    const recSize = 1 + 1 + 2 + 8 + 16;
    const expected = 5 + count * recSize;
    if (buf.length < expected) return null;
    const records = [];
    let off = 5;
    for (let i = 0; i < count; i++) {
        const sid = buf[off];
        const flags = buf[off + 1];
        const seq = dv.getUint16(off + 2, true);
        const iv = buf.subarray(off + 4, off + 12);
        const cttag = buf.subarray(off + 12, off + 28);
        records.push({ sid, flags, seq, iv, cttag });
        off += recSize;
    }
    return { groupId, index, records };
}

function unwrapT16(nowMs, t16) {
    const base = ((nowMs / 4) | 0) & ~0xffff;
    const candidate = base | t16;
    const candidateMs = candidate * 4;
    const diff = nowMs - candidateMs;
    if (diff < -131072) return candidateMs - 262144;
    if (diff > 131072) return candidateMs + 262144;
    return candidateMs;
}

async function run() {
    const serverUrl = process.env.WS_URL || 'ws://localhost:3000';
    const clients = parseInt(process.env.CLIENTS || '50', 10);
    const durationMs = parseInt(process.env.DURATION_MS || String(5 * 60 * 1000), 10);

    const keyBytes = new Uint8Array(16);
    webcrypto.getRandomValues(keyBytes);
    const key = await importKey(keyBytes);

    const sockets = [];
    let roomId = null;

    const connectClient = async (i) => {
        return await new Promise((resolve, reject) => {
            const ws = new WebSocket(serverUrl);
            ws.binaryType = 'arraybuffer';
            const state = { ws, idx: i, shortId: null, seq: 0, x: 0, y: 0, lastDelayMs: 0 };

            ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'join_room', roomId }));
            });

            ws.on('message', async (data) => {
                if (typeof data === 'string') {
                    const joined = parseRoomJoined(data);
                    if (joined) {
                        roomId = roomId || joined.roomId;
                        state.shortId = joined.shortId ?? null;
                        resolve(state);
                    }
                    return;
                }

                if (Buffer.isBuffer(data) && data.length > 0 && data[0] !== CURSOR_BATCH_TYPE) {
                    const text = data.toString('utf8');
                    const joined = parseRoomJoined(text);
                    if (joined) {
                        roomId = roomId || joined.roomId;
                        state.shortId = joined.shortId ?? null;
                        resolve(state);
                    }
                    return;
                }

                const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
                const batch = parseBatch(buf);
                if (!batch || state.shortId == null) return;

                const nowMs = Date.now();
                for (const r of batch.records) {
                    if (r.sid !== state.shortId) continue;
                    const aad = Buffer.from([r.flags & 0xff, r.seq & 0xff, (r.seq >>> 8) & 0xff]);
                    const pt = await decrypt(key, r.iv, r.cttag, aad);
                    if (!pt) continue;
                    const dv = new DataView(pt.buffer, pt.byteOffset, pt.byteLength);
                    const t16 = dv.getUint16(6, true);
                    const sentMs = unwrapT16(nowMs, t16);
                    state.lastDelayMs = Math.max(0, nowMs - sentMs);
                }
            });

            ws.on('error', reject);
        });
    };

    const first = await connectClient(0);
    sockets.push(first);
    for (let i = 1; i < clients; i++) {
        sockets.push(await connectClient(i));
        await sleep(5);
    }

    const start = Date.now();
    const delays = [];

    const sendLoop = sockets.map((s) => {
        const tick = async () => {
            if (Date.now() - start > durationMs) return;
            s.seq = (s.seq + 1) & 0xffff;
            s.x = (s.x + ((Math.random() * 11) | 0) - 5) | 0;
            s.y = (s.y + ((Math.random() * 11) | 0) - 5) | 0;
            const buttons = Math.random() < 0.05 ? 1 : 0;
            const auth = 3;
            const pt = encodePlaintext(s.x, s.y, buttons, auth, nowT16());
            const iv = new Uint8Array(IV_BYTES);
            webcrypto.getRandomValues(iv);
            const flags = 0x01;
            const aad = new Uint8Array([flags, s.seq & 0xff, (s.seq >>> 8) & 0xff]);
            const cttag = await encrypt(key, iv, pt, aad);
            const frame = new Uint8Array(28);
            frame[0] = CURSOR_UPDATE_TYPE;
            frame[1] = flags;
            frame[2] = s.seq & 0xff;
            frame[3] = (s.seq >>> 8) & 0xff;
            frame.set(iv, 4);
            frame.set(cttag, 12);
            s.ws.send(frame);
        };

        const id = setInterval(() => {
            tick().catch(() => {});
        }, 33);
        return () => clearInterval(id);
    });

    const monitorId = setInterval(async () => {
        const now = Date.now();
        const elapsed = ((now - start) / 1000).toFixed(1);
        const sample = sockets.map((s) => s.lastDelayMs).filter((x) => x > 0);
        if (sample.length > 0) {
            delays.push(...sample);
        }
        const sorted = [...sample].sort((a, b) => a - b);
        const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0;
        const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;
        process.stdout.write(`[${elapsed}s] delay_ms p50=${p50} p99=${p99} samples=${sample.length}\n`);

        if (now - start > durationMs) {
            clearInterval(monitorId);
        }
    }, 1000);

    await sleep(durationMs + 500);
    sendLoop.forEach((stop) => stop());
    sockets.forEach((s) => s.ws.close());

    delays.sort((a, b) => a - b);
    const p99 = delays.length ? delays[Math.floor(delays.length * 0.99)] : 0;
    const p50 = delays.length ? delays[Math.floor(delays.length * 0.5)] : 0;
    process.stdout.write(`DONE clients=${clients} duration_ms=${durationMs} p50_ms=${p50} p99_ms=${p99}\n`);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
