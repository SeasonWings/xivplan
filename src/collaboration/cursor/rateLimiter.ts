export class TokenBucket {
    private capacity: number;
    private refillPerMs: number;
    private tokens: number;
    private lastRefillMs: number;

    constructor(tokensPerSecond: number, burst: number) {
        this.capacity = burst;
        this.refillPerMs = tokensPerSecond / 1000;
        this.tokens = burst;
        this.lastRefillMs = performance.now();
    }

    take(nowMs: number, cost = 1): boolean {
        if (nowMs < this.lastRefillMs) {
            this.lastRefillMs = nowMs;
        }
        this.refill(nowMs);
        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }
        return false;
    }

    private refill(nowMs: number) {
        const dt = nowMs - this.lastRefillMs;
        if (dt <= 0) return;
        this.tokens = Math.min(this.capacity, this.tokens + dt * this.refillPerMs);
        this.lastRefillMs = nowMs;
    }
}
