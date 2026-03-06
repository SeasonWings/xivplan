import { makeStyles, tokens, Tooltip } from '@fluentui/react-components';
import { LockClosedRegular, TargetRegular } from '@fluentui/react-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { getDynamicColor } from './colorUtils';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: tokens.borderRadiusMedium,
        fontSize: '11px', // 稍微调小字体以适应列表
        fontWeight: tokens.fontWeightSemibold,
        lineHeight: '16px',
        border: '1px solid transparent',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        height: '20px',
        boxSizing: 'border-box',
    },
    icon: {
        marginRight: '4px',
        fontSize: '12px',
        display: 'flex',
    },
});

export interface StatusIndicatorsProps {
    lockedSeed?: number; // 如果存在则显示锁定状态，使用此ID生成颜色
    targetSeed?: number; // 如果存在则显示目标状态，使用此ID生成颜色
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({ lockedSeed, targetSeed }) => {
    const classes = useStyles();
    const { t } = useTranslation();

    const isLocked = lockedSeed !== undefined;
    const isTarget = targetSeed !== undefined;

    if (!isLocked && !isTarget) return null;

    const renderBadge = (type: 'locked' | 'target', seed: number) => {
        const color = getDynamicColor(seed);
        const text = type === 'locked' ? t('properties.locked', '锁定') : t('properties.target', '目标');
        const Icon = type === 'locked' ? LockClosedRegular : TargetRegular;
        const tooltip =
            type === 'locked'
                ? t('properties.rotationLocked', '已锁定旋转')
                : t('properties.rotationTarget', '旋转目标');

        return (
            <Tooltip content={tooltip} relationship="label">
                <div
                    className={classes.badge}
                    style={{
                        backgroundColor: color.background,
                        color: color.color,
                        borderColor: color.border,
                    }}
                >
                    <span className={classes.icon}>
                        <Icon />
                    </span>
                    {text}
                </div>
            </Tooltip>
        );
    };

    return (
        <div className={classes.container}>
            {isLocked && renderBadge('locked', lockedSeed!)}
            {isTarget && renderBadge('target', targetSeed!)}
        </div>
    );
};
