import {
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Portal,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { CopyRegular, Delete24Regular, Edit24Regular } from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimationEffectType, AnimationTrack, AnimationTrackItem } from './animationV2Types';

// 吸附距离（时间ms）
const SNAP_TIME_THRESHOLD = 50;
// 时间精度（ms）- 拉伸调整时间的最小单位
const TIME_PRECISION = 5;
// 移动精度（ms）- 移动item时的最小单位
const MOVE_PRECISION = 1;
const RESIZE_HIT_WIDTH = 8;

// 将时间对齐到指定精度
const alignToPrecision = (time: number, precision: number): number => {
    return Math.round(time / precision) * precision;
};

const getNonOverlappingStartTime = (
    desiredStartTime: number,
    duration: number,
    otherItems: AnimationTrackItem[],
): number => {
    if (!otherItems.length) {
        return Math.max(0, desiredStartTime);
    }

    const intervals = otherItems
        .map((i) => ({
            start: i.startTime,
            end: i.startTime + i.duration,
        }))
        .sort((a, b) => a.start - b.start);

    const candidates: number[] = [];
    let cursor = 0;

    for (const interval of intervals) {
        const freeLength = interval.start - cursor;
        if (freeLength >= duration) {
            const minStart = cursor;
            const maxStart = interval.start - duration;
            const clamped = Math.min(Math.max(desiredStartTime, minStart), maxStart);
            candidates.push(Math.max(0, clamped));
        }
        cursor = Math.max(cursor, interval.end);
    }

    const tailStart = Math.max(desiredStartTime, cursor, 0);
    candidates.push(tailStart);

    if (candidates.length === 0) {
        return Math.max(0, desiredStartTime);
    }

    let best = candidates[0]!;
    let bestDistance = Math.abs(best - desiredStartTime);

    for (let i = 1; i < candidates.length; i++) {
        const c = candidates[i]!;
        const d = Math.abs(c - desiredStartTime);
        if (d < bestDistance) {
            best = c;
            bestDistance = d;
        }
    }

    return best;
};

const useStyles = makeStyles({
    item: {
        position: 'absolute',
        top: '4px',
        height: '52px',
        borderRadius: tokens.borderRadiusMedium,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        userSelect: 'none',
        transition: 'box-shadow 0.1s ease',
        boxSizing: 'border-box',
        border: `2px solid ${tokens.colorNeutralStroke1}`,
        '&:hover': {
            boxShadow: tokens.shadow8,
        },
    },
    dragging: {
        opacity: 0.7,
        boxShadow: tokens.shadow16,
        zIndex: 100,
    },
    resizeHandle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '6px',
        cursor: 'ew-resize',
        zIndex: 3, // 确保盖住中间内容区域，整个高度都可点击拉伸
        '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
        },
    },
    resizeHandleLeft: {
        left: 0,
    },
    resizeHandleRight: {
        right: 0,
    },
    itemContent: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
        flex: 1,
        gap: '2px',
        height: '100%',
        padding: '0', // 去掉左右padding
    },
    itemName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: tokens.fontSizeBase200,
        lineHeight: '16px',
        zIndex: 2,
    },
    itemTime: {
        fontSize: tokens.fontSizeBase100,
        opacity: 0.8,
        lineHeight: '12px',
        fontFamily: tokens.fontFamilyMonospace,
        zIndex: 2,
    },
    keyframeMarkers: {
        position: 'absolute',
        top: 0,
        left: '6px',
        right: '6px',
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1,
    },
    keyframeLine: {
        position: 'absolute',
        top: '8px', // 上方留出8px空间
        bottom: '8px', // 下方留出8px空间
        width: '2px',
        backgroundColor: '#bae3ff', // 使用指定的浅蓝色
        opacity: 0.95,
        borderRadius: '1px', // 圆角边框更柔和
    },
    disabled: {
        opacity: 0.4,
        cursor: 'default',
        boxShadow: 'none',
    },
});

