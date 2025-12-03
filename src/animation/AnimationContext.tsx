/* eslint-disable react-refresh/only-export-components */
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SceneObject } from '../scene';
import { useScene } from '../SceneProvider';
import { getObjectsAtTime } from './animationEngine';
import { Animation, AnimationPlayerState, Keyframe, PlaybackState } from './animationTypes';

interface AnimationContextValue {
    /** 当前动画配置 */
    animation: Animation | null;
    /** 播放器状态 */
    playerState: AnimationPlayerState;
    /** 设置动画配置 */
    setAnimation: (animation: Animation | null) => void;
    /** 播放控制 */
    play: () => void;
    pause: () => void;
    stop: () => void;
    /** 跳转到指定时间 */
    seekTo: (time: number) => void;
    /** 设置播放速度 */
    setPlaybackSpeed: (speed: number) => void;
    /** 添加关键帧(记录当前画板状态) */
    addKeyframe: (time: number, name?: string) => void;
    /** 删除关键帧(根据时间、名称、对象数量精确匹配) */
    removeKeyframe: (time: number, name: string | undefined, objectCount: number) => void;
    /** 更新关键帧名称 */
    updateKeyframeName: (time: number, oldName: string | undefined, newName: string) => void;
    /** 更新关键帧时间 */
    updateKeyframeTime: (oldTime: number, name: string | undefined, newTime: number) => void;
    /** 跳转到关键帧并应用其对象状态到画布 */
    jumpToKeyframe: (time: number) => void;
    /** 获取应用动画后的对象 */
    getAnimatedObjects: () => readonly SceneObject[];
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

const DEFAULT_PLAYER_STATE: AnimationPlayerState = {
    state: PlaybackState.Stopped,
    currentTime: 0,
    playbackSpeed: 1.0,
};

export const AnimationProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const { step, scene, dispatch } = useScene();
    // 完全独立管理动画状态,不依赖 scene.animation 的引用
    const [animation, setAnimationState] = useState<Animation | null>(() => scene.animation ?? null);
    const [playerState, setPlayerState] = useState<AnimationPlayerState>(DEFAULT_PLAYER_STATE);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    // 保存上次的 scene.animation 的序列化值,用于深度比较
    const lastSceneAnimationRef = useRef<string>(JSON.stringify(scene.animation ?? null));

    // 监听外部场景加载(如打开文件、撤销/重做等)
    // 使用深度比较而不是引用比较
    React.useEffect(() => {
        const currentSceneAnimation = JSON.stringify(scene.animation ?? null);

        // 只有当序列化后的内容真正不同时才同步
        if (currentSceneAnimation !== lastSceneAnimationRef.current) {
            console.log('[AnimationContext] External scene loaded, syncing animation');
            lastSceneAnimationRef.current = currentSceneAnimation;
            setAnimationState(scene.animation ?? null);
            // 重置播放状态
            setPlayerState(DEFAULT_PLAYER_STATE);
        }
    }, [scene.animation]);

