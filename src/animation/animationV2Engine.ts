/**
 * 动画播放引擎 V2 - 负责轨道项动画计算和插值
 */

import { isMoveable, isRotateable, SceneObject } from '../scene';
import { mod360 } from '../util';
import { vecAngle, vecSub } from '../vector';
import {
    AnimatedObjectProperties,
    AnimationEffectType,
    AnimationKeyframe,
    AnimationTrackItem,
    AnimationV2,
    EasingType,
} from './animationV2Types';

/**
 * 缓动函数实现
 */
export const easingFunctions: Record<EasingType, (t: number) => number> = {
    [EasingType.Linear]: (t: number) => t,
    [EasingType.EaseIn]: (t: number) => t * t,
    [EasingType.EaseOut]: (t: number) => t * (2 - t),
    [EasingType.EaseInOut]: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    [EasingType.EaseInCubic]: (t: number) => t * t * t,
    [EasingType.EaseOutCubic]: (t: number) => {
        const t1 = t - 1;
        return t1 * t1 * t1 + 1;
    },
    [EasingType.EaseInOutCubic]: (t: number) => {
        if (t < 0.5) {
            return 4 * t * t * t;
        }
        const t1 = 2 * t - 2;
        return 0.5 * t1 * t1 * t1 + 1;
    },
};

/**
 * 获取指定时间的所有对象状态
 */
export function getObjectsAtTimeV2(
    animation: AnimationV2,
    currentTime: number,
    originalObjects: readonly SceneObject[],
): SceneObject[] {
    if (animation.tracks.length === 0) {
        return [...originalObjects];
    }

    const result: SceneObject[] = [];
    const originalObjectsMap = new Map<number, SceneObject>(originalObjects.map((obj) => [obj.id, obj]));

    // 对每个原始对象应用动画
    for (const obj of originalObjects) {
        const activeItems: AnimationTrackItem[] = [];
        const endedItems: AnimationTrackItem[] = [];

        for (const track of animation.tracks) {
            if (!track.locked && track.visible) {
                for (const item of track.items) {
                    const targetGroupId = item.groupId;
                    const objGroupId = (obj as SceneObject & { groupId?: string }).groupId;
                    const isSameObject = item.objectIds ? item.objectIds.includes(obj.id) : item.objectId === obj.id;
                    const isSameGroup =
                        targetGroupId !== undefined && objGroupId !== undefined && targetGroupId === objGroupId;

                    if (!isSameObject && !isSameGroup) {
                        continue;
                    }

                    const endTime = item.startTime + item.duration;
                    if (currentTime >= item.startTime && currentTime < endTime) {
                        activeItems.push(item);
                    } else if (currentTime >= endTime) {
                        endedItems.push(item);
                    }
                }
            }
        }

        if (activeItems.length > 0) {
            // 按开始时间排序，后开始的效果优先级更高
            activeItems.sort((a, b) => a.startTime - b.startTime);

            // 计算该对象在当前时间的动画属性
            // 多个效果会叠加，但如果多个效果控制相同属性，后面的会覆盖前面的
            let properties: AnimatedObjectProperties = {};
            for (const item of activeItems) {
                const itemProps = calculateTrackItemPropertiesForObject(item, currentTime, obj, originalObjectsMap);
                // 智能合并：只更新有值的属性，如果多个效果控制相同属性，后面的覆盖前面的
                properties = mergeProperties(properties, itemProps);
            }
            const animatedObj = applyAnimationProperties(obj, properties);
            result.push(animatedObj);
        } else if (endedItems.length > 0) {
            // 没有活跃的效果，但有已结束的效果
            // 找到最近结束的效果，应用其最终状态
            endedItems.sort((a, b) => b.startTime + b.duration - (a.startTime + a.duration));
            const lastEndedItem = endedItems[0];
            if (lastEndedItem) {
                const finalProps = calculateTrackItemPropertiesForObject(
                    lastEndedItem,
                    lastEndedItem.startTime + lastEndedItem.duration,
                    obj,
                    originalObjectsMap,
                );
                // 确保 hide 有默认值
                const propsWithDefaultHide: AnimatedObjectProperties = {
                    ...finalProps,
                    hide: finalProps.hide ?? false,
                };
                const animatedObj = applyAnimationProperties(obj, propsWithDefaultHide);
                result.push(animatedObj);
            } else {
                result.push(obj);
            }
        } else {
            // 没有动画轨道，使用原始对象
            result.push(obj);
        }
    }

    const byId = new Map<number, SceneObject>(result.map((o) => [o.id, o]));
    const lockedIds = new Set<number>();
    for (const o of result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rl = (o as any).rotationLock as { targetId: number; delta: number } | undefined;
        if (!rl) continue;
        const target = byId.get(rl.targetId);
        if (!target) continue;
        if (!isMoveable(o) || !isRotateable(o) || !isMoveable(target)) continue;
        const v = vecSub({ x: target.x, y: target.y }, { x: o.x, y: o.y });
        const angle = vecAngle(v);
        const rotation = mod360(angle - rl.delta);
        byId.set(o.id, { ...o, rotation } as SceneObject);
        lockedIds.add(o.id);
    }

    if (lockedIds.size > 0) {
        return result.map((o) => byId.get(o.id) ?? o);
    }

    return result;
}

