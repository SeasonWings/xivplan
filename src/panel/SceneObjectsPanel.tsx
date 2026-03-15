import { Button, makeStyles, mergeClasses, tokens, typographyStyles } from '@fluentui/react-components';
import { ChevronDownRegular, ChevronRightRegular } from '@fluentui/react-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../SceneProvider';
import { SceneObject } from '../scene';
import { useControlStyles } from '../useControlStyles';
import { ObjectList } from './ObjectList';

export interface SceneObjectsPanelProps {
    className?: string;
}

export const SceneObjectsPanel: React.FC<SceneObjectsPanelProps> = ({ className }) => {
    const classes = useControlStyles();
    const local = useStyles();
    const { dispatch, step } = useScene();
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState({ background: false, main: false, foreground: false });

    const allObjects = step.objects;
    const bg = allObjects.filter((o) => (o.layer ?? 'main') === 'background');
    const main = allObjects.filter((o) => (o.layer ?? 'main') === 'main');
    const fg = allObjects.filter((o) => (o.layer ?? 'main') === 'foreground');

    return (
        <div className={mergeClasses(classes.panel, classes.noSelect, className)} data-tutorial="scene-objects-panel">
            {fg.length > 0 && (
                <div className={local.group}>
                    <LayerGroupHeader
                        title={t('properties.layerForeground', { defaultValue: '前景层' })}
                        count={fg.length}
                        collapsed={collapsed.foreground}
                        onToggle={() => setCollapsed((prev) => ({ ...prev, foreground: !prev.foreground }))}
                    />
                    {!collapsed.foreground && (
                        <LayerObjectList
                            objects={fg}
                            allObjects={allObjects}
                            onMove={(from, to) => dispatch({ type: 'move', from, to })}
                        />
                    )}
                </div>
            )}
            {main.length > 0 && (
                <div className={local.group}>
                    <LayerGroupHeader
                        title={t('properties.layerMain', { defaultValue: '主图层' })}
                        count={main.length}
                        collapsed={collapsed.main}
                        onToggle={() => setCollapsed((prev) => ({ ...prev, main: !prev.main }))}
                    />
                    {!collapsed.main && (
                        <LayerObjectList
                            objects={main}
                            allObjects={allObjects}
                            onMove={(from, to) => dispatch({ type: 'move', from, to })}
                        />
                    )}
                </div>
            )}
            {bg.length > 0 && (
                <div className={local.group}>
                    <LayerGroupHeader
                        title={t('properties.layerBackground', { defaultValue: '背景层' })}
                        count={bg.length}
                        collapsed={collapsed.background}
                        onToggle={() => setCollapsed((prev) => ({ ...prev, background: !prev.background }))}
                    />
                    {!collapsed.background && (
                        <LayerObjectList
                            objects={bg}
                            allObjects={allObjects}
                            onMove={(from, to) => dispatch({ type: 'move', from, to })}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const useStyles = makeStyles({
    group: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalM,
    },
    groupTitle: {
        ...typographyStyles.caption1Strong,
        color: tokens.colorNeutralForeground3,
    },
    groupHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacingHorizontalS,
        paddingInline: tokens.spacingHorizontalXS,
    },
    groupTitleRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: tokens.spacingHorizontalXS,
        minWidth: 0,
    },
    groupCount: {
        ...typographyStyles.caption1,
        color: tokens.colorNeutralForeground4,
    },
    toggleButton: {
        minWidth: '28px',
        padding: '2px',
    },
});

const LayerGroupHeader: React.FC<{
    title: string;
    count: number;
    collapsed: boolean;
    onToggle: () => void;
}> = ({ title, count, collapsed, onToggle }) => {
    const classes = useStyles();
    const Icon = collapsed ? ChevronRightRegular : ChevronDownRegular;

    return (
        <div className={classes.groupHeader}>
            <div className={classes.groupTitleRow}>
                <div className={classes.groupTitle}>{title}</div>
                <div className={classes.groupCount}>{count}</div>
            </div>
            <Button
                appearance="transparent"
                className={classes.toggleButton}
                icon={<Icon />}
                aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
                onClick={onToggle}
            />
        </div>
    );
};

const LayerObjectList: React.FC<{
    objects: readonly SceneObject[];
    allObjects: readonly SceneObject[];
    onMove: (from: number, to: number) => void;
}> = ({ objects, allObjects, onMove }) => {
    const moveWithinLayer = (from: number, to: number) => {
        const fromObj = objects[from];
        const toObj = objects[to];
        if (!fromObj || !toObj) return;
        const globalFrom = allObjects.findIndex((o) => o.id === fromObj.id);
        const globalTo = allObjects.findIndex((o) => o.id === toObj.id);
        if (globalFrom < 0 || globalTo < 0) return;
        onMove(globalFrom, globalTo);
    };

    return <ObjectList objects={objects} onMove={moveWithinLayer} />;
};
