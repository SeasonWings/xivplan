import React from 'react';
import { Rect } from 'react-konva';
import { getCanvasArenaEllipse, getCanvasArenaRect } from '../coord';
import { RadialTicks, RectangularTicks, Scene, Ticks, TickType, TriangularTicks } from '../scene';
import { useScene } from '../SceneProvider';
import { useSceneTheme } from '../theme';
import { degtorad, getLinearGridDivs } from '../util';

const MAJOR_TICK_SIZE = 7;
const MINOR_TICK_SIZE = 5;
const TICK_MARGIN = 2;

export const ArenaTickRenderer: React.FC = () => {
    const { scene } = useScene();

    if (!scene.arena.ticks) {
        return null;
    }

    switch (scene.arena.ticks.type) {
        case TickType.None:
            return null;

        case TickType.Rectangular:
            return <RectangularTickRenderer scene={scene} ticks={scene.arena.ticks} />;

        case TickType.Radial:
            return <RadialTickRenderer scene={scene} ticks={scene.arena.ticks} />;

        case TickType.Triangular:
            return <TriangularTickRenderer scene={scene} ticks={scene.arena.ticks} />;
    }
};

interface TickRendererProps<T extends Ticks> {
    scene: Scene;
    ticks: T;
}

const RectangularTickRenderer: React.FC<TickRendererProps<RectangularTicks>> = ({ scene, ticks }) => {
    const rect = getCanvasArenaRect(scene);

    const minorProps = getRectangularTicks(ticks, rect, MINOR_TICK_SIZE);
    const majorProps = getCornerTicks(rect, MINOR_TICK_SIZE);

    return (
        <>
            {minorProps.map((props, i) => (
                <MinorTick key={i} {...props} />
            ))}
            {majorProps.map((props, i) => (
                <MajorTick key={i} {...props} />
            ))}
        </>
    );
};

const RadialTickRenderer: React.FC<TickRendererProps<RadialTicks>> = ({ scene, ticks }) => {
    const ellipse = getCanvasArenaEllipse(scene);

    const majorAngles = getRadialAngles(ticks.majorCount, ticks.majorStart);
    const minorAngles = getRadialAngles(ticks.minorCount, ticks.minorStart).filter(
        (a) => !includesAngle(majorAngles, a),
    );

    const majorProps = anglesToTicks(majorAngles, ellipse, MAJOR_TICK_SIZE);
    const minorProps = anglesToTicks(minorAngles, ellipse, MINOR_TICK_SIZE);

    return (
        <>
            {minorProps.map((props, i) => (
                <MinorTick key={i} {...props} />
            ))}
            {majorProps.map((props, i) => (
                <MajorTick key={i} {...props} />
            ))}
        </>
    );
};

interface Vec2 {
    x: number;
    y: number;
}

function vecSub(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x - b.x, y: a.y - b.y };
}

