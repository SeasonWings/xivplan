import { Base64 } from 'js-base64';
import { CURSOR_TAG_BYTES } from './cursorProtocol';

const KEY_PARAM = 'k';

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(u8.byteLength);
    copy.set(u8);
    return copy.buffer;
}

function toU8ArrayBuffer(u8: Uint8Array): Uint8Array<ArrayBuffer> {
    return new Uint8Array(toArrayBuffer(u8));
}

function parseHashParams(hash: string): URLSearchParams {
    const h = hash.startsWith('#') ? hash.slice(1) : hash;
    return new URLSearchParams(h);
}

function formatHashParams(params: URLSearchParams): string {
    const s = params.toString();
    return s ? `#${s}` : '';
}

export function ensureRoomKeyInUrl(): Uint8Array {
    const params = parseHashParams(window.location.hash);
    const existing = params.get(KEY_PARAM);
    if (existing) {
        try {
            const bytes = Base64.toUint8Array(existing);
            if (bytes.length === 16) {
                return bytes;
            }
        } catch (e) {
            void e;
        }
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    params.set(KEY_PARAM, Base64.fromUint8Array(bytes, true));
    const nextHash = formatHashParams(params);
    if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    }
    return bytes;
}

export async function importAesGcmKey(keyBytes: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
    ]);
}

export async function encryptCursorPayload(
    key: CryptoKey,
    iv: Uint8Array,
    plaintext: Uint8Array,
    additionalData?: Uint8Array,
): Promise<Uint8Array> {
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: toU8ArrayBuffer(iv),
            tagLength: CURSOR_TAG_BYTES * 8,
            additionalData: additionalData ? toU8ArrayBuffer(additionalData) : undefined,
        },
        key,
        toU8ArrayBuffer(plaintext),
    );
    return new Uint8Array(encrypted);
}

export async function decryptCursorPayload(
    key: CryptoKey,
    iv: Uint8Array,
    ciphertextWithTag: Uint8Array,
    additionalData?: Uint8Array,
): Promise<Uint8Array | null> {
    try {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: toU8ArrayBuffer(iv),
                tagLength: CURSOR_TAG_BYTES * 8,
                additionalData: additionalData ? toU8ArrayBuffer(additionalData) : undefined,
            },
            key,
            toU8ArrayBuffer(ciphertextWithTag),
        );
        return new Uint8Array(decrypted);
    } catch (e) {
        void e;
        return null;
    }
}