function calculateTrackItemPropertiesForObject(
    item: AnimationTrackItem,
    currentTime: number,
    obj: SceneObject,
    originalObjectsMap: ReadonlyMap<number, SceneObject>,
): AnimatedObjectProperties {
    const resolveFromBaseProps = (baseProps: AnimatedObjectProperties): AnimatedObjectProperties => {
        const itemGroupId = item.groupId;
        const objGroupId = (obj as SceneObject & { groupId?: string }).groupId;
        const isExplicitTarget = item.objectIds ? item.objectIds.includes(obj.id) : item.objectId === obj.id;

        const perObject = (
            baseProps as AnimatedObjectProperties & {
                perObject?: Readonly<Record<number, AnimatedObjectProperties>>;
            }
        ).perObject;

        if (perObject) {
            const entry = perObject[obj.id];
            if (entry) {
                const result: Record<string, unknown> = { ...entry };
                const hasOwnHide = Object.prototype.hasOwnProperty.call(entry, 'hide');
                if (!hasOwnHide && typeof baseProps.hide === 'boolean') {
                    result.hide = baseProps.hide;
                }
                return result as AnimatedObjectProperties;
            }
            if (itemGroupId && objGroupId && itemGroupId === objGroupId) {
                return {};
            }
        }

        if (!itemGroupId || !objGroupId || itemGroupId !== objGroupId || isExplicitTarget) {
            return baseProps;
        }

        const anchorOriginal = originalObjectsMap.get(item.objectId);
        const memberOriginal = originalObjectsMap.get(obj.id);

        if (!anchorOriginal || !memberOriginal) {
            return baseProps;
        }

        const anchorBaseX = (anchorOriginal as SceneObject & { x?: number }).x;
        const anchorBaseY = (anchorOriginal as SceneObject & { y?: number }).y;

        let dx = 0;
        let dy = 0;

        if (typeof baseProps.x === 'number' && typeof anchorBaseX === 'number') {
            dx = baseProps.x - anchorBaseX;
        }

        if (typeof baseProps.y === 'number' && typeof anchorBaseY === 'number') {
            dy = baseProps.y - anchorBaseY;
        }

        const memberBaseX = (memberOriginal as SceneObject & { x?: number }).x;
        const memberBaseY = (memberOriginal as SceneObject & { y?: number }).y;
        const anchorBaseRotation = (anchorOriginal as SceneObject & { rotation?: number }).rotation;
        const memberBaseRotation = (memberOriginal as SceneObject & { rotation?: number }).rotation;

        const result: Record<string, unknown> = {};

        if (typeof memberBaseX === 'number' && dx !== 0) {
            result.x = memberBaseX + dx;
        }

        if (typeof memberBaseY === 'number' && dy !== 0) {
            result.y = memberBaseY + dy;
        }

        if (typeof baseProps.rotation === 'number') {
            const anchorR0 = typeof anchorBaseRotation === 'number' ? anchorBaseRotation : 0;
            const memberR0 = typeof memberBaseRotation === 'number' ? memberBaseRotation : 0;
            const rotationDelta = baseProps.rotation - anchorR0;
            if (rotationDelta !== 0) {
                result.rotation = memberR0 + rotationDelta;
            }
        }

        const perObjectHide = (
            baseProps as AnimatedObjectProperties & {
                perObjectHide?: Readonly<Record<number, boolean | AnimatedObjectProperties>>;
            }
        ).perObjectHide;
        if (perObjectHide && Object.prototype.hasOwnProperty.call(perObjectHide, obj.id)) {
            const entry = perObjectHide[obj.id];
            if (typeof entry === 'boolean') {
                result.hide = entry;
            } else if (entry && typeof entry === 'object') {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { perObjectHide: _, ...overrideProps } = entry as Record<string, unknown>;
                const hasOwnHide = Object.prototype.hasOwnProperty.call(overrideProps, 'hide');

                for (const [key, value] of Object.entries(overrideProps)) {
                    if (key === 'hide') {
                        result.hide = value as boolean;
                    } else {
                        result[key] = value;
                    }
                }

                if (!hasOwnHide && typeof baseProps.hide === 'boolean') {
                    result.hide = baseProps.hide;
                }
            }
        } else if (typeof baseProps.hide === 'boolean') {
            result.hide = baseProps.hide;
        }

        return result as AnimatedObjectProperties;
    };

    const baseProps = calculateTrackItemProperties(item, currentTime);

    const isMultiTargetCurve =
        item.effectType === AnimationEffectType.CurveMove &&
        item.objectIds &&
        item.objectIds.length > 1 &&
        item.curveTargetId !== undefined &&
        item.objectIds.includes(obj.id);

    if (isMultiTargetCurve) {
        const curveTargetId = item.curveTargetId!;

        const moveItem: AnimationTrackItem = {
            ...item,
            effectType: AnimationEffectType.Move,
            curveConfig: undefined,
        };
        const moveBaseProps = calculateTrackItemProperties(moveItem, currentTime);

        if (obj.id !== curveTargetId) {
            return resolveFromBaseProps(moveBaseProps);
        }

        const linearProps = resolveFromBaseProps(moveBaseProps);

        const curveKeyframes: readonly AnimationKeyframe[] = item.keyframes.map((kf) => {
            const perObject = (
                kf.value as AnimatedObjectProperties & {
                    perObject?: Readonly<Record<number, AnimatedObjectProperties>>;
                }
            ).perObject;
            const entry = perObject ? perObject[curveTargetId] : undefined;
            return {
                ...kf,
                value: {
                    x: entry?.x ?? kf.value.x,
                    y: entry?.y ?? kf.value.y,
                } as AnimatedObjectProperties,
            };
        });

        const curveItem: AnimationTrackItem = {
            ...item,
            keyframes: curveKeyframes,
        };
        const curveProps = calculateTrackItemProperties(curveItem, currentTime);

        return {
            ...linearProps,
            x: curveProps.x ?? linearProps.x,
            y: curveProps.y ?? linearProps.y,
        };
    }

    return resolveFromBaseProps(baseProps);
}

