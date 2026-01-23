import { Vector2d } from 'konva/lib/types';
import { rotateCoord } from './coord';
import { isMoveable, isRotateable, SceneObject } from './scene';

export function moveObjectsBy(objects: readonly SceneObject[], offset: Partial<Vector2d>): SceneObject[] {
    return objects.filter(isMoveable).map((obj) => {
        return {
            ...obj,
            x: obj.x + (offset?.x ?? 0),
            y: obj.y + (offset?.y ?? 0),
        };
    });
}

/**
 * 旋转同组的所有对象
 * @param objects - 所有对象列表
 * @param targetObjects - 被修改旋转角度的目标对象（作为旋转中心）
 * @param newRotation - 新的旋转角度
 * @returns 更新后的对象列表
 */
export function rotateGroupObjects(
    allObjects: readonly SceneObject[],
    targetObjects: readonly SceneObject[],
    newRotation: number,
): SceneObject[] {
    // 如果没有目标对象，返回空数组
    if (targetObjects.length === 0) {
        return [];
    }

    const targetObj = targetObjects[0];

    // 确保目标对象可移动（有 x, y 坐标）
    if (!isMoveable(targetObj)) {
        return targetObjects.map((obj) => ({
            ...obj,
            rotation: newRotation,
        }));
    }

    // 获取旋转中心点
    const rotationCenter: Vector2d = { x: targetObj.x, y: targetObj.y };

    // 计算旋转角度增量（如果目标对象可旋转）
    const oldRotation = isRotateable(targetObj) ? (targetObj.rotation ?? 0) : 0;
    const rotationDelta = newRotation - oldRotation;

    // 获取所有目标对象的groupId
    const groupIds = new Set(
        targetObjects
            .map((obj) => ('groupId' in obj ? obj.groupId : undefined))
            .filter((id): id is string => id !== undefined),
    );

    // 如果没有组，只更新目标对象自己
    if (groupIds.size === 0) {
        return targetObjects.map((obj) => ({
            ...obj,
            rotation: newRotation,
        }));
    }

    // 找出所有同组的成员（可移动或可旋转）
    const groupMembers = allObjects.filter(
        (obj) => 'groupId' in obj && obj.groupId && groupIds.has(obj.groupId) && (isMoveable(obj) || isRotateable(obj)),
    );

    if (groupMembers.length === 0) {
        return [];
    }

    // 更新所有组成员
    return groupMembers.map((obj) => {
        // 如果对象可移动，更新位置（围绕目标元素公转）
        if (isMoveable(obj)) {
            const newPos = rotateCoord({ x: obj.x, y: obj.y }, rotationDelta, rotationCenter);
            const updatedMoveable = {
                ...obj,
                x: Math.round(newPos.x),
                y: Math.round(newPos.y),
            };

            // 如果对象也可旋转，更新旋转角度（自转）
            if (isRotateable(obj)) {
                return {
                    ...updatedMoveable,
                    rotation: Math.round((obj.rotation ?? 0) + rotationDelta),
                };
            }

            return updatedMoveable;
        }

        // 如果对象只可旋转（不可移动），只更新旋转角度（自转）
        if (isRotateable(obj)) {
            return {
                ...obj,
                rotation: Math.round((obj.rotation ?? 0) + rotationDelta),
            };
        }

        return obj;
    });
}
