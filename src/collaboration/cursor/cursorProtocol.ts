export const CURSOR_UPDATE_TYPE = 0xc1;
export const CURSOR_BATCH_TYPE = 0xd1;
export const CURSOR_FEC_TYPE = 0xd2;

export const CURSOR_UPDATE_WIRE_BYTES = 28;
export const CURSOR_IV_BYTES = 8;
export const CURSOR_TAG_BYTES = 8;
export const CURSOR_PLAINTEXT_BYTES = 8;
export const CURSOR_CIPHERTEXT_WITH_TAG_BYTES = CURSOR_PLAINTEXT_BYTES + CURSOR_TAG_BYTES;

export type CursorButtonsMask = number;

export interface CursorPlaintext {
    x: number;
    y: number;
    buttons: CursorButtonsMask;
    authorizedButtons: CursorButtonsMask;
    t16: number;
}

export interface CursorEncryptedUpdate {
    flags: number;
    seq: number;
    iv: Uint8Array;
    ciphertextWithTag: Uint8Array;
}

export interface CursorBatchRecord {
    senderShortId: number;
    flags: number;
    seq: number;
    iv: Uint8Array;
    ciphertextWithTag: Uint8Array;
}

export interface CursorBatchFrame {
    groupId: number;
    index: number;
    records: CursorBatchRecord[];
    raw: Uint8Array;
}

export interface CursorFecFrame {
    groupId: number;
    len0: number;
    len1: number;
    len2: number;
    parity: Uint8Array;
    raw: Uint8Array;
}

function clampInt16(v: number) {
    return Math.max(-32768, Math.min(32767, v | 0));
}

export function encodeCursorPlaintext(p: CursorPlaintext): Uint8Array {
    const buf = new ArrayBuffer(CURSOR_PLAINTEXT_BYTES);
    const view = new DataView(buf);
    view.setInt16(0, clampInt16(p.x), true);
    view.setInt16(2, clampInt16(p.y), true);
    view.setUint8(4, p.buttons & 0xff);
    view.setUint8(5, p.authorizedButtons & 0xff);
    view.setUint16(6, p.t16 & 0xffff, true);
    return new Uint8Array(buf);
}

export function decodeCursorPlaintext(buf: Uint8Array): CursorPlaintext {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return {
        x: view.getInt16(0, true),
        y: view.getInt16(2, true),
        buttons: view.getUint8(4),
        authorizedButtons: view.getUint8(5),
        t16: view.getUint16(6, true),
    };
}

export function buildCursorUpdateFrame(update: CursorEncryptedUpdate): Uint8Array {
    const buf = new Uint8Array(CURSOR_UPDATE_WIRE_BYTES);
    buf[0] = CURSOR_UPDATE_TYPE;
    buf[1] = update.flags & 0xff;
    buf[2] = update.seq & 0xff;
    buf[3] = (update.seq >>> 8) & 0xff;
    buf.set(update.iv, 4);
    buf.set(update.ciphertextWithTag, 4 + CURSOR_IV_BYTES);
    return buf;
}

export function parseCursorBatchFrame(data: Uint8Array): CursorBatchFrame | null {
    if (data.length < 5 || data[0] !== CURSOR_BATCH_TYPE) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const groupId = view.getUint16(1, true);
    const index = view.getUint8(3);
    const count = view.getUint8(4);
    const recordSize = 1 + 1 + 2 + CURSOR_IV_BYTES + CURSOR_CIPHERTEXT_WITH_TAG_BYTES;
    const expected = 5 + count * recordSize;
    if (data.length < expected) return null;

    const records: CursorBatchRecord[] = [];
    let offset = 5;
    for (let i = 0; i < count; i++) {
        const senderShortId = data[offset] ?? 0;
        const flags = data[offset + 1] ?? 0;
        const seq = view.getUint16(offset + 2, true);
        const iv = data.slice(offset + 4, offset + 4 + CURSOR_IV_BYTES);
        const ciphertextWithTag = data.slice(
            offset + 4 + CURSOR_IV_BYTES,
            offset + 4 + CURSOR_IV_BYTES + CURSOR_CIPHERTEXT_WITH_TAG_BYTES,
        );
        records.push({ senderShortId, flags, seq, iv, ciphertextWithTag });
        offset += recordSize;
    }

    return { groupId, index, records, raw: data };
}

export function parseCursorFecFrame(data: Uint8Array): CursorFecFrame | null {
    if (data.length < 9 || data[0] !== CURSOR_FEC_TYPE) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const groupId = view.getUint16(1, true);
    const len0 = view.getUint16(3, true);
    const len1 = view.getUint16(5, true);
    const len2 = view.getUint16(7, true);
    const parity = data.slice(9);
    return { groupId, len0, len1, len2, parity, raw: data };
}

export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    const len = Math.max(a.length, b.length);
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        const v0 = i < a.length ? (a[i] ?? 0) : 0;
        const v1 = i < b.length ? (b[i] ?? 0) : 0;
        out[i] = v0 ^ v1;
    }
    return out;
}