/**
 * 计算单个轨道项的属性
 */
function calculateTrackItemProperties(item: AnimationTrackItem, currentTime: number): AnimatedObjectProperties {
    const relativeTime = currentTime - item.startTime;

    switch (item.effectType) {
        case AnimationEffectType.Move:
            return calculateMoveEffect(item, relativeTime);
        case AnimationEffectType.CurveMove:
            return calculateCurveMoveEffect(item, relativeTime);
        case AnimationEffectType.Custom:
            return calculateCustomEffect(item, relativeTime);
        default:
            return {};
    }
}

/**
 * 计算移动效果（包含位置、旋转、缩放的完整状态）
 */
function calculateMoveEffect(item: AnimationTrackItem, relativeTime: number): AnimatedObjectProperties {
    if (item.keyframes.length === 0) return {};
    if (item.keyframes.length === 1) {
        const kf = item.keyframes[0];
        if (!kf) return {};
        // 确保 hide 有默认值
        return {
            ...kf.value,
            hide: kf.value.hide ?? false,
        };
    }

    // 如果开启循环播放，将 relativeTime 对关键帧范围取模
    let effectiveRelativeTime = relativeTime;
    if (item.loop) {
        const firstKf = item.keyframes[0];
        const lastKf = item.keyframes[item.keyframes.length - 1];
        if (firstKf && lastKf) {
            const cycleLength = lastKf.time - firstKf.time;
            if (cycleLength > 0 && relativeTime > lastKf.time) {
                // 在最后一个节点后循环：将时间映射到 [firstKf.time, lastKf.time] 区间
                effectiveRelativeTime = firstKf.time + ((relativeTime - firstKf.time) % cycleLength);
            }
        }
    }

    // 找到当前时间所在的关键帧区间
    let prevKf: AnimationKeyframe | null = null;
    let nextKf: AnimationKeyframe | null = null;

    for (let i = 0; i < item.keyframes.length; i++) {
        const kf = item.keyframes[i];
        if (!kf) continue;

        if (kf.time <= effectiveRelativeTime) {
            prevKf = kf;
        }
        if (kf.time >= effectiveRelativeTime) {
            nextKf = kf;
            break;
        }
    }

    // 在第一个关键帧之前
    if (!prevKf && nextKf) {
        return {
            ...nextKf.value,
            hide: nextKf.value.hide ?? false,
        };
    }

    // 在最后一个关键帧之后（且未开启循环）
    if (prevKf && !nextKf) {
        return {
            ...prevKf.value,
            hide: prevKf.value.hide ?? false,
        };
    }

    // 正好在关键帧上
    if (prevKf && nextKf && prevKf.time === effectiveRelativeTime) {
        return {
            ...prevKf.value,
            hide: prevKf.value.hide ?? false,
        };
    }

    // 在两个关键帧之间插值
    if (prevKf && nextKf) {
        const t = (effectiveRelativeTime - prevKf.time) / (nextKf.time - prevKf.time);
        const easing = nextKf.easing || item.easing;
        const easedT = easingFunctions[easing](Math.max(0, Math.min(1, t)));

        const result = interpolateProperties(prevKf.value, nextKf.value, easedT);
        // 确保 hide 有默认值
        return {
            ...result,
            hide: result.hide ?? false,
        };
    }

    return {};
}

