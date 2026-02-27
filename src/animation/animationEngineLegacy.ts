/**
 * 旧版动画播放引擎 - Legacy
 * 新版请使用 animationV2Engine
 */

import { SceneObject, isMoveable, isRotateable, isResizable, isRadiusObject } from '../scene';
import { Animation, EasingType, Keyframe, KeyframeProperties } from './animationTypesLegacy';

/**
 * 缓动函数实现
 */
export const easingFunctions: Record<EasingType, (t: number) => number> = {
    [EasingType.Linear]: (t: number) => t,
    [EasingType.EaseIn]: (t: number) => t * t,
    [EasingType.EaseOut]: (t: number) => t * (2 - t),
    [EasingType.EaseInOut]: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

/**
 * 获取指定时间的画板对象状态
 */
export function getObjectsAtTime(animation: Animation, currentTime: number): SceneObject[] {
    if (animation.keyframes.length === 0) {
        return [];
    }

    // 如果只有一个关键帧，直接返回
    if (animation.keyframes.length === 1) {
        const firstKeyframe = animation.keyframes[0];
        if (firstKeyframe) {
            return [...firstKeyframe.objects];
        }
        return [];
    }

    // 找到当前时间所在的关键帧区间
    let prevKeyframe: Keyframe | null = null;
    let nextKeyframe: Keyframe | null = null;

    for (let i = 0; i < animation.keyframes.length; i++) {
        const keyframe = animation.keyframes[i];
        if (!keyframe) continue;

        if (keyframe.time <= currentTime) {
            prevKeyframe = keyframe;
        }

        if (keyframe.time >= currentTime) {
            nextKeyframe = keyframe;
            break;
        }
    }

    // 在第一个关键帧之前
    if (!prevKeyframe && nextKeyframe) {
        return [...nextKeyframe.objects];
    }

    // 在最后一个关键帧之后
    if (prevKeyframe && !nextKeyframe) {
        return [...prevKeyframe.objects];
    }

    // 正好在某个关键帧上
    if (prevKeyframe && nextKeyframe && prevKeyframe.time === currentTime) {
        return [...prevKeyframe.objects];
    }

    // 在两个关键帧之间，需要插值
    if (prevKeyframe && nextKeyframe) {
        return interpolateObjects(prevKeyframe, nextKeyframe, currentTime, animation.easing);
    }

    return [];
}

/**
 * 在两个关键帧之间插值所有对象
 */
function interpolateObjects(
    keyframe1: Keyframe,
    keyframe2: Keyframe,
    currentTime: number,
    easing: EasingType,
): SceneObject[] {
    const t = (currentTime - keyframe1.time) / (keyframe2.time - keyframe1.time);
    const easedT = easingFunctions[easing](Math.max(0, Math.min(1, t)));

    // 创建对象 ID 到对象的映射
    const objects1Map = new Map(keyframe1.objects.map((obj) => [obj.id, obj]));
    const objects2Map = new Map(keyframe2.objects.map((obj) => [obj.id, obj]));

    // 获取所有唯一的对象 ID
    const allIds = new Set([...objects1Map.keys(), ...objects2Map.keys()]);

    const result: SceneObject[] = [];

    for (const id of allIds) {
        const obj1 = objects1Map.get(id);
        const obj2 = objects2Map.get(id);

        if (obj1 && obj2) {
            // 两个关键帧中都存在该对象，进行插值
            const props1 = extractAnimatableProperties(obj1);
            const props2 = extractAnimatableProperties(obj2);
            const interpolatedProps = interpolateProperties(props1, props2, easedT);
            result.push(applyAnimationProperties(obj2, interpolatedProps));
        } else if (obj2) {
            // 只在第二个关键帧中存在，直接使用
            result.push(obj2);
        } else if (obj1) {
            // 只在第一个关键帧中存在，直接使用
            result.push(obj1);
        }
    }

    return result;
}

/**
 * 在两个属性集之间插值
 */
function interpolateProperties(props1: KeyframeProperties, props2: KeyframeProperties, t: number): KeyframeProperties {
    const interpolate = (v1: number | undefined, v2: number | undefined): number | undefined => {
        if (v1 !== undefined && v2 !== undefined) {
            return v1 + (v2 - v1) * t;
        }
        return v2 ?? v1;
    };

    return {
        x: interpolate(props1.x, props2.x),
        y: interpolate(props1.y, props2.y),
        rotation: interpolate(props1.rotation, props2.rotation),
        width: interpolate(props1.width, props2.width),
        height: interpolate(props1.height, props2.height),
        radius: interpolate(props1.radius, props2.radius),
        opacity: interpolate(props1.opacity, props2.opacity),
    };
}

/**
 * 应用动画属性到对象
 */
export function applyAnimationProperties(object: SceneObject, properties: KeyframeProperties): SceneObject {
    let updated: SceneObject = { ...object };

    // 应用位置
    if (isMoveable(updated) && (properties.x !== undefined || properties.y !== undefined)) {
        updated = {
            ...updated,
            x: properties.x ?? updated.x,
            y: properties.y ?? updated.y,
        } as SceneObject;
    }

    // 应用旋转
    if (isRotateable(updated) && properties.rotation !== undefined) {
        updated = {
            ...updated,
            rotation: properties.rotation,
        } as SceneObject;
    }

    // 应用尺寸
    if (isResizable(updated) && (properties.width !== undefined || properties.height !== undefined)) {
        updated = {
            ...updated,
            width: properties.width ?? updated.width,
            height: properties.height ?? updated.height,
        } as SceneObject;
    }

    // 应用半径
    if (isRadiusObject(updated) && properties.radius !== undefined) {
        updated = {
            ...updated,
            radius: properties.radius,
        } as SceneObject;
    }

    // 应用透明度
    if (properties.opacity !== undefined) {
        updated = {
            ...updated,
            opacity: properties.opacity,
        };
    }

    return updated;
}

/**
 * 从对象提取可动画化的属性
 */
export function extractAnimatableProperties(object: SceneObject): KeyframeProperties {
    const properties: KeyframeProperties = {
        opacity: object.opacity,
        ...(isMoveable(object) ? { x: object.x, y: object.y } : {}),
        ...(isRotateable(object) ? { rotation: object.rotation } : {}),
        ...(isResizable(object) ? { width: object.width, height: object.height } : {}),
        ...(isRadiusObject(object) ? { radius: object.radius } : {}),
    } as KeyframeProperties;

    return properties;
}
