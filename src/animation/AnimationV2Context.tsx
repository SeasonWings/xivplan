/* eslint-disable react-refresh/only-export-components */
import React, { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { SceneObject } from '../scene';
import { useScene } from '../SceneProvider';
import { getObjectsAtTimeV2 } from './animationV2Engine';
import {
    AnimationPlayerState,
    AnimationTrack,
    AnimationTrackItem,
    AnimationV2,
    PlaybackState,
} from './animationV2Types';

interface AnimationV2ContextValue {
    /** 当前动画配置 */
    animation: AnimationV2 | null;
    /** 所有动画列表 */
    animations: readonly AnimationV2[];
    /** 播放器状态 */
    playerState: AnimationPlayerState;
    /** 应用动画后的对象列表 */
    animatedObjects: readonly SceneObject[];
    /** 对象ID到对象的映射 */
    animatedObjectsMap: ReadonlyMap<number, SceneObject>;
    /** 设置当前动画配置 */
    setAnimation: (animation: AnimationV2 | null) => void;
    /** 创建新动画 */
    createAnimation: (name?: string) => void;
    /** 切换当前动画 */
    switchAnimation: (animationId: string) => void;
    /** 删除动画 */
    deleteAnimation: (animationId: string) => void;
    /** 播放控制 */
    play: () => void;
    pause: () => void;
    stop: () => void;
    /** 跳转到指定时间 */
    seekTo: (time: number) => void;
    /** 设置播放速度 */
    setPlaybackSpeed: (speed: number) => void;
    /** 添加轨道 */
    addTrack: (name?: string) => void;
    /** 删除轨道 */
    removeTrack: (trackId: string) => void;
    /** 更新轨道 */
    updateTrack: (track: AnimationTrack) => void;
    /** 添加轨道项 */
    addTrackItem: (trackId: string, item: Omit<AnimationTrackItem, 'id'>) => void;
    /** 删除轨道项 */
    removeTrackItem: (trackId: string, itemId: string) => void;
    /** 更新轨道项 */
    updateTrackItem: (trackId: string, item: AnimationTrackItem) => void;
    /** 复制轨道项（效果）到内部剪贴板 */
    copyEffect: (items: AnimationTrackItem[]) => void;
    /** 粘贴轨道项到指定轨道，可选指定开始时间 */
    pasteEffect: (trackId: string, targetStartTime?: number) => void;
    /** 是否存在可粘贴的效果 */
    canPasteEffect: boolean;
    /** 时间线是否处于焦点/激活状态（用于热键路由） */
    isTimelineFocused: boolean;
    /** 设置时间线焦点状态 */
    setTimelineFocused: (focused: boolean) => void;
    /** 获取应用动画后的对象 */
    getAnimatedObjects: () => readonly SceneObject[];
}

const AnimationV2Context = createContext<AnimationV2ContextValue | null>(null);

const DEFAULT_PLAYER_STATE: AnimationPlayerState = {
    state: PlaybackState.Stopped,
    currentTime: 0,
    playbackSpeed: 1.0,
};

const INITIAL_DURATION = 30000; // 初始时间轴长度30秒

// 计算动画的实际时长
// 逻辑：如果最大track长度超过当前时间轴长度，则扩展为最大长度的1.2倍（留出20%的空间）
const calculateAnimationDuration = (tracks: readonly AnimationTrack[], currentDuration: number): number => {
    let maxEndTime = 0;

    // 计算所有track中最大的结束时间
    for (const track of tracks) {
        for (const item of track.items) {
            const endTime = item.startTime + item.duration;
            if (endTime > maxEndTime) {
                maxEndTime = endTime;
            }
        }
    }

    // 如果没有任何效果，使用初始时长
    if (maxEndTime === 0) {
        return INITIAL_DURATION;
    }

    // 如果最大长度超过了当前时间轴长度，扩展时间轴为最大长度的1.2倍（即最大长度 + 20%）
    if (maxEndTime > currentDuration) {
        return Math.ceil(maxEndTime * 1.2);
    }

    // 否则保持当前时间轴长度不变
    return currentDuration;
};

export const AnimationV2Provider: React.FC<PropsWithChildren> = ({ children }) => {
    const { step, scene, dispatch } = useScene();

    // 获取所有动画和当前动画ID（使用新的V2字段）
    const animations = React.useMemo(
        () => (scene.animationsV2 as AnimationV2[] | undefined) ?? [],
        [scene.animationsV2],
    );
    const currentAnimationId = scene.currentAnimationV2Id;

    // 获取当前激活的动画
    const currentAnimation = animations.find((a) => a.id === currentAnimationId) ?? null;

    const [animation, setAnimationState] = useState<AnimationV2 | null>(() => currentAnimation);
    const [playerState, setPlayerState] = useState<AnimationPlayerState>(DEFAULT_PLAYER_STATE);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const lastAnimationsRef = useRef<string>(JSON.stringify({ animations, currentAnimationId }));

    const animationsRef = useRef(animations);
    const dispatchRef = useRef(dispatch);
    const stepRef = useRef(step);

    // 更新 refs
    React.useEffect(() => {
        animationsRef.current = animations;
        dispatchRef.current = dispatch;
        stepRef.current = step;
    });

    // 监听外部场景加载
    React.useEffect(() => {
        const currentData = JSON.stringify({ animations, currentAnimationId });

        if (currentData !== lastAnimationsRef.current) {
            console.log('[AnimationV2Context] External scene loaded, syncing animation');
            lastAnimationsRef.current = currentData;
            const newCurrentAnimation = animations.find((a) => a.id === currentAnimationId) ?? null;
            setAnimationState(newCurrentAnimation);
            setPlayerState(DEFAULT_PLAYER_STATE);
        }
    }, [animations, currentAnimationId]);

    // 当动画变化时,更新场景
    const setAnimation = React.useCallback((newAnimation: AnimationV2 | null) => {
        setAnimationState(newAnimation);

        if (newAnimation) {
            const updatedAnimations = animationsRef.current.map((a) => (a.id === newAnimation.id ? newAnimation : a));

            lastAnimationsRef.current = JSON.stringify({
                animations: updatedAnimations,
                currentAnimationId: newAnimation.id,
            });

            dispatchRef.current({
                type: 'setAnimationsV2',
                animations: updatedAnimations,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            dispatchRef.current({
                type: 'setCurrentAnimationV2Id',
                animationId: newAnimation.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        } else {
            dispatchRef.current({
                type: 'setCurrentAnimationV2Id',
                animationId: undefined,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        }
    }, []);

    // 创建新动画
    const createAnimation = React.useCallback((name?: string) => {
        const newTrack: AnimationTrack = {
            id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: '轨道 1',
            items: [],
            visible: true,
            locked: false,
        };

        const newAnimation: AnimationV2 = {
            id: `animv2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name || `动画 ${animationsRef.current.length + 1}`,
            tracks: [newTrack],
            duration: INITIAL_DURATION,
            loop: false,
        };

        const updatedAnimations = [...animationsRef.current, newAnimation];

        lastAnimationsRef.current = JSON.stringify({
            animations: updatedAnimations,
            currentAnimationId: newAnimation.id,
        });

        setAnimationState(newAnimation);

        dispatchRef.current({
            type: 'setAnimationsV2',
            animations: updatedAnimations,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        dispatchRef.current({
            type: 'setCurrentAnimationV2Id',
            animationId: newAnimation.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    }, []);

    // 切换当前动画
    const switchAnimation = React.useCallback((animationId: string) => {
        const targetAnimation = animationsRef.current.find((a) => a.id === animationId);
        if (targetAnimation) {
            lastAnimationsRef.current = JSON.stringify({
                animations: animationsRef.current,
                currentAnimationId: animationId,
            });

            setAnimationState(targetAnimation);
            setPlayerState(DEFAULT_PLAYER_STATE);

            dispatchRef.current({
                type: 'setCurrentAnimationV2Id',
                animationId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        }
    }, []);

    // 删除动画
    const deleteAnimation = React.useCallback(
        (animationId: string) => {
            const updatedAnimations = animationsRef.current.filter((a) => a.id !== animationId);

            const currentId = scene.currentAnimationV2Id;
            const newCurrentId = currentId === animationId ? (updatedAnimations[0]?.id ?? undefined) : currentId;

            const newCurrentAnimation = updatedAnimations.find((a) => a.id === newCurrentId) ?? null;

            lastAnimationsRef.current = JSON.stringify({
                animations: updatedAnimations,
                currentAnimationId: newCurrentId,
            });

            setAnimationState(newCurrentAnimation);
            setPlayerState(DEFAULT_PLAYER_STATE);

            dispatchRef.current({
                type: 'setAnimationsV2',
                animations: updatedAnimations,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            dispatchRef.current({
                type: 'setCurrentAnimationV2Id',
                animationId: newCurrentId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        },
        [scene.currentAnimationV2Id],
    );

    // 播放循环
    useEffect(() => {
        if (playerState.state !== PlaybackState.Playing || !animation) {
            return;
        }

        const animate = (timestamp: number) => {
            if (lastTimeRef.current === 0) {
                lastTimeRef.current = timestamp;
            }

            const deltaTime = (timestamp - lastTimeRef.current) * playerState.playbackSpeed;
            lastTimeRef.current = timestamp;

            setPlayerState((prev) => {
                let newTime = prev.currentTime + deltaTime;

                if (newTime >= animation.duration) {
                    if (animation.loop) {
                        newTime = newTime % animation.duration;
                    } else {
                        return {
                            state: PlaybackState.Stopped,
                            currentTime: 0,
                            playbackSpeed: prev.playbackSpeed,
                        };
                    }
                }

                return {
                    ...prev,
                    currentTime: newTime,
                };
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            lastTimeRef.current = 0;
        };
    }, [playerState.state, playerState.playbackSpeed, animation]);

    // 播放控制函数
    const play = React.useCallback(() => {
        setPlayerState((prev) => ({
            ...prev,
            state: PlaybackState.Playing,
        }));
    }, []);

    const pause = React.useCallback(() => {
        setPlayerState((prev) => ({
            ...prev,
            state: PlaybackState.Paused,
        }));
        lastTimeRef.current = 0;
    }, []);

    const stop = React.useCallback(() => {
        setPlayerState({
            state: PlaybackState.Stopped,
            currentTime: 0,
            playbackSpeed: 1.0,
        });
        lastTimeRef.current = 0;
    }, []);

    const seekTo = React.useCallback(
        (time: number) => {
            setPlayerState((prev) => ({
                ...prev,
                currentTime: Math.max(0, Math.min(time, animation?.duration ?? 0)),
            }));
        },
        [animation?.duration],
    );

    const setPlaybackSpeed = React.useCallback((speed: number) => {
        setPlayerState((prev) => ({
            ...prev,
            playbackSpeed: Math.max(0.1, Math.min(5.0, speed)),
        }));
    }, []);

    // 添加轨道
    const addTrack = React.useCallback(
        (name?: string) => {
            if (!animation) return;

            const newTrack: AnimationTrack = {
                id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: name || `轨道 ${animation.tracks.length + 1}`,
                items: [],
                visible: true,
                locked: false,
            };

            setAnimation({
                ...animation,
                tracks: [...animation.tracks, newTrack],
            });
        },
        [animation, setAnimation],
    );

    // 删除轨道
    const removeTrack = React.useCallback(
        (trackId: string) => {
            if (!animation) return;

            setAnimation({
                ...animation,
                tracks: animation.tracks.filter((t) => t.id !== trackId),
            });
        },
        [animation, setAnimation],
    );

    // 更新轨道
    const updateTrack = React.useCallback(
        (track: AnimationTrack) => {
            if (!animation) return;

            const updatedTracks = animation.tracks.map((t) => (t.id === track.id ? track : t));
            const newDuration = calculateAnimationDuration(updatedTracks, animation.duration);

            setAnimation({
                ...animation,
                tracks: updatedTracks,
                duration: newDuration,
            });
        },
        [animation, setAnimation],
    );

    // 添加轨道项
    const addTrackItem = React.useCallback(
        (trackId: string, item: Omit<AnimationTrackItem, 'id'>) => {
            if (!animation) return;

            const newItem: AnimationTrackItem = {
                ...item,
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };

            const updatedTracks = animation.tracks.map((track) =>
                track.id === trackId
                    ? {
                          ...track,
                          items: [...track.items, newItem],
                      }
                    : track,
            );

            const newDuration = calculateAnimationDuration(updatedTracks, animation.duration);

            setAnimation({
                ...animation,
                tracks: updatedTracks,
                duration: newDuration,
            });
        },
        [animation, setAnimation],
    );

    const [effectClipboard, setEffectClipboard] = useState<AnimationTrackItem[] | null>(null);
    const [isTimelineFocused, setTimelineFocused] = useState(false);

    const copyEffect = React.useCallback((items: AnimationTrackItem[]) => {
        setEffectClipboard(items);
    }, []);

    const pasteEffect = React.useCallback(
        (trackId: string, targetStartTime?: number) => {
            if (!animation || !effectClipboard || effectClipboard.length === 0) return;

            const items = effectClipboard;
            const minStart = Math.min(...items.map((i) => i.startTime));
            const baseStart = targetStartTime ?? minStart;

            const updatedTracks = animation.tracks.map((track) => {
                if (track.id !== trackId) {
                    return track;
                }

                const newItems: AnimationTrackItem[] = [...track.items];

                for (const baseItem of items) {
                    const offset = baseItem.startTime - minStart;
                    const itemToAdd: Omit<AnimationTrackItem, 'id'> = {
                        ...baseItem,
                        startTime: baseStart + offset,
                    };

                    const newItem: AnimationTrackItem = {
                        ...itemToAdd,
                        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    };

                    newItems.push(newItem);
                }

                return {
                    ...track,
                    items: newItems,
                };
            });

            const newDuration = calculateAnimationDuration(updatedTracks, animation.duration);

            setAnimation({
                ...animation,
                tracks: updatedTracks,
                duration: newDuration,
            });
        },
        [animation, effectClipboard, setAnimation],
    );

    // 删除轨道项
    const removeTrackItem = React.useCallback(
        (trackId: string, itemId: string) => {
            setAnimationState((prev) => {
                if (!prev) {
                    return prev;
                }

                const updatedTracks: AnimationTrack[] = prev.tracks.map((track: AnimationTrack) =>
                    track.id === trackId
                        ? {
                              ...track,
                              items: track.items.filter((item: AnimationTrackItem) => item.id !== itemId),
                          }
                        : track,
                );

                const newDuration = calculateAnimationDuration(updatedTracks, prev.duration);
                const newAnimation: AnimationV2 = {
                    ...prev,
                    tracks: updatedTracks,
                    duration: newDuration,
                };

                const updatedAnimations = animationsRef.current.map((a) =>
                    a.id === newAnimation.id ? newAnimation : a,
                );

                animationsRef.current = updatedAnimations;
                lastAnimationsRef.current = JSON.stringify({
                    animations: updatedAnimations,
                    currentAnimationId: newAnimation.id,
                });

                dispatchRef.current({
                    type: 'setAnimationsV2',
                    animations: updatedAnimations,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
                dispatchRef.current({
                    type: 'setCurrentAnimationV2Id',
                    animationId: newAnimation.id,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);

                return newAnimation;
            });
        },
        [setAnimationState],
    );

    // 更新轨道项
    const updateTrackItem = React.useCallback(
        (trackId: string, item: AnimationTrackItem) => {
            if (!animation) return;

            const updatedTracks = animation.tracks.map((track) =>
                track.id === trackId
                    ? {
                          ...track,
                          items: track.items.map((i) => (i.id === item.id ? item : i)),
                      }
                    : track,
            );

            const newDuration = calculateAnimationDuration(updatedTracks, animation.duration);

            setAnimation({
                ...animation,
                tracks: updatedTracks,
                duration: newDuration,
            });
        },
        [animation, setAnimation],
    );

    // 使用 useMemo 缓存动画对象结果
    const animatedObjects = React.useMemo((): readonly SceneObject[] => {
        if (!animation || playerState.state === PlaybackState.Stopped) {
            return step.objects;
        }

        const objects = getObjectsAtTimeV2(animation, playerState.currentTime, step.objects);

        if (objects.length === 0) {
            return step.objects;
        }

        return objects;
    }, [animation, playerState.state, playerState.currentTime, step.objects]);

    // 创建对象 ID 到对象的 Map
    const animatedObjectsMap = React.useMemo(() => {
        return new Map(animatedObjects.map((obj) => [obj.id, obj]));
    }, [animatedObjects]);

    // 获取应用动画后的对象
    const getAnimatedObjects = React.useCallback((): readonly SceneObject[] => {
        return animatedObjects;
    }, [animatedObjects]);

    const value: AnimationV2ContextValue = {
        animation,
        animations,
        playerState,
        animatedObjects,
        animatedObjectsMap,
        setAnimation,
        createAnimation,
        switchAnimation,
        deleteAnimation,
        play,
        pause,
        stop,
        seekTo,
        setPlaybackSpeed,
        addTrack,
        removeTrack,
        updateTrack,
        addTrackItem,
        removeTrackItem,
        updateTrackItem,
        getAnimatedObjects,
        copyEffect,
        pasteEffect,
        canPasteEffect: effectClipboard !== null,
        isTimelineFocused,
        setTimelineFocused,
    };

    return <AnimationV2Context value={value}>{children}</AnimationV2Context>;
};

export function useAnimationV2(): AnimationV2ContextValue {
    const context = useContext(AnimationV2Context);
    if (!context) {
        throw new Error('useAnimationV2 must be used within AnimationV2Provider');
    }
    return context;
}