function calculateCurveMoveEffect(item: AnimationTrackItem, relativeTime: number): AnimatedObjectProperties {
    if (item.keyframes.length === 0) return {};
    const firstKf = item.keyframes[0];
    if (!firstKf) return {};

    const lastKf = item.keyframes[item.keyframes.length - 1] ?? firstKf;

    let effectiveRelativeTime = relativeTime;
    if (item.loop && item.keyframes.length > 1) {
        const cycleLength = lastKf.time - firstKf.time;
        if (cycleLength > 0 && relativeTime > lastKf.time) {
            effectiveRelativeTime = firstKf.time + ((relativeTime - firstKf.time) % cycleLength);
        }
    }

    const durationRange = Math.max(lastKf.time - firstKf.time, 1);
    const tRaw = (effectiveRelativeTime - firstKf.time) / durationRange;
    const easedT = easingFunctions[item.easing](Math.max(0, Math.min(1, tRaw)));

    const config = item.curveConfig;

    let loopTime = relativeTime;
    if (config?.mode === 'rotate') {
        const durationMs = Math.max(config.rotateDuration ?? item.duration, 1);
        loopTime = item.loop ? relativeTime % durationMs : Math.min(relativeTime, durationMs);
    }

    const base =
        config?.mode === 'rotate'
            ? calculateMoveEffect({ ...item, loop: false }, loopTime)
            : calculateMoveEffect(item, relativeTime);

    const startX = firstKf.value.x ?? base.x;
    const startY = firstKf.value.y ?? base.y;
    const endX = lastKf.value.x ?? startX;
    const endY = lastKf.value.y ?? startY;

    if (!config || startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
        return calculateMoveEffect(item, relativeTime);
    }

    let x = base.x;
    let y = base.y;

    if (config.mode === 'rotate') {
        const cx = config.centerX ?? 0;
        const cy = config.centerY ?? 0;
        const angleDeg = config.angle ?? 0;
        const angleRad = (angleDeg * Math.PI) / 180;

        const dx = startX - cx;
        const dy = startY - cy;

        // 顺逆时针方向：这里使用屏幕坐标系（Y 轴向下）
        // 为了符合「顺时针」和「逆时针」的直观感觉，反转原有符号：
        // - cw: 负角度
        // - ccw 或未指定: 正角度
        const direction = config.direction === 'cw' ? -1 : 1;

        const durationMs = Math.max(config.rotateDuration ?? item.duration, 1);
        const rotateTRaw = loopTime / durationMs;
        const rotateT = easingFunctions[item.easing](Math.max(0, Math.min(1, rotateTRaw)));
        const currentAngle = angleRad * direction * rotateT;
        const cosA = Math.cos(currentAngle);
        const sinA = Math.sin(currentAngle);

        x = cx + dx * cosA - dy * sinA;
        y = cy + dx * sinA + dy * cosA;
    } else if (config.mode === 'arc') {
        const angleDeg = config.angle ?? 0;
        const angleRad = (angleDeg * Math.PI) / 180;

        const ax = startX;
        const ay = startY;
        const bx = endX;
        const by = endY;

        const dx = bx - ax;
        const dy = by - ay;
        const chord = Math.sqrt(dx * dx + dy * dy);

        if (chord === 0 || angleRad === 0) {
            x = ax + (bx - ax) * easedT;
            y = ay + (by - ay) * easedT;
        } else {
            const halfAngle = angleRad / 2;
            const radius = chord / (2 * Math.sin(Math.abs(halfAngle)));

            const midX = (ax + bx) / 2;
            const midY = (ay + by) / 2;

            const nx = -dy / chord;
            const ny = dx / chord;

            // 选择圆心所在侧：使用几何上原来的约定
            const directionForCenter =
                config.direction === 'cw' ? 1 : config.direction === 'ccw' ? -1 : angleRad > 0 ? 1 : -1;
            const d = radius * Math.cos(halfAngle) * directionForCenter;

            const cx = midX + nx * d;
            const cy = midY + ny * d;

            const startAngle = Math.atan2(ay - cy, ax - cx);

            // 为了与「绕圆心旋转」模式保持顺逆时针一致，这里复用相同的方向约定：
            // 在 rotate 模式中：cw => -1, ccw/未指定 => 1
            const sweepDirection = config.direction === 'cw' ? -1 : 1;
            const sweepAngle = sweepDirection * angleRad;
            const currentAngle = startAngle + sweepAngle * easedT;

            x = cx + radius * Math.cos(currentAngle);
            y = cy + radius * Math.sin(currentAngle);
        }
    } else if (config.mode === 'bezier') {
        const cx1 = config.controlX1 ?? startX;
        const cy1 = config.controlY1 ?? startY;
        const cx2 = config.controlX2 ?? endX;
        const cy2 = config.controlY2 ?? endY;

        const u = 1 - easedT;

        x =
            u * u * u * startX +
            3 * u * u * easedT * cx1 +
            3 * u * easedT * easedT * cx2 +
            easedT * easedT * easedT * endX;
        y =
            u * u * u * startY +
            3 * u * u * easedT * cy1 +
            3 * u * easedT * easedT * cy2 +
            easedT * easedT * easedT * endY;
    }

    return {
        ...base,
        x,
        y,
    };
}

