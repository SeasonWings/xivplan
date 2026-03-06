import { Button, makeStyles, mergeClasses, tokens, typographyStyles } from '@fluentui/react-components';
import {
    ArrowFitInFilled,
    bundleIcon,
    DismissFilled,
    DismissRegular,
    EyeFilled,
    EyeOffFilled,
    EyeOffRegular,
    EyeRegular,
} from '@fluentui/react-icons';
import React, { ReactNode, useMemo } from 'react';
import { useScene } from '../SceneProvider';
import { PrefabIcon } from '../prefabs/PrefabIcon';
import { SceneObject, UnknownObject } from '../scene';
import { selectGroup, useSelection } from '../selection';
import { setOrOmit } from '../util';
import { StatusIndicators } from './StatusIndicators';
import { detailsItemClassNames } from './detailsItemStyles';

export interface DetailsItemProps {
    object: SceneObject;
    icon?: string | ReactNode;
    name: string;
    children?: ReactNode;
    isNested?: boolean;
    isDragging?: boolean;
    isSelected?: boolean;
}

// TODO: only show hide button if hidden or hovered/selected

// 为不同的组ID生成一致的颜色
function getGroupColor(groupId: string): string {
    // 使用groupId生成一致的哈希值
    let hash = 0;
    for (let i = 0; i < groupId.length; i++) {
        hash = (hash << 5) - hash + groupId.charCodeAt(i);
        hash = hash & hash; // 转换为32位整数
    }

    // 使用哈希值生成HSL颜色（色相由哈希值决定，饱和度和亮度固定以保证颜色鲜明）
    const hue = Math.abs(hash) % 360; // 色相：0-360度
    const saturation = 65; // 饱和度：65%（保证颜色鲜艳但不过分）
    const lightness = 50; // 亮度：50%（保证颜色不太暗也不太亮）

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export const DetailsItem: React.FC<DetailsItemProps> = ({
    object,
    icon,
    name,
    isNested,
    isDragging,
    isSelected,
    children,
}) => {
    const classes = useStyles();
    const { step } = useScene();
    const [, setSelection] = useSelection();

    const size = isNested ? 20 : undefined;
    const hasGroup = 'groupId' in object && object.groupId;
    const groupColor = hasGroup ? getGroupColor(object.groupId as string) : undefined;

    const isLocked = !!(object as UnknownObject & { rotationLock?: { targetId: number } }).rotationLock;
    const lockedSeed = isLocked
        ? (object as UnknownObject & { rotationLock?: { targetId: number } }).rotationLock?.targetId
        : undefined;

    const isTarget = useMemo(
        () =>
            step.objects.some(
                (o) =>
                    (o as UnknownObject & { rotationLock?: { targetId: number } }).rotationLock?.targetId === object.id,
            ),
        [step.objects, object.id],
    );
    const targetSeed = isTarget ? object.id : undefined;

    const handleGroupIconClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasGroup) {
            setSelection(selectGroup(step.objects, object.groupId as string));
        }
    };

    return (
        <div className={mergeClasses(classes.wrapper, isNested && classes.nested)}>
            <div>{icon && <PrefabIcon icon={icon} name={name} width={size} height={size} />}</div>
            {children ? (
                children
            ) : (
                <div className={classes.name}>
                    <span className={classes.nameText}>{name}</span>
                    <StatusIndicators lockedSeed={lockedSeed} targetSeed={targetSeed} />
                </div>
            )}
            {!isNested && (
                <div className={classes.buttons}>
                    {hasGroup && groupColor && (
                        <div
                            className={classes.groupIndicator}
                            title="点击选中组内所有元素"
                            onClick={handleGroupIconClick}
                            data-tutorial="group-arrow"
                        >
                            <ArrowFitInFilled fontSize={16} style={{ color: groupColor }} />
                        </div>
                    )}
                    <DetailsItemHideButton
                        object={object}
                        className={mergeClasses(isSelected && classes.selectedButton, isDragging && classes.visible)}
                    />
                    <DetailsItemDeleteButton
                        object={object}
                        className={mergeClasses(isSelected && classes.selectedButton)}
                    />
                </div>
            )}
        </div>
    );
};

interface DetailsItemHideButtonProps {
    object: SceneObject;
    className?: string;
}

const EyeOffIcon = bundleIcon(EyeOffFilled, EyeOffRegular);
const EyeIcon = bundleIcon(EyeFilled, EyeRegular);

const DetailsItemHideButton: React.FC<DetailsItemHideButtonProps> = ({ object, className }) => {
    const classes = useStyles();
    const { dispatch } = useScene();
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        dispatch({ type: 'update', value: setOrOmit(object, 'hide', !object.hide) });
        e.stopPropagation();
    };

    const Icon = object.hide ? EyeOffIcon : EyeIcon;
    const tooltip = object.hide ? 'Show' : 'Hide';

    return (
        <Button
            appearance="transparent"
            className={mergeClasses(
                detailsItemClassNames.hideButton,
                classes.hideButton,
                object.hide && classes.visible,
                className,
            )}
            icon={<Icon />}
            onClick={handleClick}
            title={tooltip}
        />
    );
};

interface DetailsItemDeleteButtonProps {
    object: SceneObject;
    className?: string;
}

const DeleteIcon = bundleIcon(DismissFilled, DismissRegular);

const DetailsItemDeleteButton: React.FC<DetailsItemDeleteButtonProps> = ({ object, className }) => {
    const { dispatch } = useScene();
    const deleteObject = () => dispatch({ type: 'remove', ids: object.id });

    return (
        <Button
            appearance="transparent"
            className={className}
            icon={<DeleteIcon />}
            onClick={deleteObject}
            title="Delete object"
        />
    );
};

const useStyles = makeStyles({
    wrapper: {
        display: 'flex',
        flexFlow: 'row',
        alignItems: 'center',
        padding: tokens.spacingHorizontalXXS,
        gap: tokens.spacingHorizontalS,

        [`:hover .${detailsItemClassNames.hideButton}`]: {
            opacity: 1,
        },
    },

    name: {
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        gap: tokens.spacingHorizontalXS,
    },

    nameText: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: '0 1 auto',
        minWidth: 0,
    },

    nested: {
        gap: tokens.spacingHorizontalXS,
        ...typographyStyles.caption1,
    },

    buttons: {
        display: 'flex',
        flexFlow: 'row',
    },

    hideButton: {
        opacity: 0,
        transitionProperty: 'opacity',
        transitionDuration: tokens.durationFaster,
        transitionTimingFunction: tokens.curveEasyEase,
    },

    visible: {
        opacity: 1,
    },

    selectedButton: {
        color: tokens.colorNeutralForegroundOnBrand,

        ':hover': {
            color: tokens.colorNeutralForegroundOnBrand,
        },
    },

    groupIndicator: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: tokens.spacingHorizontalXXS,
        cursor: 'pointer',

        ':hover': {
            opacity: 0.8,
        },
    },
});
