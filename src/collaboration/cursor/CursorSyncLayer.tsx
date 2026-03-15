import { KonvaEventObject } from 'konva/lib/Node';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Layer, Text } from 'react-konva';
import { useScene } from '../../SceneProvider';
import { getCanvasCoord, getPointerPosition } from '../../coord';
import { getCursorDataUrl } from '../../cursorIcon';
import { useStage } from '../../render/stage';
import { useImageTracked } from '../../useObjectLoading';
import { useCollaboration } from '../CollaborationProvider';
import { webSocketService } from '../WebSocketService';
import { decryptCursorPayload, encryptCursorPayload, ensureRoomKeyInUrl, importAesGcmKey } from './cursorCrypto';
import {
    buildCursorUpdateFrame,
    CURSOR_CIPHERTEXT_WITH_TAG_BYTES,
    CURSOR_IV_BYTES,
    CURSOR_PLAINTEXT_BYTES,
    decodeCursorPlaintext,
    encodeCursorPlaintext,
    parseCursorBatchFrame,
    parseCursorFecFrame,
    xorBytes,
} from './cursorProtocol';
import { applyRemoteCursorUpdate, isFrozen, predictCursorPosition, RemoteCursorState } from './cursorState';
import { TokenBucket } from './rateLimiter';

function nowT16(): number {
    return ((Date.now() / 4) | 0) & 0xffff;
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

export const CursorSyncLayer: React.FC = () => {
    const { scene } = useScene();
    const stage = useStage();
    const collab = useCollaboration();

    const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
    const [remoteMap, setRemoteMap] = useState<Map<number, RemoteCursorState>>(new Map());
    const [renderNowMs, setRenderNowMs] = useState(0);
    const remoteMapRef = useRef<Map<number, RemoteCursorState>>(new Map());

    const [cursorImgNormal] = useImageTracked(getCursorDataUrl('#00a1ff', false));
    const [cursorImgClicked] = useImageTracked(getCursorDataUrl('#00a1ff', true));
    const [cursorImgFrozen] = useImageTracked(getCursorDataUrl('#888888', false));

    const seqRef = useRef<number>(0);
    const lastSentPosRef = useRef<{ x: number; y: number } | null>(null);
    const lastSentButtonsRef = useRef<number>(0);
    const lastSendAtMsRef = useRef<number>(0);
    const bucketRef = useRef(new TokenBucket(30, 30));
    const shareMaskRef = useRef<number>(1);
    const localButtonsRef = useRef<number>(0);
    const heartbeatTimerRef = useRef<number | null>(null);

    const fecWindowRef = useRef<
        Map<
            number,
            {
                batches: Array<Uint8Array | null>;
                lens: [number, number, number] | null;
                parity: Uint8Array | null;
                createdAtMs: number;
            }
        >
    >(new Map());

    const selfShortId = useMemo(() => {
        const me = collab.connectedUsers?.find((u) => u.id === collab.userId);
        return typeof me?.shortId === 'number' ? me.shortId : null;
    }, [collab.connectedUsers, collab.userId]);

    useEffect(() => {
        if (!collab.roomId) return;
        const bytes = ensureRoomKeyInUrl();
        importAesGcmKey(bytes).then(setCryptoKey);
    }, [collab.roomId]);

    useEffect(() => {
        shareMaskRef.current = 1;
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => setRenderNowMs(performance.now()), 33);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        remoteMapRef.current = remoteMap;
    }, [remoteMap]);

    useEffect(() => {
        if (!collab.roomId) {
            remoteMapRef.current = new Map();
            return;
        }

        const allowed = new Set<number>();
        for (const u of collab.connectedUsers ?? []) {
            if (typeof u.shortId === 'number') {
                allowed.add(u.shortId);
            }
        }
        if (selfShortId !== null) {
            allowed.delete(selfShortId);
        }

        const current = remoteMapRef.current;
        if (current.size === 0) return;

        const next = new Map<number, RemoteCursorState>();
        current.forEach((v, k) => {
            if (allowed.has(k)) {
                next.set(k, v);
            }
        });

        remoteMapRef.current = next;
    }, [collab.roomId, collab.connectedUsers, selfShortId]);

    const sendCursor = useCallback(
        async (pos: { x: number; y: number }, buttonsMask: number, mode: 'event' | 'keepalive') => {
            if (!cryptoKey || !collab.roomId) return;
            const nowMs = performance.now();

            const lastPos = lastSentPosRef.current;
            const lastButtons = lastSentButtonsRef.current;
            const movedEnough = lastPos ? dist2(pos, lastPos) > 4 : true;
            const buttonsChanged = buttonsMask !== lastButtons;
            const timeSinceLast = nowMs - lastSendAtMsRef.current;

            const isKeepalive = mode === 'keepalive';
            if (!isKeepalive && !movedEnough && !buttonsChanged && timeSinceLast < 200) return;
            if (isKeepalive && timeSinceLast < 180) return;

            if (!bucketRef.current.take(nowMs, 1)) {
                return;
            }

            const seq = (seqRef.current + 1) & 0xffff;
            seqRef.current = seq;

            const shareMask = shareMaskRef.current & 0xff;
            const buttons = buttonsMask & shareMask;
            const plaintext = encodeCursorPlaintext({
                x: pos.x,
                y: pos.y,
                buttons,
                authorizedButtons: shareMask,
                t16: nowT16(),
            });

            const iv = new Uint8Array(CURSOR_IV_BYTES);
            crypto.getRandomValues(iv);
            const flags = 0x01 | (isKeepalive ? 0x02 : 0);
            const aad = new Uint8Array([flags, seq & 0xff, (seq >>> 8) & 0xff]);
            const ciphertextWithTag = await encryptCursorPayload(cryptoKey, iv, plaintext, aad);
            if (ciphertextWithTag.length !== CURSOR_CIPHERTEXT_WITH_TAG_BYTES) return;

            const frame = buildCursorUpdateFrame({
                flags,
                seq,
                iv,
                ciphertextWithTag,
            });
            webSocketService.sendBinary(frame);

            lastSentPosRef.current = pos;
            lastSentButtonsRef.current = buttonsMask;
            lastSendAtMsRef.current = nowMs;
        },
        [collab.roomId, cryptoKey],
    );

    useEffect(() => {
        if (!collab.roomId || !stage) return;

        const onMove = (evt: KonvaEventObject<MouseEvent>) => {
            const p = getPointerPosition(scene, stage);
            if (!p) return;
            const buttons = evt.evt?.buttons ?? 0;
            localButtonsRef.current = buttons;
            sendCursor({ x: p.x, y: p.y }, buttons, 'event');
        };

        const onDown = (evt: KonvaEventObject<MouseEvent>) => {
            const p = getPointerPosition(scene, stage);
            if (!p) return;
            const buttons = evt.evt?.buttons ?? 0;
            localButtonsRef.current = buttons;
            sendCursor({ x: p.x, y: p.y }, buttons, 'event');
        };

        const onUp = (evt: KonvaEventObject<MouseEvent>) => {
            const p = getPointerPosition(scene, stage);
            if (!p) return;
            const buttons = evt.evt?.buttons ?? 0;
            localButtonsRef.current = buttons;
            sendCursor({ x: p.x, y: p.y }, buttons, 'event');
        };

        stage.on('mousemove', onMove);
        stage.on('mousedown', onDown);
        stage.on('mouseup', onUp);

        heartbeatTimerRef.current = window.setInterval(() => {
            const p = getPointerPosition(scene, stage);
            if (!p) return;
            const buttons = localButtonsRef.current;
            sendCursor({ x: p.x, y: p.y }, buttons, 'keepalive');
        }, 200);

        return () => {
            stage.off('mousemove', onMove);
            stage.off('mousedown', onDown);
            stage.off('mouseup', onUp);
            if (heartbeatTimerRef.current) {
                window.clearInterval(heartbeatTimerRef.current);
                heartbeatTimerRef.current = null;
            }
        };
    }, [collab.roomId, scene, sendCursor, stage]);

    const applyBatch = useCallback(
        async (raw: Uint8Array) => {
            const batch = parseCursorBatchFrame(raw);
            if (!batch || !cryptoKey) return;

            const receivedAtMs = performance.now();
            const next = new Map(remoteMapRef.current);
            for (const r of batch.records) {
                if (selfShortId !== null && r.senderShortId === selfShortId) continue;
                const aad = new Uint8Array([r.flags & 0xff, r.seq & 0xff, (r.seq >>> 8) & 0xff]);
                const pt = await decryptCursorPayload(cryptoKey, r.iv, r.ciphertextWithTag, aad);
                if (!pt || pt.length !== CURSOR_PLAINTEXT_BYTES) continue;
                const decoded = decodeCursorPlaintext(pt);
                const prev = next.get(r.senderShortId);
                const updated = applyRemoteCursorUpdate(prev, r.senderShortId, r.seq, decoded, receivedAtMs);
                next.set(r.senderShortId, updated);
            }
            remoteMapRef.current = next;
            setRemoteMap(next);
        },
        [cryptoKey, selfShortId],
    );

    useEffect(() => {
        const onBatch = (data: unknown) => {
            const raw = data as Uint8Array;
            const parsed = parseCursorBatchFrame(raw);
            if (!parsed) return;
            const win = fecWindowRef.current.get(parsed.groupId) ?? {
                batches: [null, null, null],
                lens: null,
                parity: null,
                createdAtMs: performance.now(),
            };
            win.batches[parsed.index] = raw;
            fecWindowRef.current.set(parsed.groupId, win);
            applyBatch(raw);
        };

        const onFec = (data: unknown) => {
            const raw = data as Uint8Array;
            const fec = parseCursorFecFrame(raw);
            if (!fec) return;
            const win = fecWindowRef.current.get(fec.groupId) ?? {
                batches: [null, null, null],
                lens: null,
                parity: null,
                createdAtMs: performance.now(),
            };
            win.lens = [fec.len0, fec.len1, fec.len2];
            win.parity = fec.parity;
            fecWindowRef.current.set(fec.groupId, win);

            const present = win.batches.reduce((acc, b) => acc + (b ? 1 : 0), 0);
            if (present >= 2 && win.parity && win.lens) {
                const missingIndex = win.batches.findIndex((b) => b === null);
                if (missingIndex >= 0) {
                    const have = win.batches.filter((b) => b !== null) as Uint8Array[];
                    if (have.length >= 2) {
                        const h0 = have[0];
                        const h1 = have[1];
                        if (!h0 || !h1) return;
                        const x01 = xorBytes(h0, h1);
                        const recovered = xorBytes(win.parity, x01).slice(0, win.lens[missingIndex]);
                        win.batches[missingIndex] = recovered;
                        applyBatch(recovered);
                    }
                }
            }
        };

        webSocketService.on('cursor_batch', onBatch);
        webSocketService.on('cursor_fec', onFec);
        return () => {
            webSocketService.off('cursor_batch', onBatch);
            webSocketService.off('cursor_fec', onFec);
        };
    }, [applyBatch]);

    useEffect(() => {
        const id = window.setInterval(() => {
            const now = performance.now();
            const next = new Map(fecWindowRef.current);
            next.forEach((v, k) => {
                if (now - v.createdAtMs > 2000) {
                    next.delete(k);
                }
            });
            fecWindowRef.current = next;
        }, 500);
        return () => window.clearInterval(id);
    }, []);

    const rendered = useMemo(() => {
        const nowMs = renderNowMs;
        const arr: Array<{
            shortId: number;
            x: number;
            y: number;
            frozen: boolean;
            buttons: number;
            name: string;
        }> = [];

        const allowed = new Set<number>();
        for (const u of collab.connectedUsers ?? []) {
            if (typeof u.shortId === 'number') {
                allowed.add(u.shortId);
            }
        }
        if (selfShortId !== null) {
            allowed.delete(selfShortId);
        }

        remoteMap.forEach((state, shortId) => {
            if (!allowed.has(shortId)) return;
            const frozen = isFrozen(state, nowMs, 300);
            const pos = frozen ? (state.sample1 ?? state.sample0) : (state.sample1 ?? state.sample0);
            if (!pos) return;
            const predicted = !frozen ? predictCursorPosition(state, nowMs, 80) : null;
            const px = predicted ? predicted.x : pos.x;
            const py = predicted ? predicted.y : pos.y;
            const canvas = getCanvasCoord(scene, { x: px, y: py });
            const user = collab.connectedUsers?.find((u) => u.shortId === shortId);
            const name = user?.name ?? `User_${shortId}`;
            const buttons = pos.buttons & pos.authorizedButtons & 0xff;
            arr.push({ shortId, x: canvas.x - 4, y: canvas.y - 2, frozen, buttons, name });
        });

        return arr;
    }, [collab.connectedUsers, remoteMap, renderNowMs, scene, selfShortId]);

    if (!collab.roomId) {
        return null;
    }

    return (
        <Layer listening={false}>
            {rendered.map((c) => {
                const left = (c.buttons & 1) !== 0;
                const color = c.frozen ? '#888888' : '#00a1ff';
                const image = c.frozen ? cursorImgFrozen : left ? cursorImgClicked : cursorImgNormal;
                if (!image) return null;
                return (
                    <Group key={c.shortId} x={c.x} y={c.y}>
                        <KonvaImage image={image} x={-2} y={-2} width={18} height={18} opacity={c.frozen ? 0.4 : 0.9} />
                        <Text x={20} y={-10} text={c.name} fontSize={12} fill={color} opacity={c.frozen ? 0.4 : 0.9} />
                    </Group>
                );
            })}
        </Layer>
    );
};