interface TimelineTrackItemProps {
    item: AnimationTrackItem;
    track: AnimationTrack;
    zoom: number;
    locked: boolean;
    onUpdate: (track: AnimationTrack) => void;
    onEdit?: (item: AnimationTrackItem) => void;
    onDelete?: () => void;
    onDragStart?: (item: AnimationTrackItem, trackId: string) => void;
    onDragEnd?: () => void;
    onCrossTrackDragMove?: (item: AnimationTrackItem, newStartTime: number) => void; // 跨track拖拽时的X轴移动
    onPositionAdjusted?: () => void; // 位置因防重叠被调整后回调
    disabled?: boolean;
    selected?: boolean;
    onSelect?: (trackId: string, itemId: string) => void;
    onCopy?: () => void;
    canEdit?: boolean;
    multiSelectedItemIds?: string[];
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

export const TimelineTrackItem: React.FC<TimelineTrackItemProps> = ({
    item,
    track,
    zoom,
    locked,
    onUpdate,
    onEdit,
    onDelete,
    onDragStart,
    onDragEnd,
    onCrossTrackDragMove,
    onPositionAdjusted,
    disabled = false,
    selected = false,
    onSelect,
    onCopy,
    canEdit = true,
    multiSelectedItemIds,
}) => {
    const classes = useStyles();
    const [dragMode, setDragMode] = useState<DragMode>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartY, setDragStartY] = useState(0);
    const [dragStartTime, setDragStartTime] = useState(0);
    const [dragStartDuration, setDragStartDuration] = useState(0);
    const [isInCrossTrackDrag, setIsInCrossTrackDrag] = useState(false); // 标记是否处于跨track拖拽状态
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const itemRef = useRef<HTMLDivElement>(null);
    const positionAdjustedRef = useRef(false); // 标记位置是否因防重叠被调整
    const [dragGroupInfo, setDragGroupInfo] = useState<{
        itemIds: string[];
        originalStarts: Record<string, number>;
        minStart: number;
        maxEnd: number;
    } | null>(null);

    const minDurationForItem = useMemo(() => {
        if (!item.loop || !item.keyframes || item.keyframes.length === 0) {
            return 100;
        }

        let maxTime = 0;
        for (const kf of item.keyframes) {
            if (kf.time > maxTime) {
                maxTime = kf.time;
            }
        }

        return Math.max(100, maxTime);
    }, [item.loop, item.keyframes]);

    const getEffectColor = (effectType: AnimationEffectType): string => {
        switch (effectType) {
            case AnimationEffectType.Move:
                return tokens.colorPaletteBlueBorderActive;
            case AnimationEffectType.CurveMove:
                return tokens.colorPaletteGreenBorderActive;
            case AnimationEffectType.Custom:
                return tokens.colorPaletteRedBorderActive;
            default:
                return tokens.colorNeutralStroke1;
        }
    };

    const getEffectName = (effectType: AnimationEffectType): string => {
        switch (effectType) {
            case AnimationEffectType.Move:
                return '直线移动';
            case AnimationEffectType.CurveMove:
                return '曲线移动';
            case AnimationEffectType.Custom:
                return '自定义';
            default:
                return '未知';
        }
    };

    const handleMouseDown = useCallback(
        (e: React.MouseEvent, mode: DragMode) => {
            if (locked || disabled) return;

            e.stopPropagation();

            setDragMode(mode);
            setDragStartX(e.clientX);
            setDragStartY(e.clientY);
            setDragStartTime(item.startTime);
            setDragStartDuration(item.duration);

            if (
                mode === 'move' &&
                multiSelectedItemIds &&
                multiSelectedItemIds.length > 1 &&
                multiSelectedItemIds.includes(item.id)
            ) {
                const selectedItems = track.items.filter((i) => multiSelectedItemIds.includes(i.id));
                if (selectedItems.length > 1) {
                    const originalStarts: Record<string, number> = {};
                    let minStart = Infinity;
                    let maxEnd = -Infinity;

                    for (const it of selectedItems) {
                        originalStarts[it.id] = it.startTime;
                        if (it.startTime < minStart) {
                            minStart = it.startTime;
                        }
                        const end = it.startTime + it.duration;
                        if (end > maxEnd) {
                            maxEnd = end;
                        }
                    }

                    if (isFinite(minStart) && isFinite(maxEnd)) {
                        setDragGroupInfo({
                            itemIds: selectedItems.map((it) => it.id),
                            originalStarts,
                            minStart,
                            maxEnd,
                        });
                    } else {
                        setDragGroupInfo(null);
                    }
                } else {
                    setDragGroupInfo(null);
                }
            } else {
                setDragGroupInfo(null);
            }
        },
        [locked, disabled, item.startTime, item.id, item.duration, multiSelectedItemIds, track.items],
    );