function vecAdd(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

function vecScale(v: Vec2, s: number): Vec2 {
    return { x: v.x * s, y: v.y * s };
}

function vecLen(v: Vec2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vecNorm(v: Vec2): Vec2 {
    const len = vecLen(v);
    return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

function lerpPoint(a: Vec2, b: Vec2, t: number): Vec2 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
}

function edgeOutwardNormalCCW(p: Vec2, q: Vec2): Vec2 {
    const v = vecSub(q, p);
    return vecNorm({ x: v.y, y: -v.x });
}

function triangleVertices(scene: Scene) {
    const rect = getCanvasArenaRect(scene);

    const inset = 1;
    const left = rect.x + inset;
    const right = rect.x + rect.width - inset;
    const top = rect.y + inset;
    const bottom = rect.y + rect.height - inset;
    const midX = (left + right) / 2;

    const A = { x: midX, y: top };
    const B = { x: right, y: bottom };
    const C = { x: left, y: bottom };

    return { A, B, C };
}

const TriangularTickRenderer: React.FC<TickRendererProps<TriangularTicks>> = ({ scene, ticks }) => {
    const { A, B, C } = triangleVertices(scene);

    const level =
        typeof ticks.level === 'number' && Number.isFinite(ticks.level)
            ? Math.max(1, Math.floor(ticks.level))
            : typeof ticks.divs === 'number' && Number.isFinite(ticks.divs) && ticks.divs > 0
              ? Math.max(1, Math.round(Math.log2(ticks.divs)))
              : 1;

    const divs = Math.max(1, 2 ** level);

    const nAB = edgeOutwardNormalCCW(A, B);
    const nBC = edgeOutwardNormalCCW(B, C);
    const nCA = edgeOutwardNormalCCW(C, A);

    const edges = [
        { p: A, q: B, n: nAB },
        { p: B, q: C, n: nBC },
        { p: C, q: A, n: nCA },
    ] as const;

    const minorProps: TickProps[] = [];
    for (const { p, q, n } of edges) {
        const angle = radToDeg(Math.atan2(q.y - p.y, q.x - p.x));
        const offset = MINOR_TICK_SIZE + TICK_MARGIN;

        for (let i = 1; i < divs; i++) {
            const t = i / divs;
            const pt = lerpPoint(p, q, t);
            const out = vecAdd(pt, vecScale(n, offset));
            minorProps.push({ x: out.x, y: out.y, angle });
        }
    }

    const majorProps: TickProps[] = [];
    const vertexNormals = [vecNorm(vecAdd(nCA, nAB)), vecNorm(vecAdd(nAB, nBC)), vecNorm(vecAdd(nBC, nCA))] as const;
    const majorOffset = MAJOR_TICK_SIZE + TICK_MARGIN;
    for (const [v, n] of [
        [A, vertexNormals[0]],
        [B, vertexNormals[1]],
        [C, vertexNormals[2]],
    ] as const) {
        const out = vecAdd(v, vecScale(n, majorOffset));
        const angle = radToDeg(Math.atan2(n.y, n.x));
        majorProps.push({ x: out.x, y: out.y, angle });
    }

    return (
        <>
            {minorProps.map((props, i) => (
                <MinorTick key={i} {...props} />
            ))}
            {majorProps.map((props, i) => (
                <MajorTick key={i} {...props} />
            ))}
        </>
    );
};

interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Ellipse {
    x: number;
    y: number;
    radiusX: number;
    radiusY: number;
}

interface TickProps {
    x: number;
    y: number;
    angle: number;
}

const MajorTick: React.FC<TickProps> = ({ x, y, angle }) => {
    const theme = useSceneTheme();

    return (
        <Rect
            x={x + 0.5}
            y={y + 0.5}
            offsetX={MAJOR_TICK_SIZE / 2}
            offsetY={MAJOR_TICK_SIZE / 2}
            width={MAJOR_TICK_SIZE}
            height={MAJOR_TICK_SIZE}
            rotation={angle + 45}
            fill={theme.colorBorderTickMajor}
        />
    );
};

const MinorTick: React.FC<TickProps> = ({ x, y, angle }) => {
    const theme = useSceneTheme();

    return (
        <Rect
            x={x + 0.5}
            y={y + 0.5}
            offsetX={MINOR_TICK_SIZE / 2}
            offsetY={MINOR_TICK_SIZE / 2}
            width={MINOR_TICK_SIZE}
            height={MINOR_TICK_SIZE}
            rotation={angle + 45}
            fill={theme.colorBorderTickMinor}
        />
    );
};

function getRadialAngles(count: number, start: number): number[] {
    if (count <= 1) {
        return [];
    }

    return Array.from({ length: count }, (_, i) => start + (i / count) * 360);
}

function anglesToTicks(angles: number[], { x, y, radiusX, radiusY }: Ellipse, size: number): TickProps[] {
    radiusX += size + TICK_MARGIN;
    radiusY += size + TICK_MARGIN;

    return angles.map((angle) => {
        const angleRad = degtorad(angle - 90);
        return {
            angle,
            x: x + radiusX * Math.cos(angleRad),
            y: y + radiusY * Math.sin(angleRad),
        };
    });
}

const DELTA = 0.01;

function includesAngle(angles: number[], value: number) {
    return angles.some((a) => value >= a - DELTA && value <= a + DELTA);
}

function getCornerTicks({ x, y, width, height }: Rectangle, size: number): TickProps[] {
    const left = x - size - TICK_MARGIN;
    const right = x + width + size + TICK_MARGIN;
    const top = y - size - TICK_MARGIN;
    const bottom = y + height + size + TICK_MARGIN;

    return [
        {
            x: left,
            y: top,
            angle: 0,
        },
        {
            x: right,
            y: top,
            angle: 0,
        },
        {
            x: left,
            y: bottom,
            angle: 0,
        },
        {
            x: right,
            y: bottom,
            angle: 0,
        },
    ];
}

function getRectangularTicks(
    { columns, rows }: RectangularTicks,
    { x, y, width, height }: Rectangle,
    size: number,
): TickProps[] {
    const ticks: TickProps[] = [];

    for (const center of getLinearGridDivs(columns, x, width)) {
        const top = y - size - TICK_MARGIN;
        const bottom = y + height + size + TICK_MARGIN;

        ticks.push(
            {
                x: center,
                y: top,
                angle: 0,
            },
            {
                x: center,
                y: bottom,
                angle: 0,
            },
        );
    }

    for (const center of getLinearGridDivs(rows, y, height)) {
        const left = y - size - TICK_MARGIN;
        const right = y + width + size + TICK_MARGIN;

        ticks.push(
            {
                x: left,
                y: center,
                angle: 0,
            },
            {
                x: right,
                y: center,
                angle: 0,
            },
        );
    }

    return ticks;
}
