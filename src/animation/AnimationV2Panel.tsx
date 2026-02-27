import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Dropdown,
    Input,
    makeStyles,
    Option,
    Switch,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import {
    Add24Regular,
    Dismiss24Regular,
    Settings24Regular,
    SquareMultiple24Regular,
    Subtract24Regular,
    VideoRecordingRegular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimationPanelVisibility } from './AnimationPanelVisibilityContext';
import { useAnimationV2 } from './AnimationV2Context';
import { AnimationTrackItem, AnimationV2 } from './animationV2Types';
import { EffectEditDialog } from './EffectEditDialog';
import { TimelineV2 } from './TimelineV2';
import { useVisualEdit } from './VisualEditContext';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: tokens.colorNeutralBackground1,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    formField: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    label: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    noAnimation: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacingVerticalL,
        padding: tokens.spacingVerticalXXL,
        textAlign: 'center',
        color: tokens.colorNeutralForeground3,
    },
});

interface AnimationV2PanelProps {
    onMinimize?: () => void;
    onMaximize?: () => void;
    onClose?: () => void;
}

export const AnimationV2Panel: React.FC<AnimationV2PanelProps> = ({ onMinimize, onMaximize, onClose }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const {
        animation,
        animations,
        playerState,
        createAnimation,
        switchAnimation,
        deleteAnimation,
        setAnimation,
        play,
        pause,
        stop,
        seekTo,
        addTrack,
        removeTrack,
        updateTrack,
        addTrackItem,
        updateTrackItem,
        removeTrackItem,
    } = useAnimationV2();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [addTrackDialogOpen, setAddTrackDialogOpen] = useState(false);
    const [effectDialogOpen, setEffectDialogOpen] = useState(false);
    const [effectDialogTrackId, setEffectDialogTrackId] = useState<string>('');
    const [editingItem, setEditingItem] = useState<AnimationTrackItem | undefined>(undefined);

    // 使用全局可视化编辑状态
    const { startVisualEdit, endVisualEdit, shouldRestoreDialogs } = useVisualEdit();

    // 使用动画面板可见性Context
    const { hidePanel: hideAnimationPanel } = useAnimationPanelVisibility();

    const handleMinimizePanel = () => {
        if (onMinimize) {
            onMinimize();
        }
    };

    const handleMaximizePanel = () => {
        if (onMaximize) {
            onMaximize();
        }
    };

    const handleClosePanel = () => {
        if (onClose) {
            onClose();
        } else {
            hideAnimationPanel();
        }
    };

    // 测试：直接暴露 setVisualEditMode 到 window 以便测试
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).testSetVisualEditMode = (value: boolean) => {
            if (value) {
                startVisualEdit();
            } else {
                endVisualEdit();
            }
        };
        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any).testSetVisualEditMode;
        };
    }, [startVisualEdit, endVisualEdit]);

    // 动画设置表单状态
    const [animationName, setAnimationName] = useState(animation?.name ?? '');
    const [loop, setLoop] = useState(animation?.loop ?? false);
    const [duration, setDuration] = useState(animation?.duration ?? 10000);

    const handleCreateAnimation = useCallback(() => {
        createAnimation('新动画 V2');
    }, [createAnimation]);

    const handleSwitchAnimation = useCallback(
        (animationId: string) => {
            switchAnimation(animationId);
        },
        [switchAnimation],
    );

    const handleSaveSettings = useCallback(() => {
        if (!animation) {
            return;
        }

        const updatedAnimation: AnimationV2 = {
            ...animation,
            name: animationName || undefined,
            loop,
            duration,
        };

        setAnimation(updatedAnimation);
        setSettingsOpen(false);
    }, [animation, animationName, loop, duration, setAnimation]);

    const handleDeleteAnimation = useCallback(() => {
        if (animation) {
            deleteAnimation(animation.id);
            setSettingsOpen(false);
        }
    }, [animation, deleteAnimation]);

    const handleAddTrack = useCallback(() => {
        addTrack(`轨道 ${animation?.tracks.length ? animation.tracks.length + 1 : 1}`);
        setAddTrackDialogOpen(false);
    }, [animation, addTrack]);

    const handleDeleteTrack = useCallback(
        (trackId: string) => {
            removeTrack(trackId);
        },
        [removeTrack],
    );

    const handleAddEffect = useCallback((trackId: string) => {
        setEffectDialogTrackId(trackId);
        setEditingItem(undefined);
        setEffectDialogOpen(true);
    }, []);

    const handleEditEffect = useCallback(
        (item: AnimationTrackItem) => {
            // 找到该项所在的track
            const track = animation?.tracks.find((t) => t.items.some((i) => i.id === item.id));
            if (track) {
                setEffectDialogTrackId(track.id);
                setEditingItem(item);
                setEffectDialogOpen(true);
            }
        },
        [animation],
    );

    const handleDeleteEffect = useCallback(
        (trackId: string, itemId: string) => {
            removeTrackItem(trackId, itemId);
        },
        [removeTrackItem],
    );

    const handleMoveItemToTrack = useCallback(
        (params: {
            itemIds: string[];
            fromTrackId: string;
            toTrackId: string;
            anchorItemId: string;
            anchorNewStartTime: number;
        }) => {
            if (!animation) return;

            const { itemIds, fromTrackId, toTrackId, anchorItemId, anchorNewStartTime } = params;
            if (fromTrackId === toTrackId) return;

            const fromTrack = animation.tracks.find((t) => t.id === fromTrackId);
            const toTrack = animation.tracks.find((t) => t.id === toTrackId);
            if (!fromTrack || !toTrack) return;

            const uniqueItemIds = Array.from(new Set(itemIds));
            const itemsToMove = fromTrack.items.filter((i) => uniqueItemIds.includes(i.id));
            if (itemsToMove.length === 0) return;

            const anchorItem =
                itemsToMove.find((i) => i.id === anchorItemId) || fromTrack.items.find((i) => i.id === anchorItemId);
            if (!anchorItem) return;

            const delta = anchorNewStartTime - anchorItem.startTime;

            let groupMinStart = Infinity;
            let groupMaxEnd = -Infinity;

            for (const item of itemsToMove) {
                if (item.startTime < groupMinStart) {
                    groupMinStart = item.startTime;
                }
                const end = item.startTime + item.duration;
                if (end > groupMaxEnd) {
                    groupMaxEnd = end;
                }
            }

            if (!isFinite(groupMinStart) || !isFinite(groupMaxEnd)) return;

            const desiredGroupStart = groupMinStart + delta;
            const groupDuration = groupMaxEnd - groupMinStart;

            const otherItems = toTrack.items.slice().sort((a, b) => a.startTime - b.startTime);

            let targetGroupStart = desiredGroupStart;
            let hasOverlap = true;

            while (hasOverlap) {
                hasOverlap = false;
                const targetGroupEnd = targetGroupStart + groupDuration;

                for (const other of otherItems) {
                    const otherEnd = other.startTime + other.duration;
                    if (targetGroupStart < otherEnd && targetGroupEnd > other.startTime) {
                        targetGroupStart = otherEnd;
                        hasOverlap = true;
                        break;
                    }
                }
            }

            const appliedDelta = Math.max(0, targetGroupStart) - groupMinStart;

            const movedItems = itemsToMove.map((item) => ({
                ...item,
                startTime: item.startTime + appliedDelta,
            }));

            const movedIds = new Set(movedItems.map((i) => i.id));

            const updatedTracks = animation.tracks.map((track) => {
                if (track.id === fromTrackId) {
                    return {
                        ...track,
                        items: track.items.filter((i) => !movedIds.has(i.id)),
                    };
                }
                if (track.id === toTrackId) {
                    return {
                        ...track,
                        items: [...track.items, ...movedItems],
                    };
                }
                return track;
            });

            const calculateDuration = (tracks: typeof animation.tracks, currentDuration: number) => {
                let maxEndTime = 0;
                for (const t of tracks) {
                    for (const i of t.items) {
                        const endTime = i.startTime + i.duration;
                        if (endTime > maxEndTime) {
                            maxEndTime = endTime;
                        }
                    }
                }
                if (maxEndTime === 0) {
                    return 30000;
                }
                if (maxEndTime > currentDuration) {
                    return Math.ceil(maxEndTime * 1.2);
                }
                return currentDuration;
            };

            const newDuration = calculateDuration(updatedTracks, animation.duration);

            setAnimation({
                ...animation,
                tracks: updatedTracks,
                duration: newDuration,
            });
        },
        [animation, setAnimation],
    );

    // 检查新效果是否与轨道内其他效果重叠，并返回调整后的开始时间
    const findNonOverlappingPosition = useCallback(
        (
            trackId: string,
            item: Omit<AnimationTrackItem, 'id'> | AnimationTrackItem,
            excludeItemId?: string,
        ): number => {
            const track = animation?.tracks.find((t) => t.id === trackId);
            if (!track) return item.startTime;

            const otherItems = track.items
                .filter((i) => i.id !== excludeItemId)
                .sort((a, b) => a.startTime - b.startTime);

            let targetStartTime = item.startTime;
            const duration = item.duration;

            // 检查是否有重叠，如果有则调整位置
            let hasOverlap = true;
            while (hasOverlap) {
                hasOverlap = false;
                const targetEndTime = targetStartTime + duration;

                for (const other of otherItems) {
                    const otherEnd = other.startTime + other.duration;

                    // 检查是否重叠
                    if (targetStartTime < otherEnd && targetEndTime > other.startTime) {
                        // 有重叠，移动到该效果的右侧
                        targetStartTime = otherEnd;
                        hasOverlap = true;
                        break;
                    }
                }
            }

            return Math.max(0, targetStartTime);
        },
        [animation],
    );

    const handleSaveEffect = useCallback(
        (trackId: string, item: Omit<AnimationTrackItem, 'id'> | AnimationTrackItem) => {
            if ('id' in item) {
                // 编辑现有效果 - 检查重叠并调整位置
                const adjustedStartTime = findNonOverlappingPosition(trackId, item, item.id);
                const adjustedItem = { ...item, startTime: adjustedStartTime };
                updateTrackItem(trackId, adjustedItem as AnimationTrackItem);
            } else {
                // 添加新效果 - 检查重叠并调整位置
                const adjustedStartTime = findNonOverlappingPosition(trackId, item);
                const adjustedItem = { ...item, startTime: adjustedStartTime };
                addTrackItem(trackId, adjustedItem);
            }
            setEffectDialogOpen(false);
            setEditingItem(undefined);
        },
        [addTrackItem, updateTrackItem, findNonOverlappingPosition],
    );

    const handleCloseEffectDialog = useCallback(() => {
        // 如果正在可视化编辑，不要关闭弹窗，只是隐藏等待恢复
        if (shouldRestoreDialogs) {
            // 暂时隐藏弹窗，但不重置状态
            setEffectDialogOpen(false);
        } else {
            // 真正关闭弹窗
            setEffectDialogOpen(false);
            setEditingItem(undefined);
            endVisualEdit(); // 重置可视化编辑模式
        }
    }, [endVisualEdit, shouldRestoreDialogs]);

    // 进入可视化编辑模式
    const handleVisualEditStart = (onSave?: () => void, onCancel?: () => void, objectId?: number) => {
        startVisualEdit(onSave, onCancel, objectId);
        // 关闭效果编辑弹窗和动画时间线面板，进入悬浮窗模式
        setEffectDialogOpen(false);
        hideAnimationPanel();
    };

    // 退出可视化编辑模式
    const handleVisualEditEnd = () => {
        endVisualEdit();
    };

    // 监听 shouldRestoreDialogs 变化，当从 true 变为 false 时恢复效果编辑弹窗
    // 使用 ref 保存之前的 shouldRestoreDialogs 状态，以便判断是否是从 true 变为 false
    const prevShouldRestoreDialogsRef = useRef(shouldRestoreDialogs);
    useEffect(() => {
        // 只有当从 true 变为 false 时（即从可视化编辑模式返回时），才恢复效果编辑弹窗
        if (prevShouldRestoreDialogsRef.current && !shouldRestoreDialogs) {
            setTimeout(() => setEffectDialogOpen(true), 0);
        }
        prevShouldRestoreDialogsRef.current = shouldRestoreDialogs;
    }, [shouldRestoreDialogs]);

    if (animations.length === 0) {
        return (
            <div className={classes.container}>
                <div className={classes.header}>
                    <div className={classes.title}>
                        <VideoRecordingRegular />
                        {t('animation.title', '动画')} V2
                    </div>
                </div>
                <div className={classes.noAnimation}>
                    <div>
                        <div style={{ fontSize: tokens.fontSizeBase500, marginBottom: tokens.spacingVerticalM }}>
                            暂未创建动画
                        </div>
                        <div style={{ color: tokens.colorNeutralForeground2 }}>
                            新版动画编辑器支持可视化时间线编辑，每个元素可以独立设置动画效果
                        </div>
                    </div>
                    <Button appearance="primary" onClick={handleCreateAnimation}>
                        创建动画
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={classes.container}>
            <div className={classes.header}>
                <div className={classes.title}>
                    <VideoRecordingRegular />
                    {animation ? (
                        <Dropdown
                            value={animation.name || '未命名动画'}
                            selectedOptions={[animation.id]}
                            onOptionSelect={(_, data) => {
                                if (data.optionValue) {
                                    handleSwitchAnimation(data.optionValue);
                                }
                            }}
                            appearance="underline"
                            style={{ minWidth: '150px', border: 'none' }}
                        >
                            {animations.map((anim) => (
                                <Option key={anim.id} value={anim.id}>
                                    {anim.name || '未命名动画'}
                                </Option>
                            ))}
                        </Dropdown>
                    ) : (
                        <span>动画 V2</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                    <Tooltip content="创建新动画" relationship="label">
                        <Button icon={<Add24Regular />} appearance="subtle" onClick={handleCreateAnimation} />
                    </Tooltip>
                    {animation && (
                        <Tooltip content="动画设置" relationship="label">
                            <Button
                                icon={<Settings24Regular />}
                                appearance="subtle"
                                onClick={() => setSettingsOpen(true)}
                            />
                        </Tooltip>
                    )}
                    <Tooltip content="最小化" relationship="label">
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<Subtract24Regular />}
                            onClick={handleMinimizePanel}
                        />
                    </Tooltip>
                    <Tooltip content="放大" relationship="label">
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<SquareMultiple24Regular />}
                            onClick={handleMaximizePanel}
                        />
                    </Tooltip>
                    <Tooltip content="关闭" relationship="label">
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<Dismiss24Regular />}
                            onClick={handleClosePanel}
                        />
                    </Tooltip>
                </div>
            </div>

            {animation ? (
                <div className={classes.content}>
                    {/* 时间线 */}
                    <TimelineV2
                        tracks={animation.tracks}
                        duration={animation.duration}
                        currentTime={playerState.currentTime}
                        playbackState={playerState.state}
                        onPlay={play}
                        onPause={pause}
                        onStop={stop}
                        onSeek={seekTo}
                        onTrackUpdate={updateTrack}
                        onAddEffect={handleAddEffect}
                        onEditEffect={handleEditEffect}
                        onDeleteEffect={handleDeleteEffect}
                        onMoveItemToTrack={handleMoveItemToTrack}
                        onAddTrack={() => setAddTrackDialogOpen(true)}
                        onDeleteTrack={handleDeleteTrack}
                    />
                </div>
            ) : (
                <div className={classes.noAnimation}>
                    <div style={{ color: tokens.colorNeutralForeground2 }}>请选择或创建一个动画</div>
                </div>
            )}

            {/* 设置对话框 */}
            <Dialog open={settingsOpen} onOpenChange={(_, data) => setSettingsOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>动画设置</DialogTitle>
                        <DialogContent>
                            <div className={classes.dialogContent}>
                                <div className={classes.formField}>
                                    <label className={classes.label}>动画名称</label>
                                    <Input
                                        value={animationName}
                                        onChange={(e, data) => setAnimationName(data.value)}
                                        placeholder="输入动画名称"
                                    />
                                </div>

                                <div className={classes.formField}>
                                    <label className={classes.label}>总时长 (毫秒)</label>
                                    <Input
                                        type="number"
                                        value={duration.toString()}
                                        onChange={(e, data) => setDuration(parseInt(data.value) || 10000)}
                                    />
                                </div>

                                <div className={classes.formField}>
                                    <Switch
                                        checked={loop}
                                        onChange={(e, data) => setLoop(data.checked)}
                                        label="循环播放"
                                    />
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={handleDeleteAnimation}>
                                删除动画
                            </Button>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary">取消</Button>
                            </DialogTrigger>
                            <Button appearance="primary" onClick={handleSaveSettings}>
                                保存
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* 添加轨道对话框 */}
            <Dialog open={addTrackDialogOpen} onOpenChange={(_, data) => setAddTrackDialogOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>添加轨道</DialogTitle>
                        <DialogContent>
                            <div className={classes.formField}>
                                <label className={classes.label}>确认添加一个新轨道？</label>
                                <p style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2 }}>
                                    轨道创建后，可以在轨道上右键添加动画效果。
                                </p>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary">取消</Button>
                            </DialogTrigger>
                            <Button appearance="primary" onClick={handleAddTrack}>
                                添加
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* 效果编辑对话框 - 在可视化编辑时隐藏，但保持状态 */}
            <EffectEditDialog
                open={effectDialogOpen && !shouldRestoreDialogs}
                trackId={effectDialogTrackId}
                item={editingItem}
                onClose={handleCloseEffectDialog}
                onSave={handleSaveEffect}
                onVisualEditStart={handleVisualEditStart}
                onVisualEditEnd={handleVisualEditEnd}
            />
        </div>
    );
};
