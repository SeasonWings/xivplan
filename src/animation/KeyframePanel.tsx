/**
 * 旧版关键帧面板 - Legacy
 * 新版请使用 TimelineV2 集成的可视化时间线
 */
import {
    Button,
    Input,
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    tokens,
    Tooltip,
    Field,
    SpinButton,
    SpinButtonChangeEvent,
    SpinButtonOnChangeData,
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Edit24Regular, MoreVertical24Regular } from '@fluentui/react-icons';
import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from './AnimationContext';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        gap: tokens.spacingVerticalM,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: tokens.spacingVerticalM,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    title: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    toolbar: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: tokens.spacingVerticalM,
    },
    noSelection: {
        textAlign: 'center',
        color: tokens.colorNeutralForeground3,
        padding: tokens.spacingVerticalXXL,
    },
    timeInput: {
        width: '100px',
    },
    trackHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: tokens.spacingVerticalS,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        marginBottom: tokens.spacingVerticalS,
    },
    trackTitle: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    keyframeList: {
        marginLeft: tokens.spacingHorizontalL,
    },
});

interface KeyframeRowData {
    id: string;
    time: number;
    name?: string;
    objectCount: number;
}

export const KeyframePanelLegacy: React.FC = () => {
    const classes = useStyles();
    const { t } = useTranslation();
    const {
        animation,
        keyframeTimeStep,
        setKeyframeTimeStep,
        addKeyframe,
        removeKeyframe,
        updateKeyframeName,
        updateKeyframeTime,
        updateKeyframeObjects,
        jumpToKeyframe,
    } = useAnimation();
    const [keyframeName, setKeyframeName] = useState<string>('');
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');
    const [editingTimeRowId, setEditingTimeRowId] = useState<string | null>(null);
    const [editingTime, setEditingTime] = useState<string>('');
    const [editingKeyframe, setEditingKeyframe] = useState<{ time: number; name: string | undefined } | null>(null);
    const [inputValue, setInputValue] = useState<number>(keyframeTimeStep);

    // 当 keyframeTimeStep 变化时更新 inputValue
    useEffect(() => {
        setInputValue(keyframeTimeStep);
    }, [keyframeTimeStep]);

    const handleAddKeyframe = useCallback(() => {
        // 计算默认时间: 当前最大时间 + 自定义步长
        let defaultTime = 0;
        if (animation && animation.keyframes.length > 0) {
            const maxTime = Math.max(...animation.keyframes.map((kf) => kf.time));
            defaultTime = maxTime + keyframeTimeStep;
        }

        addKeyframe(defaultTime, keyframeName || undefined);
        setKeyframeName(''); // 清空名称输入
    }, [animation, keyframeTimeStep, keyframeName, addKeyframe]);

    const handleRemoveKeyframe = useCallback(
        (time: number, name: string | undefined, objectCount: number) => {
            // 删除前自动跳转到该帧,让用户看到删除的是哪一帧
            jumpToKeyframe(time);
            // 稍微延迟后删除,让跳转效果可见
            setTimeout(() => {
                removeKeyframe(time, name, objectCount);
            }, 100);
        },
        [removeKeyframe, jumpToKeyframe],
    );

    const handleJumpToKeyframe = useCallback(
        (time: number) => {
            jumpToKeyframe(time);
        },
        [jumpToKeyframe],
    );

    const handleStartEdit = useCallback((rowId: string, currentName: string | undefined) => {
        setEditingRowId(rowId);
        setEditingName(currentName || '');
    }, []);

    const handleSaveEdit = useCallback(
        (time: number, oldName: string | undefined) => {
            if (editingName.trim()) {
                updateKeyframeName(time, oldName, editingName.trim());
            }
            setEditingRowId(null);
            setEditingName('');
        },
        [editingName, updateKeyframeName],
    );

    const handleCancelEdit = useCallback(() => {
        setEditingRowId(null);
        setEditingName('');
    }, []);

    const handleStartTimeEdit = useCallback((rowId: string, currentTime: number) => {
        setEditingTimeRowId(rowId);
        setEditingTime(currentTime.toString());
    }, []);

    const handleSaveTimeEdit = useCallback(
        (oldTime: number, name: string | undefined) => {
            const newTime = parseFloat(editingTime);
            if (!isNaN(newTime) && newTime >= 0) {
                updateKeyframeTime(oldTime, name, newTime);
            }
            setEditingTimeRowId(null);
            setEditingTime('');
        },
        [editingTime, updateKeyframeTime],
    );

    const handleCancelTimeEdit = useCallback(() => {
        setEditingTimeRowId(null);
        setEditingTime('');
    }, []);

    // 开始编辑关键帧对象
    const handleStartEditKeyframe = useCallback(
        (time: number, name: string | undefined) => {
            // 跳转到该关键帧，让画布显示关键帧状态
            jumpToKeyframe(time);
            // 记录当前正在编辑的关键帧
            setEditingKeyframe({ time, name });
        },
        [jumpToKeyframe],
    );

    // 保存关键帧编辑
    const handleSaveEditKeyframe = useCallback(() => {
        if (editingKeyframe) {
            // 将当前画布状态更新到关键帧
            updateKeyframeObjects(editingKeyframe.time, editingKeyframe.name);
            setEditingKeyframe(null);
        }
    }, [editingKeyframe, updateKeyframeObjects]);

    // 取消关键帧编辑
    const handleCancelEditKeyframe = useCallback(() => {
        if (editingKeyframe) {
            // 重新跳转到关键帧，恢复原始状态
            jumpToKeyframe(editingKeyframe.time);
            setEditingKeyframe(null);
        }
    }, [editingKeyframe, jumpToKeyframe]);

    const getKeyframeRows = (): KeyframeRowData[] => {
        if (!animation) {
            return [];
        }
        return animation.keyframes.map((kf, index) => ({
            id: `keyframe-${index}`,
            time: kf.time,
            name: kf.name,
            objectCount: kf.objects.length,
        }));
    };

    const columns = [
        { columnKey: 'time', label: t('animation.time', '时间 (ms)') },
        { columnKey: 'name', label: t('animation.keyframeName', '名称') },
        { columnKey: 'objectCount', label: t('animation.objectCount', '对象数量') },
        { columnKey: 'actions', label: t('animation.actions', '操作') },
    ];

    const rows = getKeyframeRows();

    const handleTimeStepChange = useCallback(
        (ev: SpinButtonChangeEvent, data: SpinButtonOnChangeData) => {
            // 处理数值变化
            if (data.value !== null && data.value !== undefined) {
                const newStep = Math.max(10, data.value);
                setKeyframeTimeStep(newStep);
                setInputValue(newStep);
            }
        },
        [setKeyframeTimeStep],
    );

    const handleTimeStepInput = useCallback((ev: React.FormEvent<HTMLInputElement>) => {
        const target = ev.target as HTMLInputElement;
        const value = target.value;

        // 允许空字符串（用户可能正在输入）
        if (value === '') {
            setInputValue(10); // 临时设置为最小值
            return;
        }

        // 如果输入的是有效数字，更新状态
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            // 不在这里限制范围，留到失焦或回车时处理
            setInputValue(numValue);
        }
    }, []);

    const handleTimeStepBlur = useCallback(() => {
        // 确保输入值在有效范围内
        const clampedValue = Math.max(10, Math.min(5000, inputValue));
        setKeyframeTimeStep(clampedValue);
        setInputValue(clampedValue);
    }, [inputValue, setKeyframeTimeStep]);

    const handleTimeStepKeyDown = useCallback(
        (ev: React.KeyboardEvent<HTMLInputElement>) => {
            if (ev.key === 'Enter') {
                // 用户按下回车键时，确保输入值在有效范围内
                const clampedValue = Math.max(10, Math.min(5000, inputValue));
                setKeyframeTimeStep(clampedValue);
                setInputValue(clampedValue);
            }
        },
        [inputValue, setKeyframeTimeStep],
    );

    return (
        <div className={classes.container}>
            <div className={classes.header}>
                <div className={classes.title}>
                    {t('animation.keyframes', '关键帧')} ({rows.length} {t('animation.frames', '帧')})
                </div>
                <div className={classes.toolbar}>
                    <Field
                        label={t('animation.timeStep', '步长')}
                        orientation="horizontal"
                        style={{ marginRight: tokens.spacingHorizontalM }}
                    >
                        <SpinButton
                            value={inputValue}
                            onChange={handleTimeStepChange}
                            onInput={handleTimeStepInput}
                            onBlur={handleTimeStepBlur}
                            onKeyDown={handleTimeStepKeyDown}
                            min={10}
                            max={5000}
                            step={10}
                            style={{ width: '80px' }}
                        />
                    </Field>
                    {editingKeyframe ? (
                        <>
                            <Tooltip content={t('animation.saveEdit', '保存编辑')} relationship="label">
                                <Button onClick={handleSaveEditKeyframe} appearance="primary">
                                    {t('animation.saveEdit', '保存编辑')}
                                </Button>
                            </Tooltip>
                            <Tooltip content={t('animation.cancelEdit', '取消编辑')} relationship="label">
                                <Button onClick={handleCancelEditKeyframe} appearance="secondary">
                                    {t('animation.cancelEdit', '取消')}
                                </Button>
                            </Tooltip>
                        </>
                    ) : (
                        <Tooltip content={t('animation.addKeyframe', '添加关键帧')} relationship="label">
                            <Button
                                icon={<Add24Regular />}
                                appearance="primary"
                                onClick={handleAddKeyframe}
                                data-tutorial="animation-add-keyframe"
                            >
                                {t('animation.add', '添加')}
                            </Button>
                        </Tooltip>
                    )}
                </div>
            </div>

            <div className={classes.content} data-tutorial="animation-keyframe-list">
                {rows.length > 0 ? (
                    <Table size="small">
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHeaderCell key={col.columnKey}>{col.label}</TableHeaderCell>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        {editingTimeRowId === row.id ? (
                                            <Input
                                                type="number"
                                                value={editingTime}
                                                onChange={(e, data) => setEditingTime(data.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveTimeEdit(row.time, row.name);
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelTimeEdit();
                                                    }
                                                }}
                                                onBlur={() => handleSaveTimeEdit(row.time, row.name)}
                                                autoFocus
                                                size="small"
                                                style={{ width: '100%' }}
                                            />
                                        ) : (
                                            <span
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleStartTimeEdit(row.id, row.time)}
                                            >
                                                {row.time}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRowId === row.id ? (
                                            <Input
                                                value={editingName}
                                                onChange={(e, data) => setEditingName(data.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveEdit(row.time, row.name);
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                                onBlur={() => handleSaveEdit(row.time, row.name)}
                                                autoFocus
                                                size="small"
                                                style={{ width: '100%' }}
                                            />
                                        ) : (
                                            <span
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleStartEdit(row.id, row.name)}
                                            >
                                                {row.name || '-'}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{row.objectCount}</TableCell>
                                    <TableCell>
                                        <Menu>
                                            <MenuTrigger disableButtonEnhancement>
                                                <Button
                                                    icon={<MoreVertical24Regular />}
                                                    appearance="subtle"
                                                    size="small"
                                                />
                                            </MenuTrigger>
                                            <MenuPopover>
                                                <MenuList>
                                                    <MenuItem onClick={() => handleJumpToKeyframe(row.time)}>
                                                        {t('animation.seekTo', '跳转到此帧')}
                                                    </MenuItem>
                                                    <MenuItem
                                                        onClick={() => handleStartEditKeyframe(row.time, row.name)}
                                                        icon={<Edit24Regular />}
                                                        disabled={editingKeyframe !== null}
                                                        data-tutorial="animation-edit-keyframe"
                                                    >
                                                        {t('animation.editKeyframe', '编辑此帧')}
                                                    </MenuItem>
                                                    <MenuItem
                                                        onClick={() =>
                                                            handleRemoveKeyframe(row.time, row.name, row.objectCount)
                                                        }
                                                        icon={<Delete24Regular />}
                                                        disabled={editingKeyframe !== null}
                                                    >
                                                        {t('animation.delete', '删除')}
                                                    </MenuItem>
                                                </MenuList>
                                            </MenuPopover>
                                        </Menu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className={classes.noSelection}>
                        {t('animation.noKeyframes', '暂无关键帧，点击上方按钮添加')}
                    </div>
                )}
            </div>
        </div>
    );
};
