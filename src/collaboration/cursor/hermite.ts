export interface Vec2 {
    x: number;
    y: number;
}

export function hermite(p0: Vec2, p1: Vec2, m0: Vec2, m1: Vec2, t: number): Vec2 {
    const tt = t * t;
    const ttt = tt * t;
    const h00 = 2 * ttt - 3 * tt + 1;
    const h10 = ttt - 2 * tt + t;
    const h01 = -2 * ttt + 3 * tt;
    const h11 = ttt - tt;
    return {
        x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
        y: h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
    };
}

export function vecSub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(a: Vec2, s: number): Vec2 {
    return { x: a.x * s, y: a.y * s };
}
