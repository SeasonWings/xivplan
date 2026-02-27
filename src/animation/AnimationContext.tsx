/**
 * 旧版动画系统 - Legacy
 * 新版请使用 AnimationV2Context
 */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { SceneObject } from '../scene';
import { useScene } from '../SceneProvider';
import { getObjectsAtTime } from './animationEngineLegacy';
import { Animation, AnimationPlayerState, EasingType, Keyframe, PlaybackState } from './animationTypesLegacy';

interface AnimationContextValue {
    /** 当前动画配置 */
    animation: Animation | null;
    /** 所有动画列表 */
    animations: readonly Animation[];
    /** 播放器状态 */
    playerState: AnimationPlayerState;
    /** 应用动画后的对象列表（优化性能） */
    animatedObjects: readonly SceneObject[];
    /** 对象ID到对象的映射（优化查找性能） */
    animatedObjectsMap: ReadonlyMap<number, SceneObject>;
    /** 自定义关键帧时间步长（毫秒） */
    keyframeTimeStep: number;
    /** 设置当前动画配置 */
    setAnimation: (animation: Animation | null) => void;
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
    /** 设置关键帧时间步长 */
    setKeyframeTimeStep: (step: number) => void;
    /** 添加关键帧(记录当前画板状态) */
    addKeyframe: (time: number, name?: string) => void;
    /** 删除关键帧(根据时间、名称、对象数量精确匹配) */
    removeKeyframe: (time: number, name: string | undefined, objectCount: number) => void;
    /** 更新关键帧名称 */
    updateKeyframeName: (time: number, oldName: string | undefined, newName: string) => void;
    /** 更新关键帧时间 */
    updateKeyframeTime: (oldTime: number, name: string | undefined, newTime: number) => void;
    /** 更新关键帧对象(将当前画板状态更新到指定关键帧) */
    updateKeyframeObjects: (time: number, name: string | undefined) => void;
    /** 跳转到指定关键帧 */
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

    // 获取所有动画和当前动画ID
    const animations = React.useMemo(() => scene.animations ?? [], [scene.animations]);
    const currentAnimationId = scene.currentAnimationId;

    // 获取当前激活的动画
    const currentAnimation = animations.find((a) => a.id === currentAnimationId) ?? null;

    const [animation, setAnimationState] = useState<Animation | null>(() => currentAnimation);
    const [playerState, setPlayerState] = useState<AnimationPlayerState>(DEFAULT_PLAYER_STATE);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    // 保存上次的动画列表和当前ID的序列化值
    const lastAnimationsRef = useRef<string>(JSON.stringify({ animations, currentAnimationId }));

    // 使用 ref 保持最新的值引用，避免闭包陷阱
    const animationsRef = useRef(animations);
    const dispatchRef = useRef(dispatch);
    const stepRef = useRef(step);

    // 更新 refs
    React.useEffect(() => {
        animationsRef.current = animations;
        dispatchRef.current = dispatch;
        stepRef.current = step;
    });

    // 监听外部场景加载(如打开文件、撤销/重做等)
    // 使用深度比较而不是引用比较
    React.useEffect(() => {
        const currentData = JSON.stringify({ animations, currentAnimationId });

        // 只有当序列化后的内容真正不同时才同步
        if (currentData !== lastAnimationsRef.current) {
            console.log('[AnimationContext] External scene loaded, syncing animation');
            lastAnimationsRef.current = currentData;
            const newCurrentAnimation = animations.find((a) => a.id === currentAnimationId) ?? null;
            setAnimationState(newCurrentAnimation);
            // 重置播放状态
            setPlayerState(DEFAULT_PLAYER_STATE);
        }
    }, [animations, currentAnimationId]);

    // 当动画变化时,更新场景
    const setAnimation = React.useCallback((newAnimation: Animation | null) => {
        setAnimationState(newAnimation);

        if (newAnimation) {
            // 更新动画列表中的对应动画
            const updatedAnimations = animationsRef.current.map((a) => (a.id === newAnimation.id ? newAnimation : a));

            // 同步更新引用值
            lastAnimationsRef.current = JSON.stringify({
                animations: updatedAnimations,
                currentAnimationId: newAnimation.id,
            });

            dispatchRef.current({
                type: 'setAnimations',
                animations: updatedAnimations,
            });
            dispatchRef.current({
                type: 'setCurrentAnimationId',
                animationId: newAnimation.id,
            });
        } else {
            // 删除当前动画
            dispatchRef.current({
                type: 'setCurrentAnimationId',
                animationId: undefined,
            });
        }
    }, []);

