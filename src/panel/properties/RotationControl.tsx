import { Field } from '@fluentui/react-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { rotateGroupObjects } from '../../groupOperations';
import { useScene } from '../../SceneProvider';
import { SpinButtonUnits } from '../../SpinButtonUnits';
import { useSpinChanged } from '../../prefabs/useSpinChanged';
import { EnemyObject, EnemyRingStyle, RotateableObject, isEnemy } from '../../scene';
import { useControlStyles } from '../../useControlStyles';
import { commonValue } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';

export const RotationControl: React.FC<PropertiesControlProps<RotateableObject | EnemyObject>> = ({ objects }) => {
    const classes = useControlStyles();
    const { step, dispatch } = useScene();
    const { t } = useTranslation();

    const rotation = commonValue(objects, (obj) => obj.rotation);
    const noDirection = commonValue(objects, (obj) => isEnemy(obj) && obj.ring == EnemyRingStyle.NoDirection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rotationLocked = commonValue(objects, (obj) => 'rotationLock' in (obj as any) && !!(obj as any).rotationLock);

    const onRotationChanged = useSpinChanged((rotation: number) => {
        // 使用 rotateGroupObjects 同步旋转同组的所有对象
        const updatedObjects = rotateGroupObjects(step.objects, objects, rotation);
        dispatch({ type: 'update', value: updatedObjects });
    });

    return (
        <Field label={t('properties.rotation')} className={classes.cell}>
            <SpinButtonUnits
                disabled={noDirection || rotationLocked}
                value={rotation}
                onChange={onRotationChanged}
                step={5}
                fractionDigits={1}
                suffix="°"
            />
        </Field>
    );
};