    // 当动画变化时,更新场景
    const setAnimation = React.useCallback(
        (newAnimation: Animation | null) => {
            setAnimationState(newAnimation);
            // 同步更新引用值,避免触发上面的 useEffect
            lastSceneAnimationRef.current = JSON.stringify(newAnimation ?? null);
            // 通过 dispatch 更新场景中的动画数据
            dispatch({
                type: 'setAnimation',
                value: newAnimation ?? undefined,
            });
        },
        [dispatch],
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

                // 处理循环
                if (newTime >= animation.duration) {
                    if (animation.loop) {
                        newTime = newTime % animation.duration;
                    } else {
                        // 非循环动画播放完毕，重置到开始位置
                        return {
                            state: PlaybackState.Stopped,
                            currentTime: 0, // 重置为 0
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
    const play = useCallback(() => {
        setPlayerState((prev) => ({
            ...prev,
            state: PlaybackState.Playing,
        }));
    }, []);

    const pause = useCallback(() => {
        setPlayerState((prev) => ({
            ...prev,
            state: PlaybackState.Paused,
        }));
        lastTimeRef.current = 0;
    }, []);

    const stop = useCallback(() => {
        setPlayerState({
            state: PlaybackState.Stopped,
            currentTime: 0, // 回到开始位置
            playbackSpeed: 1.0,
        });
        lastTimeRef.current = 0;
    }, []);

    const seekTo = useCallback(
        (time: number) => {
            setPlayerState((prev) => ({
                ...prev,
                currentTime: Math.max(0, Math.min(time, animation?.duration ?? 0)),
            }));
        },
        [animation],
    );

    const setPlaybackSpeed = useCallback((speed: number) => {
        setPlayerState((prev) => ({
            ...prev,
            playbackSpeed: Math.max(0.1, Math.min(5.0, speed)),
        }));
    }, []);

    // 关键帧管理函数(记录当前画板状态)
    const addKeyframe = useCallback(
        (time: number, name?: string) => {
            if (!animation) {
                return;
            }

            // 如果没有提供名称,自动生成默认名称 keyframe1, keyframe2...
            let finalName = name;
            if (!finalName) {
                // 计算下一个关键帧编号
                const existingNumbers = animation.keyframes
                    .map((kf) => kf.name)
                    .filter((n) => n && /^keyframe\d+$/.test(n))
                    .map((n) => parseInt(n!.replace('keyframe', ''), 10))
                    .filter((n) => !isNaN(n));

                const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
                finalName = `keyframe${nextNumber}`;
            }

            // 记录当前步骤中所有对象的状态
            const newKeyframe: Keyframe = {
                time,
                objects: [...step.objects] as SceneObject[],
                name: finalName,
            };

            // 添加并按时间排序
            const keyframes = [...animation.keyframes, newKeyframe].sort((a, b) => a.time - b.time);

            // 自动计算动画总时长(最后一个关键帧的时间)
            const duration = keyframes.length > 0 ? Math.max(...keyframes.map((kf) => kf.time)) : 0;

            setAnimation({
                ...animation,
                keyframes,
                duration, // 自动更新 duration
            });
        },
        [animation, step.objects, setAnimation],
    );

    const removeKeyframe = useCallback(
        (time: number, name: string | undefined, objectCount: number) => {
            if (!animation) {
                return;
            }

            // 根据时间、名称、对象数量精确匹配要删除的关键帧
            const keyframes = animation.keyframes.filter((kf) => {
                const timeMatch = Math.abs(kf.time - time) < 10; // 10ms 容差
                const nameMatch = kf.name === name;
                const countMatch = kf.objects.length === objectCount;

                // 只有三个条件都匹配才删除
                return !(timeMatch && nameMatch && countMatch);
            });

            // 重新计算动画总时长
            const duration = keyframes.length > 0 ? Math.max(...keyframes.map((kf) => kf.time)) : 0;

            setAnimation({
                ...animation,
                keyframes,
                duration, // 自动更新 duration
            });
        },
        [animation, setAnimation],
    );

    // 更新关键帧名称
    const updateKeyframeName = useCallback(
        (time: number, oldName: string | undefined, newName: string) => {
            if (!animation) {
                return;
            }

            // 查找并更新关键帧名称
            const keyframes = animation.keyframes.map((kf) => {
                const timeMatch = Math.abs(kf.time - time) < 10; // 10ms 容差
                const nameMatch = kf.name === oldName;

                if (timeMatch && nameMatch) {
                    return { ...kf, name: newName };
                }
                return kf;
            });

            setAnimation({
                ...animation,
                keyframes,
            });
        },
        [animation, setAnimation],
    );

    // 更新关键帧时间
    const updateKeyframeTime = useCallback(
        (oldTime: number, name: string | undefined, newTime: number) => {
            if (!animation) {
                return;
            }

            // 确保新时间非负
            const validNewTime = Math.max(0, newTime);

            // 查找并更新关键帧时间
            const keyframes = animation.keyframes
                .map((kf) => {
                    const timeMatch = Math.abs(kf.time - oldTime) < 10; // 10ms 容差
                    const nameMatch = kf.name === name;

                    if (timeMatch && nameMatch) {
                        return { ...kf, time: validNewTime };
                    }
                    return kf;
                })
                .sort((a, b) => a.time - b.time); // 按时间重新排序

            // 重新计算动画总时长
            const duration = keyframes.length > 0 ? Math.max(...keyframes.map((kf) => kf.time)) : 0;

            setAnimation({
                ...animation,
                keyframes,
                duration,
            });
        },
        [animation, setAnimation],
    );

    // 跳转到关键帧并应用其对象状态到画布
    const jumpToKeyframe = useCallback(
        (time: number) => {
            if (!animation) {
                return;
            }

            // 查找该时间点的关键帧
            const keyframe = animation.keyframes.find((kf) => Math.abs(kf.time - time) < 10); // 10ms 容差

            if (!keyframe) {
                console.warn(`No keyframe found at time ${time}`);
                return;
            }

            // 更新播放时间
            seekTo(time);

            // 完全使用关键帧的对象列表替换当前画布的对象列表
            // 这样可以确保：
            // 1. 关键帧中有的对象会显示在画布上
            // 2. 关键帧中没有的对象会从画布上移除
            const keyframeObjects = [...keyframe.objects];

            // 使用 replace action 完全替换对象列表
            dispatch({
                type: 'replace',
                value: keyframeObjects,
            });
        },
        [animation, step.objects, seekTo, dispatch],
    );

    // 获取应用动画后的对象
    const getAnimatedObjects = useCallback((): readonly SceneObject[] => {
        if (!animation || playerState.state === PlaybackState.Stopped) {
            return step.objects;
        }

        // 使用动画引擎计算当前时间的对象状态
        const animatedObjects = getObjectsAtTime(animation, playerState.currentTime);

        // 如果没有动画对象，返回原始对象
        if (animatedObjects.length === 0) {
            return step.objects;
        }

        return animatedObjects;
    }, [animation, playerState, step.objects]);

    const value: AnimationContextValue = {
        animation,
        playerState,
        setAnimation,
        play,
        pause,
        stop,
        seekTo,
        setPlaybackSpeed,
        addKeyframe,
        removeKeyframe,
        updateKeyframeName,
        updateKeyframeTime,
        jumpToKeyframe,
        getAnimatedObjects,
    };

    return <AnimationContext value={value}>{children}</AnimationContext>;
};

export function useAnimation(): AnimationContextValue {
    const context = useContext(AnimationContext);
    if (!context) {
        throw new Error('useAnimation must be used within AnimationProvider');
    }
    return context;
}
