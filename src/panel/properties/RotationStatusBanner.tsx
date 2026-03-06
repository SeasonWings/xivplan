import { Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { LockClosedRegular, TargetRegular } from '@fluentui/react-icons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { SceneObject } from '../../scene';
import { PropertiesControlProps } from '../PropertiesControl';

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalM,
    },
    banner: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        padding: tokens.spacingVerticalS,
        borderRadius: tokens.borderRadiusMedium,
    },
    locked: {
        backgroundColor: tokens.colorNeutralBackgroundDisabled,
        border: `1px solid ${tokens.colorNeutralStrokeDisabled}`,
        color: tokens.colorNeutralForegroundDisabled,
    },
    target: {
        backgroundColor: tokens.colorBrandBackground2,
        border: `1px solid ${tokens.colorBrandStroke1}`,
        color: tokens.colorNeutralForeground1,
    },
    text: {
        fontSize: tokens.fontSizeBase200,
    },
});

export const RotationStatusBanner: React.FC<PropertiesControlProps<SceneObject>> = ({ objects }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { step } = useScene();

    const object = objects.length === 1 ? objects[0] : null;
    const objectId = object?.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rotationLock = object ? (object as any).rotationLock : undefined;
    const isLocked = !!rotationLock;

    // Check if this object is a target for any other object
    const isTarget = useMemo(() => {
        if (!objectId) return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return step.objects.some((o) => (o as any).rotationLock?.targetId === objectId);
    }, [step.objects, objectId]);

    if (!object) {
        return null;
    }

    if (!isLocked && !isTarget) {
        return null;
    }

    return (
        <div className={classes.root}>
            {isLocked && (
                <div className={mergeClasses(classes.banner, classes.locked)}>
                    <LockClosedRegular />
                    <Text className={classes.text}>{t('properties.statusLocked', '此元素旋转已锁定')}</Text>
                </div>
            )}
            {isTarget && (
                <div className={mergeClasses(classes.banner, classes.target)}>
                    <TargetRegular />
                    <Text className={classes.text}>{t('properties.statusTarget', '此元素是旋转目标')}</Text>
                </div>
            )}
        </div>
    );
};