/**
 * 计算自定义关键帧效果
 */
function calculateCustomEffect(item: AnimationTrackItem, relativeTime: number): AnimatedObjectProperties {
    if (item.keyframes.length === 0) return {};
    if (item.keyframes.length === 1) {
        const kf = item.keyframes[0];
        if (!kf) return {};
        return {
            ...kf.value,
            hide: kf.value.hide ?? false,
        };
    }

    // 如果开启循环播放，将 relativeTime 对关键帧范围取模
    let effectiveRelativeTime = relativeTime;
    if (item.loop) {
        const firstKf = item.keyframes[0];
        const lastKf = item.keyframes[item.keyframes.length - 1];
        if (firstKf && lastKf) {
            const cycleLength = lastKf.time - firstKf.time;
            if (cycleLength > 0 && relativeTime > lastKf.time) {
                // 在最后一个节点后循环：将时间映射到 [firstKf.time, lastKf.time] 区间
                effectiveRelativeTime = firstKf.time + ((relativeTime - firstKf.time) % cycleLength);
            }
        }
    }

    // 找到当前时间所在的关键帧区间
    let prevKf: AnimationKeyframe | null = null;
    let nextKf: AnimationKeyframe | null = null;

    for (let i = 0; i < item.keyframes.length; i++) {
        const kf = item.keyframes[i];
        if (!kf) continue;

        if (kf.time <= effectiveRelativeTime) {
            prevKf = kf;
        }
        if (kf.time >= effectiveRelativeTime) {
            nextKf = kf;
            break;
        }
    }

    // 在第一个关键帧之前
    if (!prevKf && nextKf) {
        return {
            ...nextKf.value,
            hide: nextKf.value.hide ?? false,
        };
    }

    // 在最后一个关键帧之后（且未开启循环）
    if (prevKf && !nextKf) {
        return {
            ...prevKf.value,
            hide: prevKf.value.hide ?? false,
        };
    }

    // 正好在关键帧上
    if (prevKf && nextKf && prevKf.time === effectiveRelativeTime) {
        return {
            ...prevKf.value,
            hide: prevKf.value.hide ?? false,
        };
    }

    // 在两个关键帧之间插值
    if (prevKf && nextKf) {
        const t = (effectiveRelativeTime - prevKf.time) / (nextKf.time - prevKf.time);
        const easing = nextKf.easing || item.easing;
        const easedT = easingFunctions[easing](Math.max(0, Math.min(1, t)));

        const result = interpolateProperties(prevKf.value, nextKf.value, easedT);
        return {
            ...result,
            hide: result.hide ?? false,
        };
    }

    return {};
}

