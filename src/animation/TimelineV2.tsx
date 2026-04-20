import { Button, makeStyles, Slider, tokens, Tooltip } from '@fluentui/react-components';
import {
    Add20Regular,
    Delete24Regular,
    Pause24Regular,
    Play24Regular,
    Stop24Regular,
    ZoomIn24Regular,
    ZoomOut24Regular,
} from '@fluentui/react-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimationV2 } from './AnimationV2Context';
import { AnimationTrack, AnimationTrackItem, PlaybackState, TimelineViewConfig } from './animationV2Types';
import { TimelineTrack } from './TimelineTrack';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colorNeutralBackground1,
        overflow: 'hidden',
    },
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        backgroundColor: tokens.colorNeutralBackground2,
        flexShrink: 0,
    },
    playbackControls: {
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
        alignItems: 'center',
    },
    separator: {
        width: '1px',
        height: '24px',
        backgroundColor: tokens.colorNeutralStroke2,
        margin: `0 ${tokens.spacingHorizontalS}`,
    },
    timeDisplay: {
        fontFamily: tokens.fontFamilyMonospace,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        minWidth: '100px',
    },
    zoomControls: {
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
        marginLeft: 'auto',
        alignItems: 'center',
    },
    zoomSlider: {
        width: '120px',
        marginLeft: tokens.spacingHorizontalS,
        marginRight: tokens.spacingHorizontalS,
    },
    zoomLabel: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
        minWidth: '45px',
        textAlign: 'right',
        fontFamily: tokens.fontFamilyMonospace,
    },
    timelineArea: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    trackList: {
        width: '200px',
        borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
        backgroundColor: tokens.colorNeutralBackground2,
        overflowY: 'hidden', // 隐藏垂直滚动条，由右侧容器控制滚动
        overflowX: 'hidden', // 隐藏水平滚动条
    },
    timelineContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
    },
    timelineRuler: {
        height: '30px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        backgroundColor: tokens.colorNeutralBackground3,
        position: 'relative',
        overflow: 'hidden', // 移除滚动条，由下方容器统一控制
    },
    rulerMarkers: {
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    rulerMarker: {
        position: 'absolute',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    rulerTick: {
        width: '2px',
        height: '12px',
        backgroundColor: tokens.colorNeutralStroke2,
        flexShrink: 0,
    },
    rulerLabel: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        whiteSpace: 'nowrap',
        lineHeight: '12px',
    },
    tracksContainer: {
        flex: 1,
        overflowY: 'auto',
        overflowX: 'auto',
        position: 'relative',
    },
    playheadOverlay: {
        position: 'absolute',
        top: '30px',
        bottom: 0,
        width: '2px',
        backgroundColor: tokens.colorBrandBackground,
        pointerEvents: 'none',
        zIndex: 1000,
    },
    playheadHandle: {
        position: 'absolute',
        top: 0, // 保证在轨道容器内完全可见，并且位于track内容之上
        left: '-6px',
        width: '14px',
        height: '14px',
        backgroundColor: tokens.colorBrandBackground,
        borderRadius: '50%',
        cursor: 'ew-resize',
        pointerEvents: 'auto',
    },
    grid: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
    },
    gridLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '1px',
        backgroundColor: tokens.colorNeutralStroke3,
    },
});

interface TimelineV2Props {
    tracks: readonly AnimationTrack[];
    duration: number;
    currentTime: number;
    playbackState: PlaybackState;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onSeek: (time: number) => void;
    onTrackUpdate: (track: AnimationTrack) => void;
    onAddEffect: (trackId: string) => void;
    onEditEffect?: (item: AnimationTrackItem) => void;
    onDeleteEffect?: (trackId: string, itemId: string) => void;
    onMoveItemToTrack?: (params: {
        itemIds: string[];
        fromTrackId: string;
        toTrackId: string;
        anchorItemId: string;
        anchorNewStartTime: number;
    }) => void;
    onAddTrack?: () => void; // 新增：添加轨道回调
    onDeleteTrack?: (trackId: string) => void;
}