    const handleItemMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (locked || disabled) return;
            if (e.button !== 0) return;

            if (
                onSelect &&
                !(multiSelectedItemIds && multiSelectedItemIds.length > 0 && multiSelectedItemIds.includes(item.id))
            ) {
                onSelect(track.id, item.id);
            }

            const rect = itemRef.current?.getBoundingClientRect();
            if (!rect) {
                handleMouseDown(e, 'move');
                return;
            }

            if (!item.loop) {
                handleMouseDown(e, 'move');
                return;
            }

            const offsetX = e.clientX - rect.left;

            if (offsetX <= RESIZE_HIT_WIDTH) {
                handleMouseDown(e, 'resize-left');
            } else if (offsetX >= rect.width - RESIZE_HIT_WIDTH) {
                handleMouseDown(e, 'resize-right');
            } else {
                handleMouseDown(e, 'move');
            }
        },
        [locked, disabled, item.loop, handleMouseDown, onSelect, track.id, item.id, multiSelectedItemIds],
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!dragMode || locked || disabled) return;

            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            const deltaTime = deltaX / zoom;

            // 使用局部变量标记是否进入跨track拖拽，避免依赖异步state
            let enteringCrossTrackDrag = false;

            // 如果Y轴移动超过阈值，触发跨track拖拽
            if (Math.abs(deltaY) > 30 && dragMode === 'move' && !isInCrossTrackDrag) {
                enteringCrossTrackDrag = true;
                setIsInCrossTrackDrag(true); // 进入跨track拖拽模式
                if (onDragStart) {
                    onDragStart(item, track.id);
                }
            }

            // 跨track拖拽时，只处理X轴移动，通知父组件更新虚影位置
            if ((isInCrossTrackDrag || enteringCrossTrackDrag) && dragMode === 'move') {
                let newStartTime = Math.max(0, dragStartTime + deltaTime);
                // 应用1ms移动精度对齐
                newStartTime = alignToPrecision(newStartTime, MOVE_PRECISION);

                if (onCrossTrackDragMove) {
                    onCrossTrackDragMove(item, newStartTime);
                }
                return; // 跨track拖拽时不更新原轨道
            }

            let newStartTime = item.startTime;
            let newDuration = item.duration;

            // 获取同轨道其他效果项（排除当前项）
            const otherItems = track.items.filter((i) => i.id !== item.id).sort((a, b) => a.startTime - b.startTime);

            let updatedItems: AnimationTrackItem[] | null = null;

            switch (dragMode) {
                case 'move': {
                    if (dragGroupInfo && dragGroupInfo.itemIds.includes(item.id)) {
                        const groupDuration = dragGroupInfo.maxEnd - dragGroupInfo.minStart;
                        let desiredGroupStart = Math.max(0, dragGroupInfo.minStart + deltaTime);
                        desiredGroupStart = alignToPrecision(desiredGroupStart, MOVE_PRECISION);

                        const groupOtherItems = track.items
                            .filter((i) => !dragGroupInfo.itemIds.includes(i.id))
                            .sort((a, b) => a.startTime - b.startTime);

                        const adjustedGroupStart = getNonOverlappingStartTime(
                            desiredGroupStart,
                            groupDuration,
                            groupOtherItems,
                        );

                        if (adjustedGroupStart !== desiredGroupStart) {
                            positionAdjustedRef.current = true;
                        }

                        const appliedDelta = adjustedGroupStart - dragGroupInfo.minStart;

                        updatedItems = track.items.map((i) => {
                            if (!dragGroupInfo.itemIds.includes(i.id)) {
                                return i;
                            }
                            const originalStart = dragGroupInfo.originalStarts[i.id];
                            if (typeof originalStart !== 'number') {
                                return i;
                            }
                            const movedStart = alignToPrecision(originalStart + appliedDelta, MOVE_PRECISION);
                            return {
                                ...i,
                                startTime: movedStart,
                            };
                        });
                    } else {
                        let desiredStartTime = Math.max(0, dragStartTime + deltaTime);
                        desiredStartTime = alignToPrecision(desiredStartTime, MOVE_PRECISION);

                        const adjustedStartTime = getNonOverlappingStartTime(
                            desiredStartTime,
                            item.duration,
                            otherItems,
                        );

                        if (adjustedStartTime !== desiredStartTime) {
                            positionAdjustedRef.current = true;
                        }

                        newStartTime = adjustedStartTime;
                    }
                    break;
                }
                case 'resize-left': {
                    const minDuration = item.loop ? minDurationForItem : 100;
                    let targetStartTime = Math.max(0, dragStartTime + deltaTime);
                    // 应用时间精度对齐
                    targetStartTime = alignToPrecision(targetStartTime, TIME_PRECISION);

                    const maxStartTime = Math.max(0, dragStartTime + dragStartDuration - minDuration); // 根据最小持续时间限制可拖动范围
                    targetStartTime = Math.min(maxStartTime, targetStartTime);

                    // 吸附到其他效果的结束时间
                    for (const other of otherItems) {
                        const otherEnd = other.startTime + other.duration;
                        if (Math.abs(targetStartTime - otherEnd) < SNAP_TIME_THRESHOLD) {
                            targetStartTime = otherEnd;
                            break;
                        }
                    }

                    // 防止重叠：找到左侧最近的效果并确保不重叠
                    const endTime = dragStartTime + dragStartDuration;
                    for (const other of otherItems) {
                        const otherEnd = other.startTime + other.duration;
                        // 检查是否重叠：其他效果在调整后的范围内
                        if (other.startTime < endTime && otherEnd > targetStartTime) {
                            // 有重叠，调整到不重叠
                            targetStartTime = Math.max(targetStartTime, otherEnd);
                        }
                    }

                    newStartTime = Math.min(maxStartTime, Math.max(0, targetStartTime));
                    newDuration = Math.max(minDuration, dragStartDuration + (dragStartTime - newStartTime));
                    break;
                }
                case 'resize-right': {
                    const minDuration = item.loop ? minDurationForItem : 100;
                    let targetDuration = Math.max(minDuration, dragStartDuration + deltaTime);
                    // 应用时间精度对齐
                    targetDuration = alignToPrecision(targetDuration, TIME_PRECISION);

                    let targetEndTime = item.startTime + targetDuration;

                    // 吸附到其他效果的开始时间
                    for (const other of otherItems) {
                        if (Math.abs(targetEndTime - other.startTime) < SNAP_TIME_THRESHOLD) {
                            targetDuration = other.startTime - item.startTime;
                            targetEndTime = item.startTime + targetDuration;
                            break;
                        }
                    }

                    // 防止重叠：找到右侧最近的效果并确保不重叠
                    for (const other of otherItems) {
                        // 检查是否重叠：其他效果开始于当前效果结束之前
                        if (other.startTime >= item.startTime && other.startTime < targetEndTime) {
                            // 有重叠，调整到不重叠
                            targetDuration = other.startTime - item.startTime;
                        }
                    }

                    newDuration = Math.max(minDuration, targetDuration);
                    break;
                }
            }

            if (!updatedItems) {
                updatedItems = track.items.map((i) =>
                    i.id === item.id
                        ? {
                              ...i,
                              startTime: newStartTime,
                              duration: newDuration,
                          }
                        : i,
                );
            }

            onUpdate({
                ...track,
                items: updatedItems,
            });
        },
        [
            dragMode,
            locked,
            isInCrossTrackDrag,
            dragStartX,
            dragStartY,
            dragStartTime,
            dragStartDuration,
            item,
            track,
            zoom,
            onUpdate,
            onDragStart,
            onCrossTrackDragMove,
            dragGroupInfo,
            disabled,
            minDurationForItem,
        ],
    );

    const handleMouseUp = useCallback(() => {
        // 如果位置因防重叠被调整，触发回调
        if (positionAdjustedRef.current) {
            onPositionAdjusted?.();
            positionAdjustedRef.current = false; // 重置标记
        }
        setDragMode(null);
        setIsInCrossTrackDrag(false); // 重置跨track拖拽状态
        setDragGroupInfo(null);
        onDragEnd?.();
    }, [onDragEnd, onPositionAdjusted]);

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // 只在非锁定状态下显示上下文菜单
            if (!locked) {
                const pos = { x: e.clientX, y: e.clientY };
                requestAnimationFrame(() => {
                    setContextMenuPosition(pos);
                    setContextMenuOpen(true);
                });
            }
        },
        [locked],
    );

    useEffect(() => {
        if (dragMode) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragMode, handleMouseMove, handleMouseUp]);

    const itemLeft = item.startTime * zoom;
    const itemWidth = item.duration * zoom;
    const effectColor = getEffectColor(item.effectType);
    const effectName = getEffectName(item.effectType);

    // 格式化关键帧节点时间显示
    const formatKeyframeTime = (relativeTime: number): string => {
        const absoluteTime = item.startTime + relativeTime;
        const seconds = (absoluteTime / 1000).toFixed(1);
        return `${seconds}s`;
    };

    // 计算关键帧在item内的位置（像素），基于整个item持续时间映射
    // 并在左右预留6px给拉伸把手（内部再留1px视觉边距）
    const getKeyframePosition = (relativeTime: number): number => {
        if (item.duration <= 0 || itemWidth <= 0) {
            return 0;
        }

        const innerWidth = Math.max(itemWidth - 12, 0); // 左右各预留6px
        if (innerWidth <= 0) {
            return 0;
        }

        // 使用相对item.startTime的单位时间映射：0ms -> 0, duration -> itemWidth
        const normalized = relativeTime / item.duration;
        const rawPos = normalized * innerWidth;

        // 线宽为2px，希望在内部区域首尾留出约1px视觉边距：
        // - 第一个节点：left ≈ 1
        // - 最后一个节点：left ≈ innerWidth - 3
        const minPos = 1;
        const maxPos = Math.max(innerWidth - 3, minPos);

        const clamped = Math.min(Math.max(rawPos, minPos), maxPos);
        return clamped;
    };

    const itemClasses = [classes.item, dragMode ? classes.dragging : '', disabled ? classes.disabled : '']
        .filter(Boolean)
        .join(' ');

    let borderColor = tokens.colorNeutralStroke1;
    if (disabled) {
        borderColor = tokens.colorNeutralStroke2;
    }
    if (dragMode) {
        borderColor = tokens.colorBrandBackground;
    }
    if (selected) {
        borderColor = '#ffffff';
    }

    const itemNode = (
        <div
            ref={itemRef}
            className={itemClasses}
            style={{
                left: `${itemLeft}px`,
                width: `${itemWidth}px`,
                backgroundColor: effectColor,
                color: tokens.colorNeutralForegroundInverted,
                borderColor,
                ...(selected
                    ? {
                          outline: '2px solid #ffffff',
                          outlineOffset: '-2px',
                      }
                    : {}),
            }}
            onMouseDown={handleItemMouseDown}
            onContextMenu={handleContextMenu}
        >
            {!locked && item.loop && !disabled && (
                <div
                    className={`${classes.resizeHandle} ${classes.resizeHandleLeft}`}
                    onMouseDown={(e) => handleMouseDown(e, 'resize-left')}
                />
            )}

            <div className={classes.itemContent}>
                {item.keyframes && item.keyframes.length > 0 && (
                    <div className={classes.keyframeMarkers}>
                        {(() => {
                            const markers: React.ReactElement[] = [];
                            const isCurveRotate =
                                item.effectType === AnimationEffectType.CurveMove &&
                                item.curveConfig?.mode === 'rotate';

                            item.keyframes.forEach((kf, index) => {
                                markers.push(
                                    <div
                                        key={`original-${index}`}
                                        className={classes.keyframeLine}
                                        style={{
                                            left: `${getKeyframePosition(kf.time)}px`,
                                        }}
                                        title={`节点 ${index + 1}: ${formatKeyframeTime(kf.time)}`}
                                    />,
                                );
                            });

                            if (item.loop) {
                                let cycleLength: number | null = null;

                                if (isCurveRotate) {
                                    const rotateDuration = item.curveConfig?.rotateDuration;
                                    if (rotateDuration && rotateDuration > 0) {
                                        cycleLength = rotateDuration;
                                    } else if (item.keyframes.length >= 2) {
                                        const firstKf = item.keyframes[0];
                                        const lastKf = item.keyframes[item.keyframes.length - 1];
                                        if (firstKf && lastKf) {
                                            cycleLength = lastKf.time - firstKf.time;
                                        }
                                    }
                                } else if (item.keyframes.length >= 2) {
                                    const firstKf = item.keyframes[0];
                                    const lastKf = item.keyframes[item.keyframes.length - 1];
                                    if (firstKf && lastKf) {
                                        cycleLength = lastKf.time - firstKf.time;
                                    }
                                }

                                if (cycleLength && cycleLength > 0) {
                                    const totalCycles = Math.floor(item.duration / cycleLength);

                                    for (let cycle = 1; cycle < totalCycles; cycle++) {
                                        const cycleOffset = cycle * cycleLength;
                                        item.keyframes.forEach((kf, index) => {
                                            const loopTime = kf.time + cycleOffset;
                                            if (loopTime < item.duration) {
                                                markers.push(
                                                    <div
                                                        key={`loop-${cycle}-${index}`}
                                                        className={classes.keyframeLine}
                                                        style={{
                                                            left: `${getKeyframePosition(loopTime)}px`,
                                                            opacity: 0.5,
                                                        }}
                                                        title={`循环节点 (第${cycle + 1}周期) ${index + 1}: ${formatKeyframeTime(
                                                            loopTime,
                                                        )}`}
                                                    />,
                                                );
                                            }
                                        });
                                    }
                                }
                            }

                            return markers;
                        })()}
                    </div>
                )}
                <div className={classes.itemName}>
                    {disabled ? '[无效] ' : ''}
                    {item.objectName ? `${item.objectName} - ` : ''}
                    {item.name || effectName}
                </div>
            </div>

            {!locked && item.loop && !disabled && (
                <div
                    className={`${classes.resizeHandle} ${classes.resizeHandleRight}`}
                    onMouseDown={(e) => handleMouseDown(e, 'resize-right')}
                />
            )}
        </div>
    );

    return (
        <>
            {dragMode || isInCrossTrackDrag ? (
                itemNode
            ) : (
                <Tooltip
                    content={
                        disabled
                            ? '目标元素已不存在，此效果仅可删除'
                            : `${effectName} (${item.startTime}ms - ${item.startTime + item.duration}ms)`
                    }
                    relationship="label"
                >
                    {itemNode}
                </Tooltip>
            )}
            {/* Item 右键菜单 */}
            {contextMenuOpen && contextMenuPosition && (
                <Portal>
                    <Menu open={contextMenuOpen} onOpenChange={(_, data) => !data.open && setContextMenuOpen(false)}>
                        <MenuTrigger disableButtonEnhancement>
                            <div
                                style={{
                                    position: 'fixed',
                                    left: contextMenuPosition.x,
                                    top: contextMenuPosition.y,
                                    width: 1,
                                    height: 1,
                                    opacity: 0,
                                }}
                                aria-hidden="true"
                            />
                        </MenuTrigger>
                        <MenuPopover data-timeline-context-menu="true">
                            <MenuList>
                                {!disabled && canEdit && (
                                    <MenuItem
                                        icon={<Edit24Regular />}
                                        onClick={() => {
                                            setContextMenuOpen(false);
                                            onEdit?.(item);
                                        }}
                                    >
                                        编辑效果
                                    </MenuItem>
                                )}
                                {!disabled && (
                                    <MenuItem
                                        icon={<CopyRegular />}
                                        onClick={() => {
                                            setContextMenuOpen(false);
                                            onCopy?.();
                                        }}
                                    >
                                        复制效果
                                    </MenuItem>
                                )}
                                <MenuItem
                                    icon={<Delete24Regular />}
                                    onClick={() => {
                                        setContextMenuOpen(false);
                                        onDelete?.();
                                    }}
                                >
                                    删除效果
                                </MenuItem>
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                </Portal>
            )}
        </>
    );
};