    // 创建新动画
    const createAnimation = React.useCallback((name?: string) => {
        const newAnimation: Animation = {
            id: `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name || `动画 ${animationsRef.current.length + 1}`,
            keyframes: [],
            duration: 0,
            loop: false,
            easing: EasingType.EaseInOut,
        };

        const updatedAnimations = [...animationsRef.current, newAnimation];

        lastAnimationsRef.current = JSON.stringify({
            animations: updatedAnimations,
            currentAnimationId: newAnimation.id,
        });

        setAnimationState(newAnimation);

        dispatchRef.current({
            type: 'setAnimations',
            animations: updatedAnimations,
        });
        dispatchRef.current({
            type: 'setCurrentAnimationId',
            animationId: newAnimation.id,
        });
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
                type: 'setCurrentAnimationId',
                animationId,
            });
        }
    }, []);

    // 删除动画
    const deleteAnimation = React.useCallback(
        (animationId: string) => {
            const updatedAnimations = animationsRef.current.filter((a) => a.id !== animationId);

            // 如果删除的是当前动画,切换到第一个或null
            const currentId = scene.currentAnimationId;
            const newCurrentId = currentId === animationId ? (updatedAnimations[0]?.id ?? undefined) : currentId;

            const newCurrentAnimation = updatedAnimations.find((a) => a.id === newCurrentId) ?? null;

            lastAnimationsRef.current = JSON.stringify({
                animations: updatedAnimations,
                currentAnimationId: newCurrentId,
            });

            setAnimationState(newCurrentAnimation);
            setPlayerState(DEFAULT_PLAYER_STATE);

            dispatchRef.current({
                type: 'setAnimations',
                animations: updatedAnimations,
            });
            dispatchRef.current({
                type: 'setCurrentAnimationId',
                animationId: newCurrentId,
            });
        },
        [scene.currentAnimationId],
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
                        // 非循环动画播放完毕，跳转到第一个关键帧
                        const firstKeyframe = animation.keyframes.length > 0 ? animation.keyframes[0] : null;
                        if (firstKeyframe) {
                            // 使用第一个关键帧的对象状态替换画布
                            const keyframeObjects = [...firstKeyframe.objects];
                            dispatchRef.current({
                                type: 'replace',
                                value: keyframeObjects,
                            });
                        }

                        // 重置到第一个关键帧的时间点（如果有）或 0
                        return {
                            state: PlaybackState.Stopped,
                            currentTime: firstKeyframe?.time ?? 0,
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
            currentTime: 0, // 回到开始位置
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

    // 自定义关键帧时间步长状态，默认为100ms
    const [keyframeTimeStep, setKeyframeTimeStep] = useState<number>(100);

    // 关键帧管理函数(记录当前画板状态)
    const addKeyframe = React.useCallback(
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
                objects: [...stepRef.current.objects] as SceneObject[],
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
        [animation, setAnimation],
    );

    const removeKeyframe = React.useCallback(
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
    const updateKeyframeName = React.useCallback(
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
    const updateKeyframeTime = React.useCallback(
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

    // 更新关键帧对象(将当前画布状态更新到指定关键帧)
    const updateKeyframeObjects = React.useCallback(
        (time: number, name: string | undefined) => {
            if (!animation) {
                return;
            }

            // 查找并更新关键帧的对象列表
            const keyframes = animation.keyframes.map((kf) => {
                const timeMatch = Math.abs(kf.time - time) < 10; // 10ms 容差
                const nameMatch = kf.name === name;

                if (timeMatch && nameMatch) {
                    // 使用当前画布的对象状态更新关键帧
                    return { ...kf, objects: [...stepRef.current.objects] as SceneObject[] };
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

    // 跳转到关键帧并应用其对象状态到画布
    const jumpToKeyframe = React.useCallback(
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
            dispatchRef.current({
                type: 'replace',
                value: keyframeObjects,
            });
        },
        [animation, seekTo],
    );

    // 使用 useMemo 缓存动画对象结果，减少拖拽时的重新计算
    const animatedObjects = React.useMemo((): readonly SceneObject[] => {
        if (!animation || playerState.state === PlaybackState.Stopped) {
            return step.objects;
        }

        // 使用动画引擎计算当前时间的对象状态
        const objects = getObjectsAtTime(animation, playerState.currentTime);

        // 如果没有动画对象，返回原始对象
        if (objects.length === 0) {
            return step.objects;
        }

        return objects;
    }, [animation, playerState.state, playerState.currentTime, step.objects]);

    // 创建对象 ID 到对象的 Map，优化 Tether 查找性能（O(1) vs O(n)）
    const animatedObjectsMap = React.useMemo(() => {
        return new Map(animatedObjects.map((obj) => [obj.id, obj]));
    }, [animatedObjects]);

    // 获取应用动画后的对象
    const getAnimatedObjects = React.useCallback((): readonly SceneObject[] => {
        return animatedObjects;
    }, [animatedObjects]);

    const value: AnimationContextValue = {
        animation,
        animations,
        playerState,
        animatedObjects,
        animatedObjectsMap,
        keyframeTimeStep,
        setAnimation,
        createAnimation,
        switchAnimation,
        deleteAnimation,
        play,
        pause,
        stop,
        seekTo,
        setPlaybackSpeed,
        setKeyframeTimeStep,
        addKeyframe,
        removeKeyframe,
        updateKeyframeName,
        updateKeyframeTime,
        updateKeyframeObjects,
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
