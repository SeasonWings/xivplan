import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    Radio,
    RadioGroup,
} from '@fluentui/react-components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { SceneObject, isMoveable, isRotateable } from '../../scene';
import { useControlStyles } from '../../useControlStyles';
import { PropertiesControlProps } from '../PropertiesControl';

function isEligible(o: SceneObject) {
    return isMoveable(o) && isRotateable(o);
}

export const RotationPivotLockControl: React.FC<PropertiesControlProps<SceneObject>> = ({ objects }) => {
    const classes = useControlStyles();
    const { dispatch } = useScene();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [lockedId, setLockedId] = useState<number | null>(null);

    const eligible = objects.filter(isEligible);
    const anyLocked = objects.some(
        (o) => 'rotationLock' in o && (o as unknown as { rotationLock?: unknown }).rotationLock,
    );

    const canLock = eligible.length === 2;
    const canUnlock = objects.length === 1 && anyLocked;

    const getDisplayName = (o: SceneObject) => {
        if ('name' in o && typeof o.name === 'string' && o.name) {
            return o.name;
        }
        if ('defaultNameKey' in o && typeof o.defaultNameKey === 'string' && o.defaultNameKey) {
            return t(o.defaultNameKey);
        }
        return t(`objects.${o.type}`, { defaultValue: o.type });
    };

    const onOpen = () => {
        if (canLock) {
            setLockedId(eligible[0]?.id ?? null);
            setOpen(true);
        }
    };

    const onConfirm = () => {
        if (!canLock || lockedId == null) {
            setOpen(false);
            return;
        }
        const locked = eligible.find((o) => o.id === lockedId);
        const target = eligible.find((o) => o.id !== lockedId);
        if (!locked || !target) {
            setOpen(false);
            return;
        }
        if (!isMoveable(locked) || !isRotateable(locked) || !isMoveable(target)) {
            setOpen(false);
            return;
        }
        const delta = target.rotation - locked.rotation;
        const updatedLocked: SceneObject = {
            ...(locked as SceneObject),
            pinned: true,
            rotationLock: { targetId: target.id, delta, baseRotation: locked.rotation },
        } as SceneObject;
        dispatch({ type: 'update', value: [updatedLocked] });
        setOpen(false);
    };

    const onUnlock = () => {
        if (!canUnlock) return;
        const o = objects[0] as SceneObject;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated: any = { ...o };
        delete updated.rotationLock;
        updated.pinned = false;
        dispatch({ type: 'update', value: [updated as SceneObject] });
    };

    if (canLock) {
        return (
            <>
                <Button appearance="secondary" className={classes.cell} onClick={onOpen}>
                    {t('properties.lockRotationPivot', '锁定旋转点')}
                </Button>
                <Dialog open={open} onOpenChange={() => setOpen(false)}>
                    <DialogSurface>
                        <DialogTitle>{t('properties.choosePivot', '选择锁定元素')}</DialogTitle>
                        <DialogBody>
                            <DialogContent>
                                <Field label={t('properties.chooseLockedElement', '请选择锁定元素')}>
                                    <RadioGroup
                                        value={lockedId?.toString() ?? ''}
                                        onChange={(_, data) => setLockedId(parseInt(data.value))}
                                    >
                                        {eligible.map((o) => (
                                            <Radio key={o.id} value={o.id.toString()} label={getDisplayName(o)} />
                                        ))}
                                    </RadioGroup>
                                </Field>
                            </DialogContent>
                        </DialogBody>
                        <DialogActions>
                            <Button appearance="primary" onClick={onConfirm}>
                                {t('actions.apply', '应用')}
                            </Button>
                            <Button onClick={() => setOpen(false)}>{t('actions.cancel', '取消')}</Button>
                        </DialogActions>
                    </DialogSurface>
                </Dialog>
            </>
        );
    }

    if (canUnlock) {
        return (
            <Button appearance="secondary" className={classes.cell} onClick={onUnlock}>
                {t('properties.unlockRotationPivot', '解锁旋转点')}
            </Button>
        );
    }

    return null;
};