/**
 * 插值两个对象属性
 * 支持所有属性的插值，包括自定义属性
 */
function interpolateProperties(
    props1: AnimatedObjectProperties,
    props2: AnimatedObjectProperties,
    t: number,
): AnimatedObjectProperties {
    const result: Record<string, unknown> = {};

    // 获取所有属性键
    const allKeys = new Set([...Object.keys(props1), ...Object.keys(props2)]);

    // 对每个属性进行插值
    for (const key of allKeys) {
        const v1 = props1[key as keyof AnimatedObjectProperties];
        const v2 = props2[key as keyof AnimatedObjectProperties];

        // hide 使用前一个关键帧的值（步进，而不是朝下一帧过渡）
        if (key === 'hide') {
            const prevHide = (props1 as AnimatedObjectProperties).hide;
            result[key] = typeof prevHide === 'boolean' ? prevHide : false;
            continue;
        }

        // perObject 需要按对象ID递归插值（新结构）
        if (key === 'perObject') {
            const map1 = v1 as Readonly<Record<number, AnimatedObjectProperties>> | undefined;
            const map2 = v2 as Readonly<Record<number, AnimatedObjectProperties>> | undefined;

            if (!map1 && !map2) {
                continue;
            }

            const merged: Record<number, AnimatedObjectProperties> = {};
            const allIds = new Set<number>([
                ...(map1 ? Object.keys(map1).map((id) => Number(id)) : []),
                ...(map2 ? Object.keys(map2).map((id) => Number(id)) : []),
            ]);

            for (const id of allIds) {
                const e1 = map1 ? map1[id] : undefined;
                const e2 = map2 ? map2[id] : undefined;

                if (!e1 && !e2) {
                    continue;
                }

                if (e1 && e2) {
                    merged[id] = interpolateProperties(
                        e1 as AnimatedObjectProperties,
                        e2 as AnimatedObjectProperties,
                        t,
                    );
                } else {
                    merged[id] = (e2 ?? e1) as AnimatedObjectProperties;
                }
            }

            if (Object.keys(merged).length > 0) {
                result[key] = merged;
            }
            continue;
        }

        // perObjectHide 需要按对象ID递归插值（旧结构兼容）
        if (key === 'perObjectHide') {
            const map1 = v1 as Readonly<Record<number, boolean | AnimatedObjectProperties>> | undefined;
            const map2 = v2 as Readonly<Record<number, boolean | AnimatedObjectProperties>> | undefined;

            if (!map1 && !map2) {
                continue;
            }

            const merged: Record<number, boolean | AnimatedObjectProperties> = {};
            const allIds = new Set<number>([
                ...(map1 ? Object.keys(map1).map((id) => Number(id)) : []),
                ...(map2 ? Object.keys(map2).map((id) => Number(id)) : []),
            ]);

            for (const id of allIds) {
                const e1 = map1 ? map1[id] : undefined;
                const e2 = map2 ? map2[id] : undefined;

                if (e1 === undefined && e2 === undefined) {
                    continue;
                }

                if (typeof e1 === 'boolean' || typeof e2 === 'boolean') {
                    merged[id] = (e2 !== undefined ? e2 : e1) as boolean;
                } else if (e1 && e2) {
                    merged[id] = interpolateProperties(
                        e1 as AnimatedObjectProperties,
                        e2 as AnimatedObjectProperties,
                        t,
                    );
                } else {
                    merged[id] = (e2 ?? e1) as AnimatedObjectProperties;
                }
            }

            if (Object.keys(merged).length > 0) {
                result[key] = merged;
            }
            continue;
        }

        // 如果两个值都是数字，进行数值插值
        if (typeof v1 === 'number' && typeof v2 === 'number') {
            result[key] = interpolateValue(v1, v2, t);
        }
        // 如果是字符串（如 color），直接使用目标值（不插值）
        else if (typeof v1 === 'string' || typeof v2 === 'string') {
            result[key] = t >= 0.5 ? v2 : v1;
        }
        // 其他情况，直接使用目标值
        else {
            result[key] = v2 ?? v1;
        }
    }

    return result as AnimatedObjectProperties;
}

