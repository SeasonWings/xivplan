import { Field, ToggleButton, Tooltip } from '@fluentui/react-components';
import { LockClosedRegular, LockMultipleRegular, LockOpenRegular } from '@fluentui/react-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { SpinButton } from '../../SpinButton';
import { useSpinChanged } from '../../prefabs/useSpinChanged';
import type { MoveableObject, SceneObject } from '../../scene';
import { useControlStyles } from '../../useControlStyles';
import { commonValue, setOrOmit } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';

function isGroupMoveable(
    o: unknown,
    groupId: string,
): o is MoveableObject & { id: number; x: number; y: number; pinned?: boolean; groupId?: string } {
    if (typeof o !== 'object' || o === null) return false;
    const obj = o as Record<string, unknown>;
    return (
        typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.id === 'number' && obj.groupId === groupId
    );
}

function notPinned(o: { pinned?: boolean }): boolean {
    return !(typeof o.pinned === 'boolean' && o.pinned);
}

export const PositionControl: React.FC<PropertiesControlProps<MoveableObject>> = ({ objects }) => {
    const classes = useControlStyles();
    const { dispatch, step } = useScene();
    const { t } = useTranslation();

    const x = commonValue(objects, (obj) => obj.x);
    const y = commonValue(objects, (obj) => obj.y);
    const pinned = commonValue(objects, (obj) => !!obj.pinned);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rotationLocked = commonValue(objects, (obj) => 'rotationLock' in (obj as any) && !!(obj as any).rotationLock);

    const onTogglePinned = () =>
        dispatch({ type: 'update', value: objects.map((obj) => setOrOmit(obj, 'pinned', !pinned)) });

    const onXChanged = useSpinChanged((newX: number) => {
        // 单选并且对象属于某个组时，按偏移联动更新同组元素
        if (objects.length === 1) {
            const obj = objects[0] as MoveableObject & { id: number; groupId?: string; pinned?: boolean };
            const dx = Math.round(newX - obj.x);
            if (dx !== 0 && obj.groupId) {
                const groupMembers = step.objects.filter(
                    (
                        o,
                    ): o is SceneObject &
                        MoveableObject & {
                            id: number;
                            x: number;
                            y: number;
                            pinned?: boolean;
                            groupId?: string;
                        } => isGroupMoveable(o, obj.groupId!),
                );
                const updated = groupMembers
                    .filter((m) => notPinned(m)) // 跳过锁定元素
                    .map((m) =>
                        m.id === obj.id
                            ? { ...m, x: newX }
                            : {
                                  ...m,
                                  x: m.x + dx,
                              },
                    );
                dispatch({ type: 'update', value: updated });
                return;
            }
        }
        dispatch({ type: 'update', value: objects.map((obj) => ({ ...obj, x: newX })) });
    });
    const onYChanged = useSpinChanged((newY: number) => {
        if (objects.length === 1) {
            const obj = objects[0] as MoveableObject & { id: number; groupId?: string; pinned?: boolean };
            const dy = Math.round(newY - obj.y);
            if (dy !== 0 && obj.groupId) {
                const groupMembers = step.objects.filter(
                    (
                        o,
                    ): o is SceneObject &
                        MoveableObject & {
                            id: number;
                            x: number;
                            y: number;
                            pinned?: boolean;
                            groupId?: string;
                        } => isGroupMoveable(o, obj.groupId!),
                );
                const updated = groupMembers
                    .filter((m) => notPinned(m))
                    .map((m) =>
                        m.id === obj.id
                            ? { ...m, y: newY }
                            : {
                                  ...m,
                                  y: m.y + dy,
                              },
                    );
                dispatch({ type: 'update', value: updated });
                return;
            }
        }
        dispatch({ type: 'update', value: objects.map((obj) => ({ ...obj, y: newY })) });
    });

    const icon = pinned === undefined ? <LockMultipleRegular /> : pinned ? <LockClosedRegular /> : <LockOpenRegular />;
    const tooltip = pinned ? t('properties.unlockPosition') : t('properties.lockPosition');

    return (
        <>
            <div className={classes.row}>
                <Field label={t('properties.x')}>
                    <SpinButton value={x} onChange={onXChanged} step={1} disabled={rotationLocked} />
                </Field>
                <Field label={t('properties.y')}>
                    <SpinButton value={y} onChange={onYChanged} step={1} disabled={rotationLocked} />
                </Field>
                <Tooltip content={tooltip} relationship="label" withArrow>
                    <ToggleButton checked={pinned} onClick={onTogglePinned} icon={icon} disabled={rotationLocked} />
                </Tooltip>
            </div>
        </>
    );
};
