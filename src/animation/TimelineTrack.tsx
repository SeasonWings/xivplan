import {
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Portal,
    tokens,
} from '@fluentui/react-components';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScene } from '../SceneProvider';
import { useAnimationV2 } from './AnimationV2Context';
import { AnimationTrack, AnimationTrackItem } from './animationV2Types';
import { TimelineTrackItem } from './TimelineTrackItem';

const useStyles = makeStyles({
    track: {
        height: '60px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        position: 'relative',
        backgroundColor: tokens.colorNeutralBackground1,
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    previewItem: {
        position: 'absolute',
        top: '4px',
        height: '52px',
        borderRadius: tokens.borderRadiusMedium,
        opacity: 0.5,
        pointerEvents: 'none',
        border: `2px dashed ${tokens.colorBrandBackground}`,
        boxSizing: 'border-box',
    },
});

interface TimelineTrackProps {
    track: AnimationTrack;
    zoom: number;
    onUpdate: (track: AnimationTrack) => void;
    onAddEffect: (trackId: string) => void;
    onEditEffect?: (item: AnimationTrackItem) => void;
    onDeleteEffect?: (trackId: string, itemId: string) => void;
    onDragStart?: (item: AnimationTrackItem, trackId: string) => void;
    onDragEnd?: () => void;
    onCrossTrackDragMove?: (item: AnimationTrackItem, newStartTime: number) => void;
    onPositionAdjusted?: () => void; // 位置因防重叠被调整后回调
    draggingItem?: {
        item: AnimationTrackItem;
        fromTrackId: string;
        groupItems?: AnimationTrackItem[];
    } | null; // 从TimelineV2传递的全局拖拽状态
    isSelected?: boolean;
    onSelectTrack?: (trackId: string) => void;
    onSelectItem?: (trackId: string, itemId: string) => void;
    selectedItemId?: string | null;
    multiSelectedItemIds?: string[];
    onMarqueeSelectItems?: (trackId: string, itemIds: string[]) => void;
    onCopyItems?: (items: AnimationTrackItem[]) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
    track,
    zoom,
    onUpdate,
    onAddEffect,
    onEditEffect,
    onDeleteEffect,
    onDragStart,
    onDragEnd,
    onCrossTrackDragMove,
    onPositionAdjusted,
    draggingItem: globalDraggingItem,
    isSelected = false,
    onSelectTrack,
    onSelectItem,
    selectedItemId,
    multiSelectedItemIds = [],
    onMarqueeSelectItems,
    onCopyItems,
}) => {
    const classes = useStyles();
    const { step } = useScene();
    const { pasteEffect, canPasteEffect } = useAnimationV2();
    const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number; time: number } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const [marquee, setMarquee] = useState<{ startX: number; endX: number } | null>(null);

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = trackRef.current?.getBoundingClientRect();
            let time = 0;
            if (rect) {
                const x = e.clientX - rect.left;
                time = Math.max(0, x / zoom);
            }
            const pos = { x: e.clientX, y: e.clientY, time };
            requestAnimationFrame(() => setContextMenuPosition(pos));
        },
        [zoom],
    );

    const handleTrackMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) return;

            const target = e.target as HTMLElement | null;
            if (target && target.closest('[data-timeline-context-menu="true"]')) {
                return;
            }

            if (onSelectTrack) {
                onSelectTrack(track.id);
            }
            const rect = trackRef.current?.getBoundingClientRect();
            if (!rect || !onMarqueeSelectItems) {
                return;
            }
            const startX = e.clientX - rect.left;
            setMarquee({ startX, endX: startX });

            const handleMouseMove = (event: MouseEvent) => {
                const currentRect = trackRef.current?.getBoundingClientRect();
                if (!currentRect) return;
                const x = event.clientX - currentRect.left;
                setMarquee((prev) => (prev ? { ...prev, endX: x } : null));
            };

            const handleMouseUp = () => {
                setMarquee((prev) => {
                    if (!prev) return null;
                    const minX = Math.min(prev.startX, prev.endX);
                    const maxX = Math.max(prev.startX, prev.endX);
                    const startTime = minX / zoom;
                    const endTime = maxX / zoom;

                    const selectedIds = track.items
                        .filter((item) => {
                            const itemStart = item.startTime;
                            const itemEnd = item.startTime + item.duration;
                            return itemEnd > startTime && itemStart < endTime;
                        })
                        .map((item) => item.id);

                    onMarqueeSelectItems(track.id, selectedIds);
                    return null;
                });

                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };

            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        },
        [onSelectTrack, onMarqueeSelectItems, track.id, zoom, track.items],
    );

    const handleAddEffectClick = useCallback(() => {
        setContextMenuPosition(null);
        onAddEffect(track.id);
    }, [track.id, onAddEffect]);

    const handleEditEffect = useCallback(
        (item: AnimationTrackItem) => {
            onEditEffect?.(item);
        },
        [onEditEffect],
    );

    const handleItemDragStart = useCallback(
        (item: AnimationTrackItem, trackId: string) => {
            onDragStart?.(item, trackId);
        },
        [onDragStart],
    );

    const handleItemDragEnd = useCallback(() => {
        onDragEnd?.();
    }, [onDragEnd]);

    // 跨track拖拽由TimelineV2统一处理，这里只需要监听鼠标移动来更新高亮状态
    const isDraggingFromOtherTrack = !!(globalDraggingItem && globalDraggingItem.fromTrackId !== track.id);

    useEffect(() => {
        if (isDraggingFromOtherTrack) {
            const handleGlobalMouseMove = (e: MouseEvent) => {
                const rect = trackRef.current?.getBoundingClientRect();
                if (rect) {
                    const isOverTrack = e.clientY >= rect.top && e.clientY <= rect.bottom;
                    setIsDragOver(isOverTrack);
                }
            };

            window.addEventListener('mousemove', handleGlobalMouseMove);
            return () => {
                window.removeEventListener('mousemove', handleGlobalMouseMove);
                setIsDragOver(false);
            };
        }
    }, [isDraggingFromOtherTrack]);

    const disabledItemIds = useMemo(() => {
        const ids = new Set<string>();
        const objects = step.objects as ReadonlyArray<{ id: number; groupId?: string }>;
        const objectIdSet = new Set(objects.map((o) => o.id));

        for (const item of track.items) {
            if (item.groupId) {
                const hasGroupObjects = objects.some((o) => o.groupId === item.groupId);
                if (!hasGroupObjects) {
                    ids.add(item.id);
                }
                continue;
            }

            if (item.objectIds && item.objectIds.length > 0) {
                const anyExists = item.objectIds.some((id) => objectIdSet.has(id));
                if (!anyExists) {
                    ids.add(item.id);
                }
                continue;
            }

            const target = objectIdSet.has(item.objectId);
            if (!target) {
                ids.add(item.id);
            }
        }

        return ids;
    }, [step.objects, track.items]);

    if (!track.visible) {
        return null;
    }

    return (
        <>
            <div
                ref={trackRef}
                data-track-id={track.id}
                className={classes.track}
                onContextMenu={handleContextMenu}
                onMouseDown={handleTrackMouseDown}
                style={{
                    backgroundColor: isDragOver
                        ? tokens.colorPaletteBlueBackground2
                        : isSelected
                          ? tokens.colorNeutralBackground2
                          : undefined,
                }}
            >
                {track.items.map((item) => (
                    <TimelineTrackItem
                        key={item.id}
                        item={item}
                        track={track}
                        zoom={zoom}
                        locked={track.locked}
                        onUpdate={onUpdate}
                        onEdit={handleEditEffect}
                        onDelete={() => {
                            if (!onDeleteEffect) return;
                            if (multiSelectedItemIds.length > 0) {
                                multiSelectedItemIds.forEach((id) => {
                                    onDeleteEffect(track.id, id);
                                });
                            } else {
                                onDeleteEffect(track.id, item.id);
                            }
                        }}
                        onDragStart={handleItemDragStart}
                        onDragEnd={handleItemDragEnd}
                        onCrossTrackDragMove={onCrossTrackDragMove}
                        onPositionAdjusted={onPositionAdjusted}
                        disabled={disabledItemIds.has(item.id)}
                        selected={selectedItemId === item.id || multiSelectedItemIds.includes(item.id)}
                        onSelect={onSelectItem}
                        canEdit={multiSelectedItemIds.length === 0}
                        onCopy={() => {
                            if (!onCopyItems) return;
                            if (multiSelectedItemIds.length > 0) {
                                const itemsToCopy = track.items.filter((i) => multiSelectedItemIds.includes(i.id));
                                if (itemsToCopy.length > 0) {
                                    onCopyItems(itemsToCopy);
                                }
                            } else {
                                onCopyItems([item]);
                            }
                        }}
                        multiSelectedItemIds={multiSelectedItemIds}
                    />
                ))}

                {/* 跨track拖拽预览虚影 */}
                {isDragOver &&
                    globalDraggingItem &&
                    globalDraggingItem.fromTrackId !== track.id &&
                    (() => {
                        const { item: anchor, groupItems } = globalDraggingItem;

                        if (groupItems && groupItems.length > 0) {
                            const originalAnchor = groupItems.find((i) => i.id === anchor.id) ?? groupItems[0]!;
                            const delta = anchor.startTime - originalAnchor.startTime;

                            return groupItems.map((gi) => {
                                const left = (gi.startTime + delta) * zoom;
                                const width = gi.duration * zoom;
                                return (
                                    <div
                                        key={gi.id}
                                        className={classes.previewItem}
                                        style={{
                                            left: `${left * 1}px`,
                                            width: `${width * 1}px`,
                                            backgroundColor: tokens.colorBrandBackground2,
                                        }}
                                        title="预览位置"
                                    />
                                );
                            });
                        }

                        return (
                            <div
                                className={classes.previewItem}
                                style={{
                                    left: `${anchor.startTime * zoom}px`,
                                    width: `${anchor.duration * zoom}px`,
                                    backgroundColor: tokens.colorBrandBackground2,
                                }}
                                title="预览位置"
                            />
                        );
                    })()}

                {marquee && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${Math.min(marquee.startX, marquee.endX)}px`,
                            width: `${Math.abs(marquee.endX - marquee.startX)}px`,
                            backgroundColor: 'rgba(56, 119, 255, 0.15)',
                            border: `1px solid ${tokens.colorPaletteBlueBorderActive}`,
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </div>

            {/* 轨道右键菜单 - 添加效果 */}
            {contextMenuPosition && (
                <Portal>
                    <Menu
                        open={!!contextMenuPosition}
                        onOpenChange={(_, data) => !data.open && setContextMenuPosition(null)}
                    >
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
                                <MenuItem onClick={handleAddEffectClick}>添加动画效果</MenuItem>
                                <MenuItem
                                    disabled={!canPasteEffect}
                                    onClick={() => {
                                        if (contextMenuPosition) {
                                            pasteEffect(track.id, contextMenuPosition.time);
                                        }
                                        setContextMenuPosition(null);
                                    }}
                                >
                                    粘贴效果到该轨道
                                </MenuItem>
                            </MenuList>
                        </MenuPopover>
                    </Menu>
                </Portal>
            )}
        </>
    );
};
