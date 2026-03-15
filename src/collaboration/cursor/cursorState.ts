import { CursorPlaintext } from './cursorProtocol';
import { hermite, vecScale, vecSub, Vec2 } from './hermite';

export interface CursorSample extends CursorPlaintext {
    receivedAtMs: number;
}

export interface RemoteCursorState {
    shortId: number;
    lastSeq: number;
    lastReceivedAtMs: number;
    sample0?: CursorSample;
    sample1?: CursorSample;
}

export function shouldAcceptSeq(prevSeq: number | undefined, nextSeq: number): boolean {
    if (prevSeq === undefined) return true;
    const diff = (nextSeq - prevSeq + 65536) % 65536;
    return diff > 0 && diff < 32768;
}

export function applyRemoteCursorUpdate(
    prev: RemoteCursorState | undefined,
    shortId: number,
    seq: number,
    update: CursorPlaintext,
    receivedAtMs: number,
): RemoteCursorState {
    if (!prev) {
        const sample: CursorSample = { ...update, receivedAtMs };
        return {
            shortId,
            lastSeq: seq,
            lastReceivedAtMs: receivedAtMs,
            sample0: sample,
            sample1: sample,
        };
    }

    if (!shouldAcceptSeq(prev.lastSeq, seq)) {
        return prev;
    }

    const sample: CursorSample = { ...update, receivedAtMs };
    return {
        ...prev,
        lastSeq: seq,
        lastReceivedAtMs: receivedAtMs,
        sample0: prev.sample1,
        sample1: sample,
    };
}

export function isFrozen(state: RemoteCursorState, nowMs: number, freezeMs = 300): boolean {
    return nowMs - state.lastReceivedAtMs >= freezeMs;
}

export function predictCursorPosition(state: RemoteCursorState, nowMs: number, predictionMs = 80): Vec2 | null {
    const s0 = state.sample0;
    const s1 = state.sample1;
    if (!s0 || !s1) return null;

    const t0 = s0.receivedAtMs;
    const t1 = s1.receivedAtMs;
    if (t1 <= t0) return { x: s1.x, y: s1.y };

    const targetMs = nowMs + predictionMs;
    const dt = t1 - t0;
    const t = Math.max(0, Math.min(1, (targetMs - t0) / dt));

    const p0: Vec2 = { x: s0.x, y: s0.y };
    const p1: Vec2 = { x: s1.x, y: s1.y };
    const v: Vec2 = vecScale(vecSub(p1, p0), 1 / dt);
    const m0 = vecScale(v, dt);
    const m1 = vecScale(v, dt);
    return hermite(p0, p1, m0, m1, t);
}
