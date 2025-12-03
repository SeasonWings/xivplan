/**
 * 动画系统类型定义
 */

import { SceneObject } from '../scene';

/**
 * 关键帧 - 记录整个画板在特定时间的状态快照
 */
export interface Keyframe {
    /** 时间点（毫秒） */
    readonly time: number;
    /** 画板上所有对象的状态快照 */
    readonly objects: readonly SceneObject[];
    /** 关键帧名称（可选） */
    readonly name?: string;
}

/**
 * 关键帧属性 - 可以动画化的对象属性
 */
export interface KeyframeProperties {
    readonly x?: number;
    readonly y?: number;
    readonly rotation?: number;
    readonly width?: number;
    readonly height?: number;
    readonly radius?: number;
    readonly opacity?: number;
}

/**
 * 缓动函数类型
 */
export enum EasingType {
    Linear = 'linear',
    EaseIn = 'easeIn',
    EaseOut = 'easeOut',
    EaseInOut = 'easeInOut',
}

/**
 * 动画配置
 */
export interface Animation {
    /** 动画ID（唯一标识） */
    readonly id: string;
    /** 动画名称 */
    readonly name?: string;
    /** 关键帧列表（按时间排序） */
    readonly keyframes: readonly Keyframe[];
    /** 动画总时长（毫秒） */
    readonly duration: number;
    /** 是否循环播放 */
    readonly loop: boolean;
    /** 缓动函数 */
    readonly easing: EasingType;
}

/**
 * 播放状态
 */
export enum PlaybackState {
    Stopped = 'stopped',
    Playing = 'playing',
    Paused = 'paused',
}

/**
 * 动画播放器状态
 */
export interface AnimationPlayerState {
    /** 当前播放状态 */
    readonly state: PlaybackState;
    /** 当前时间（毫秒） */
    readonly currentTime: number;
    /** 播放速度（1.0 = 正常速度） */
    readonly playbackSpeed: number;
}