export const TimelineV2: React.FC<TimelineV2Props> = ({
    tracks,
    duration,
    currentTime,
    playbackState,
    onPlay,
    onPause,
    onStop,
    onSeek,
    onTrackUpdate,
    onAddEffect,
    onEditEffect,
    onDeleteEffect,
    onMoveItemToTrack,
    onAddTrack,
    onDeleteTrack,
}) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const timelineRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);
    const trackListRef = useRef<HTMLDivElement>(null);
    const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
    const [draggingItem, setDraggingItem] = useState<{
        item: AnimationTrackItem;
        fromTrackId: string;
        groupItems?: AnimationTrackItem[];
    } | null>(null);
    const draggingItemRef = useRef<{
        item: AnimationTrackItem;
        fromTrackId: string;
        groupItems?: AnimationTrackItem[];
    } | null>(null);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<{ trackId: string; itemId: string } | null>(null);
    const [multiSelection, setMultiSelection] = useState<{ trackId: string; itemIds: string[] } | null>(null);
    const lastMouseTimeRef = useRef<number | null>(null);
    const { copyEffect, pasteEffect, canPasteEffect, setTimelineFocused } = useAnimationV2();

    const [viewConfig, setViewConfig] = useState<TimelineViewConfig>({
        zoom: 0.05, // 0.05 像素/毫秒 - 默认缩放，更大更清晰
        scrollX: 0,
        scrollY: 0,
        showGrid: true,
        gridInterval: 1000, // 1秒
    });

    const handleSelectTrack = useCallback((trackId: string) => {
        setSelectedTrackId(trackId);
        setSelectedItem(null);
        setMultiSelection(null);
    }, []);

    const handleSelectItem = useCallback((trackId: string, itemId: string) => {
        setSelectedTrackId(trackId);
        setSelectedItem({ trackId, itemId });
        setMultiSelection(null);
    }, []);

    const handleMarqueeSelectItems = useCallback((trackId: string, itemIds: string[]) => {
        if (itemIds.length === 0) {
            setMultiSelection(null);
            return;
        }
        setSelectedTrackId(trackId);
        setSelectedItem(null);
        setMultiSelection({ trackId, itemIds });
    }, []);

    useEffect(() => {
        return () => {
            setTimelineFocused(false);
        };
    }, [setTimelineFocused]);

    // 计算动态最小缩放 - 根据可视区域宽度和动画时长
    const calculateMinZoom = useCallback((): number => {
        if (!timelineRef.current || duration <= 0) {
            return 0.001; // 默认最小值
        }

        // 获取可视区域宽度
        const containerWidth = timelineRef.current.clientWidth;

        // 计算刚好能容纳全部时间轴的缩放值
        // 留出一些边距，所以使用90%的宽度
        const minZoom = (containerWidth * 0.9) / duration;

        // 确保有一个合理的下限（0.0001 = 0.1%）
        return Math.max(minZoom, 0.0001);
    }, [duration]);

    // 同步轨道容器的滚动到左侧轨道列表（刻度尺/播放头不跟随滚动）
    const handleTracksScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;

        // 同步垂直滚动到左侧轨道列表
        if (trackListRef.current) {
            trackListRef.current.scrollTop = scrollTop;
        }
    }, []);

    const handleTracksMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const container = e.currentTarget;
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = Math.max(0, x / viewConfig.zoom);
            lastMouseTimeRef.current = time;
        },
        [viewConfig.zoom],
    );

    const formatTime = (milliseconds: number): string => {
        const seconds = Math.floor(milliseconds / 1000);
        const ms = Math.floor(milliseconds % 1000);
        return `${seconds}.${ms.toString().padStart(3, '0')}s`;
    };

    // 将 zoom 值转换为滑块值
    const zoomToSliderValue = (zoom: number): number => {
        const minZoom = calculateMinZoom(); // 动态最小缩放
        const maxZoom = 0.1; // 最大缩放：0.1 (显示为100%)
        const minSlider = 1;
        const maxSlider = 1000;

        // 反向对数映射: slider = minSlider + (maxSlider-minSlider) * log(zoom/minZoom) / log(maxZoom/minZoom)
        const t = Math.log(zoom / minZoom) / Math.log(maxZoom / minZoom);
        return minSlider + (maxSlider - minSlider) * t;
    };

    const handleZoomIn = useCallback(() => {
        setViewConfig((prev) => ({
            ...prev,
            zoom: Math.min(prev.zoom * 1.5, 0.1), // 最大缩放0.1 (显示为100%)
        }));
    }, []);

    const handleZoomOut = useCallback(() => {
        setViewConfig((prev) => {
            const minZoom = calculateMinZoom(); // 动态计算最小缩放
            return {
                ...prev,
                zoom: Math.max(prev.zoom / 1.5, minZoom),
            };
        });
    }, [calculateMinZoom]);

    const handleZoomSliderChange = useCallback(
        (_e: unknown, data: { value: number }) => {
            // 滑块值范围为 1-1000，需要转换为 zoom 值（动态最小值 - 0.1）
            // 使用对数映射以便更好地控制小值区间
            const sliderValue = data.value;
            const minZoom = calculateMinZoom(); // 动态最小缩放
            const maxZoom = 0.1; // 最大缩放：0.1 (显示为100%)
            const minSlider = 1;
            const maxSlider = 1000;

            // 对数映射: zoom = minZoom * (maxZoom/minZoom)^((slider-minSlider)/(maxSlider-minSlider))
            const t = (sliderValue - minSlider) / (maxSlider - minSlider);
            const zoom = minZoom * Math.pow(maxZoom / minZoom, t);

            setViewConfig((prev) => ({
                ...prev,
                zoom,
            }));
        },
        [calculateMinZoom],
    );

    const handlePlayheadDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDraggingPlayhead(true);
    }, []);

    const handlePlayheadDrag = useCallback(
        (e: MouseEvent) => {
            if (!isDraggingPlayhead || !timelineRef.current) return;

            const rect = timelineRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = Math.max(0, Math.min(duration, x / viewConfig.zoom));
            onSeek(time);
        },
        [isDraggingPlayhead, duration, viewConfig.zoom, onSeek],
    );

    const handlePlayheadDragEnd = useCallback(() => {
        setIsDraggingPlayhead(false);
    }, []);

    const handleItemDragStart = useCallback(
        (item: AnimationTrackItem, trackId: string) => {
            let groupItems: AnimationTrackItem[] | undefined;

            if (multiSelection && multiSelection.trackId === trackId && multiSelection.itemIds.includes(item.id)) {
                const track = tracks.find((t) => t.id === trackId);
                if (track) {
                    const idSet = new Set(multiSelection.itemIds);
                    groupItems = track.items.filter((i) => idSet.has(i.id));
                }
            }

            const dragData = { item, fromTrackId: trackId, groupItems };
            setDraggingItem(dragData);
            draggingItemRef.current = dragData;
        },
        [tracks, multiSelection],
    );

    const handleItemDragEnd = useCallback(() => {
        setDraggingItem(null);
        draggingItemRef.current = null; // 同步更新ref
    }, []);

    const handleCrossTrackDragMove = useCallback((item: AnimationTrackItem, newStartTime: number) => {
        setDraggingItem((prev) => {
            if (!prev || prev.item.id !== item.id) return prev;
            const updatedItem = { ...prev.item, startTime: newStartTime };
            const newDragData = { ...prev, item: updatedItem };
            draggingItemRef.current = newDragData;
            return newDragData;
        });
    }, []);

    // 处理item位置因防重叠被调整后的回调
    const handlePositionAdjusted = useCallback(() => {
        // 将缩放置于当前可达到的最小值
        const minZoom = calculateMinZoom();
        setViewConfig((prev) => ({
            ...prev,
            zoom: minZoom,
        }));
    }, [calculateMinZoom]);

    const handleCrossTrackMouseMove = useCallback(() => {
        // 跨track拖拽时的鼠标移动，由各个track自己检测
        // 这里不需要处理，只是保留给未来扩展
    }, []);

    const handleCrossTrackMouseUp = useCallback(
        (e: MouseEvent) => {
            const currentDraggingItem = draggingItemRef.current;
            if (!currentDraggingItem) return;

            const tracksContainer = timelineRef.current;
            if (!tracksContainer) return;

            let targetTrackId: string | null = null;
            const trackElements = tracksContainer.querySelectorAll('[data-track-id]');

            for (const trackElement of Array.from(trackElements)) {
                const rect = trackElement.getBoundingClientRect();
                const trackId = trackElement.getAttribute('data-track-id');
                if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    targetTrackId = trackId;
                    break;
                }
            }

            if (targetTrackId && targetTrackId !== currentDraggingItem.fromTrackId) {
                const anchorItemId = currentDraggingItem.item.id;
                const anchorNewStartTime = currentDraggingItem.item.startTime;

                let itemIds: string[] = [anchorItemId];

                if (
                    multiSelection &&
                    multiSelection.trackId === currentDraggingItem.fromTrackId &&
                    multiSelection.itemIds.includes(anchorItemId)
                ) {
                    itemIds = multiSelection.itemIds;
                }

                onMoveItemToTrack?.({
                    itemIds,
                    fromTrackId: currentDraggingItem.fromTrackId,
                    toTrackId: targetTrackId,
                    anchorItemId,
                    anchorNewStartTime,
                });
            }

            setDraggingItem(null);
            draggingItemRef.current = null;
        },
        [onMoveItemToTrack, multiSelection],
    );

    // 始终监听全局mouseUp事件，不等待draggingItem状态更新
    useEffect(() => {
        window.addEventListener('mousemove', handleCrossTrackMouseMove);
        window.addEventListener('mouseup', handleCrossTrackMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleCrossTrackMouseMove);
            window.removeEventListener('mouseup', handleCrossTrackMouseUp);
        };
    }, [handleCrossTrackMouseMove, handleCrossTrackMouseUp]);

    useEffect(() => {
        if (isDraggingPlayhead) {
            window.addEventListener('mousemove', handlePlayheadDrag);
            window.addEventListener('mouseup', handlePlayheadDragEnd);
            return () => {
                window.removeEventListener('mousemove', handlePlayheadDrag);
                window.removeEventListener('mouseup', handlePlayheadDragEnd);
            };
        }
    }, [isDraggingPlayhead, handlePlayheadDrag, handlePlayheadDragEnd]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
            }

            if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
                if (multiSelection && multiSelection.itemIds.length > 0) {
                    const track = tracks.find((t) => t.id === multiSelection.trackId);
                    if (track) {
                        const items = track.items.filter((i) => multiSelection.itemIds.includes(i.id));
                        if (items.length > 0) {
                            e.preventDefault();
                            copyEffect(items);
                        }
                    }
                } else if (selectedItem) {
                    const track = tracks.find((t) => t.id === selectedItem.trackId);
                    const item = track?.items.find((i) => i.id === selectedItem.itemId);
                    if (item) {
                        e.preventDefault();
                        copyEffect([item]);
                    }
                }
                return;
            }

            if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
                if (canPasteEffect && selectedTrackId) {
                    const timeFromMouse = lastMouseTimeRef.current;
                    const targetTime = typeof timeFromMouse === 'number' ? timeFromMouse : currentTime;
                    e.preventDefault();
                    pasteEffect(selectedTrackId, targetTime);
                }
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (multiSelection && multiSelection.itemIds.length > 0) {
                    const trackId = multiSelection.trackId;
                    if (onDeleteEffect) {
                        e.preventDefault();
                        multiSelection.itemIds.forEach((id) => {
                            onDeleteEffect(trackId, id);
                        });
                    }
                } else if (selectedItem && onDeleteEffect) {
                    e.preventDefault();
                    onDeleteEffect(selectedItem.trackId, selectedItem.itemId);
                }
                return;
            }

            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                if (playbackState === PlaybackState.Playing) {
                    onPause();
                } else {
                    onPlay();
                }
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const step = 50;
                const newTime = Math.max(0, Math.min(duration, currentTime - step));
                onSeek(newTime);
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const step = 50;
                const newTime = Math.max(0, Math.min(duration, currentTime + step));
                onSeek(newTime);
                return;
            }

            if (e.key === 'Escape' || e.code === 'Escape') {
                e.preventDefault();
                onStop();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        playbackState,
        onPlay,
        onPause,
        currentTime,
        duration,
        onSeek,
        onStop,
        tracks,
        selectedItem,
        multiSelection,
        selectedTrackId,
        copyEffect,
        pasteEffect,
        canPasteEffect,
        onDeleteEffect,
    ]);

    const handleRulerClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (isDraggingPlayhead) return;

            const tracks = timelineRef.current;
            if (!tracks) return;

            // 统一使用轨道容器的左侧作为参考，这样刻度与轨道点击位置一致
            const rect = tracks.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = Math.max(0, Math.min(duration, x / viewConfig.zoom));
            onSeek(time);
        },
        [duration, viewConfig.zoom, onSeek, isDraggingPlayhead],
    );

    // 生成刻度标记 - 根据缩放级别自适应调整间隔
    const generateRulerMarkers = () => {
        const markers: { time: number; label: string; isSecond: boolean }[] = [];

        // 计算合适的刻度间隔，确保标签之间有足够空间
        // 假设每个标签需要至少60像素的空间
        const minPixelsBetweenLabels = 60;
        const minTimeBetweenLabels = minPixelsBetweenLabels / viewConfig.zoom;

        // 定义可用的时间间隔级别（毫秒）
        const intervalLevels = [
            10, // 10ms
            50, // 50ms
            100, // 100ms
            200, // 200ms
            500, // 500ms
            1000, // 1秒
            2000, // 2秒
            5000, // 5秒
            10000, // 10秒
            30000, // 30秒
            60000, // 1分钟
            120000, // 2分钟
            300000, // 5分钟
            600000, // 10分钟
            1800000, // 30分钟
            3600000, // 1小时
        ];

        // 选择第一个大于最小间隔的级别
        const interval = (() => {
            for (const level of intervalLevels) {
                if (level >= minTimeBetweenLabels) {
                    return level;
                }
            }
            const last = intervalLevels[intervalLevels.length - 1];
            return last ?? minTimeBetweenLabels;
        })();

        const totalMarkers = Math.ceil(duration / interval) + 1;

        for (let i = 0; i < totalMarkers; i++) {
            const time = i * interval;
            if (time > duration) break;

            markers.push({
                time,
                label: formatTime(time),
                isSecond: time % 1000 === 0,
            });
        }

        return markers;
    };

    const rulerMarkers = generateRulerMarkers();
    const timelineWidth = duration * viewConfig.zoom;
    const playheadPosition = currentTime * viewConfig.zoom;
    const isPlaying = playbackState === PlaybackState.Playing;

    return (
        <div className={classes.container}>
            {/* 工具栏 */}
            <div className={classes.toolbar}>
                {/* 播放控制 */}
                <div className={classes.playbackControls}>
                    <Tooltip content={t('animation.play', '播放')} relationship="label">
                        <Button
                            icon={<Play24Regular />}
                            onClick={onPlay}
                            disabled={isPlaying}
                            appearance="subtle"
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip content={t('animation.pause', '暂停')} relationship="label">
                        <Button
                            icon={<Pause24Regular />}
                            onClick={onPause}
                            disabled={!isPlaying}
                            appearance="subtle"
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip content={t('animation.stop', '停止')} relationship="label">
                        <Button
                            icon={<Stop24Regular />}
                            onClick={onStop}
                            disabled={playbackState === PlaybackState.Stopped}
                            appearance="subtle"
                            size="small"
                        />
                    </Tooltip>
                </div>

                {/* 分隔线 */}
                <div className={classes.separator} />

                {/* 添加轨道按钮 */}
                {onAddTrack && (
                    <Tooltip content="添加新轨道" relationship="label">
                        <Button icon={<Add20Regular />} onClick={onAddTrack} appearance="primary" size="small">
                            添加轨道
                        </Button>
                    </Tooltip>
                )}

                {/* 分隔线 */}
                <div className={classes.separator} />

                {/* 时间显示 */}
                <div className={classes.timeDisplay}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>

                {/* 缩放控制 */}
                <div className={classes.zoomControls}>
                    <Tooltip content={t('animation.zoomOut', '缩小')} relationship="label">
                        <Button icon={<ZoomOut24Regular />} onClick={handleZoomOut} appearance="subtle" size="small" />
                    </Tooltip>

                    {/* 缩放滑块 */}
                    <Slider
                        className={classes.zoomSlider}
                        min={1}
                        max={1000}
                        // eslint-disable-next-line react-hooks/refs
                        value={zoomToSliderValue(viewConfig.zoom)}
                        onChange={handleZoomSliderChange}
                        size="small"
                    />

                    <Tooltip content={t('animation.zoomIn', '放大')} relationship="label">
                        <Button icon={<ZoomIn24Regular />} onClick={handleZoomIn} appearance="subtle" size="small" />
                    </Tooltip>
                </div>
            </div>

            {/* 时间线区域 */}
            <div className={classes.timelineArea}>
                {/* 轨道列表 */}
                <div className={classes.trackList} ref={trackListRef}>
                    <div style={{ height: '30px', borderBottom: `1px solid ${tokens.colorNeutralStroke1}` }}></div>
                    {tracks.map((track) => {
                        const canDeleteEmptyTrack = !!onDeleteTrack && track.items.length === 0 && tracks.length > 1;

                        return (
                            <div
                                key={track.id}
                                style={{
                                    height: '60px',
                                    paddingLeft: tokens.spacingHorizontalM, // 只保留左右内边距，移除上下内边距
                                    paddingRight: tokens.spacingHorizontalM,
                                    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: tokens.fontSizeBase200,
                                }}
                            >
                                <span>{track.name || `轨道 ${track.id}`}</span>
                                {canDeleteEmptyTrack && (
                                    <Tooltip content="删除空轨道" relationship="label">
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<Delete24Regular />}
                                            style={{ marginLeft: 'auto' }}
                                            onClick={() => onDeleteTrack?.(track.id)}
                                        />
                                    </Tooltip>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 时间线容器 */}
                <div className={classes.timelineContainer}>
                    {/* 时间刻度尺（仅在此处响应点击跳转播放时间） */}
                    <div className={classes.timelineRuler} ref={rulerRef} onClick={handleRulerClick}>
                        <div className={classes.rulerMarkers} style={{ width: `${timelineWidth}px` }}>
                            {rulerMarkers.map((marker, index) => (
                                <div
                                    key={index}
                                    className={classes.rulerMarker}
                                    style={{ left: `${marker.time * viewConfig.zoom}px` }}
                                >
                                    {/* 刻度线在左 */}
                                    <div
                                        className={classes.rulerTick}
                                        style={{ height: marker.isSecond ? '16px' : '8px' }}
                                    />
                                    {/* 秒数在右 */}
                                    <span className={classes.rulerLabel}>{marker.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 轨道容器（不再响应点击跳转，只负责拖拽/编辑） */}
                    <div
                        className={classes.tracksContainer}
                        ref={timelineRef}
                        onScroll={handleTracksScroll}
                        onMouseEnter={() => setTimelineFocused(true)}
                        onMouseLeave={() => setTimelineFocused(false)}
                        onMouseMove={handleTracksMouseMove}
                    >
                        {/* 网格背景 */}
                        {viewConfig.showGrid && (
                            <div className={classes.grid} style={{ width: `${timelineWidth}px` }}>
                                {rulerMarkers.map((marker, index) => (
                                    <div
                                        key={index}
                                        className={classes.gridLine}
                                        style={{ left: `${marker.time * viewConfig.zoom}px` }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* 轨道 */}
                        <div style={{ position: 'relative', minWidth: `${timelineWidth}px` }}>
                            {tracks.map((track) => (
                                <TimelineTrack
                                    key={track.id}
                                    track={track}
                                    zoom={viewConfig.zoom}
                                    onUpdate={onTrackUpdate}
                                    onAddEffect={onAddEffect}
                                    onEditEffect={onEditEffect}
                                    onDeleteEffect={onDeleteEffect}
                                    onDragStart={handleItemDragStart}
                                    onDragEnd={handleItemDragEnd}
                                    onCrossTrackDragMove={handleCrossTrackDragMove}
                                    onPositionAdjusted={handlePositionAdjusted}
                                    draggingItem={draggingItem}
                                    isSelected={selectedTrackId === track.id}
                                    onSelectTrack={handleSelectTrack}
                                    onSelectItem={handleSelectItem}
                                    selectedItemId={
                                        selectedItem && selectedItem.trackId === track.id ? selectedItem.itemId : null
                                    }
                                    multiSelectedItemIds={
                                        multiSelection && multiSelection.trackId === track.id
                                            ? multiSelection.itemIds
                                            : []
                                    }
                                    onMarqueeSelectItems={handleMarqueeSelectItems}
                                    onCopyItems={(items) => {
                                        if (items.length > 0) {
                                            copyEffect(items);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className={classes.playheadOverlay} style={{ left: `${playheadPosition}px` }}>
                        <div className={classes.playheadHandle} onMouseDown={handlePlayheadDragStart} />
                    </div>
                </div>
            </div>
        </div>
    );
};
