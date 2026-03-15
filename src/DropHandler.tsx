import { Vector2d } from 'konva/lib/types';
import React from 'react';
import { PanelDragObject } from './PanelDragContext';
import { SceneAction } from './SceneProvider';
import { SceneObject, SceneObjectWithoutId, UserLayer } from './scene';
import { asArray, round } from './util';

export type DropHandler<T extends SceneObject> = (object: Partial<T>, position: Vector2d) => SceneAction;
const dropHandlers: Record<string, DropHandler<SceneObject>> = {};

export function registerDropHandler<T extends SceneObject>(types: string | string[], handler: DropHandler<T>): void {
    for (const type of asArray(types)) {
        dropHandlers[type] = handler as DropHandler<SceneObject>;
    }
}

export function getDropAction(object: PanelDragObject, position: Vector2d): SceneAction | undefined {
    if (!object.object.type) {
        throw new Error('Drag object is missing type');
    }

    const handler = dropHandlers[object.object.type];
    if (handler) {
        const action = handler(object.object as SceneObject, position);
        if (action.type === 'add') {
            const ensureLayer = (obj: SceneObjectWithoutId) => {
                const layer = obj.layer as UserLayer | undefined;
                return layer ? obj : { ...obj, layer: 'main' as const };
            };
            const isArray = (
                value: SceneObjectWithoutId | readonly SceneObjectWithoutId[],
            ): value is readonly SceneObjectWithoutId[] => Array.isArray(value);
            if (isArray(action.object)) {
                return { ...action, object: action.object.map((o) => ensureLayer(o)) };
            }
            return { ...action, object: ensureLayer(action.object as SceneObjectWithoutId) };
        }
        return action;
    }
    return undefined;
}

export function getDragOffset(e: React.DragEvent<HTMLElement>): Vector2d {
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    return round({ x: e.clientX - centerX, y: e.clientY - centerY });
}