/**
 * 插值两个数值
 */
function interpolateValue(v1: number | undefined, v2: number | undefined, t: number): number | undefined {
    if (v1 !== undefined && v2 !== undefined) {
        return v1 + (v2 - v1) * t;
    }
    return v2 ?? v1;
}

/**
 * 合并动画属性
 * 如果 props2 中的属性有值，则使用 props2 的值；否则保留 props1 的值
 * 这样可以实现多个效果的叠加，同时正确处理相同属性的覆盖
 *
 * 规则：
 * - 不同属性：叠加（例如 Move效果的x,y + Fade效果的opacity）
 * - 相同属性：后面的覆盖前面的（例如 两个Move效果都控制x,y，后开始的生效）
 *
 * 示例：
 * - props1 = { x: 100, y: 100 }（第一个Move效果）
 * - props2 = { x: 200, opacity: 0.5 }（第二个Move效果+Fade效果）
 * - 结果 = { x: 200, y: 100, opacity: 0.5 }（x被覆盖，y保留，opacity叠加）
 */
function mergeProperties(props1: AnimatedObjectProperties, props2: AnimatedObjectProperties): AnimatedObjectProperties {
    const result: Record<string, unknown> = { ...props1 };

    for (const [key, value] of Object.entries(props2)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }

    return result as AnimatedObjectProperties;
}

/**
 * 应用动画属性到对象
 * 支持所有属性的应用，包括自定义属性
 */
export function applyAnimationProperties(object: SceneObject, properties: AnimatedObjectProperties): SceneObject {
    const updated: SceneObject = { ...object };

    // 应用所有属性
    for (const [key, value] of Object.entries(properties)) {
        // 跳过 undefined 值以及仅用于内部计算的字段
        if (value !== undefined && key !== 'perObjectHide' && key !== 'perObject') {
            (updated as unknown as Record<string, unknown>)[key] = value;
        }
    }

    return updated;
}

/**
 * 从对象提取可动画化的属性 - 返回对象的全部属性
 */
export function extractAnimatableProperties(object: SceneObject): AnimatedObjectProperties {
    // 排除 id 和 type 字段，返回对象的全部属性
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, type: __, ...rest } = object as unknown as Record<string, unknown>;
    return rest as AnimatedObjectProperties;
}
