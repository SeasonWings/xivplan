/**
 * 动画系统 V2 类型定义 - 可视化时间线编辑器
 * 支持每个元素独立的动画轨道和效果
 */

/**
 * 动画效果类型
 */
export enum AnimationEffectType {
    /** 移动动画（包含位置、旋转、缩放的完整状态记录） */
    Move = 'move',
    /** 曲线移动 */
    CurveMove = 'curveMove',
    /** 自定义关键帧 */
    Custom = 'custom',
}

export type CurveMoveMode = 'rotate' | 'arc' | 'bezier';

export interface CurveMoveConfig {
    readonly mode: CurveMoveMode;
    readonly centerX?: number;
    readonly centerY?: number;
    readonly angle?: number;
    readonly rotateDuration?: number;
    readonly controlX1?: number;
    readonly controlY1?: number;
    readonly controlX2?: number;
    readonly controlY2?: number;
    readonly direction?: 'cw' | 'ccw';
}

/**
 * 缓动函数类型
 */
export enum EasingType {
    Linear = 'linear',
    EaseIn = 'easeIn',
    EaseOut = 'easeOut',
    EaseInOut = 'easeInOut',
    EaseInCubic = 'easeInCubic',
    EaseOutCubic = 'easeOutCubic',
    EaseInOutCubic = 'easeInOutCubic',
}

/**
 * 动画属性关键帧（节点）
 */
export interface AnimationKeyframe {
    /** 时间点（毫秒，相对于轨道项开始时间） */
    readonly time: number;
    /** 动画属性值（完整的对象状态或组信息） */
    readonly value: AnimatedObjectProperties;
    /** 缓动函数 */
    readonly easing?: EasingType;
}

/**
 * 元素动画轨道项（时间线上的一个动画片段）
 */
export interface AnimationTrackItem {
    /** 轨道项ID */
    readonly id: string;
    /** 关联的对象ID */
    readonly objectId: number;
    /** 关联的组ID（如果是作用于元素组的效果） */
    readonly groupId?: string;
    /** 对象名称（用于显示） */
    readonly objectName?: string;
    /** 动画效果类型 */
    readonly effectType: AnimationEffectType;
    /** 开始时间（毫秒） */
    readonly startTime: number;
    /** 持续时间（毫秒） */
    readonly duration: number;
    /** 关键帧列表 */
    readonly keyframes: readonly AnimationKeyframe[];
    /** 缓动函数（默认） */
    readonly easing: EasingType;
    /** 轨道项名称 */
    readonly name?: string;
    /** 是否在持续时间内循环播放（true=循环，false=播放一次后保持最后状态） */
    readonly loop?: boolean;
    readonly curveConfig?: CurveMoveConfig;
}

/**
 * 动画轨道（通用轨道，可包含多个元素的效果）
 */
export interface AnimationTrack {
    /** 轨道ID */
    readonly id: string;
    /** 轨道名称 */
    readonly name?: string;
    /** 轨道项列表 */
    readonly items: readonly AnimationTrackItem[];
    /** 是否可见 */
    readonly visible: boolean;
    /** 是否锁定 */
    readonly locked: boolean;
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

/**
 * 动画配置 V2
 */
export interface AnimationV2 {
    /** 动画ID */
    readonly id: string;
    /** 动画名称 */
    readonly name?: string;
    /** 所有元素的动画轨道 */
    readonly tracks: readonly AnimationTrack[];
    /** 动画总时长（毫秒） */
    readonly duration: number;
    /** 是否循环播放 */
    readonly loop: boolean;
}

/**
 * 时间线视图配置
 */
export interface TimelineViewConfig {
    /** 缩放级别（像素/毫秒） */
    readonly zoom: number;
    /** 滚动位置（水平） */
    readonly scrollX: number;
    /** 滚动位置（垂直） */
    readonly scrollY: number;
    /** 是否显示网格 */
    readonly showGrid: boolean;
    /** 网格间隔（毫秒） */
    readonly gridInterval: number;
}

/**
 * 动画轨道项的动画状态 - 存储对象或元素组的全部属性
 */
export interface AnimatedObjectProperties {
    readonly x?: number;
    readonly y?: number;
    readonly rotation?: number;
    readonly width?: number;
    readonly height?: number;
    readonly radius?: number;
    readonly opacity?: number;
    /** 元素是否隐藏（true=隐藏, false=显示） */
    readonly hide?: boolean;
    /**
     * 组内每个元素的完整属性集合（按对象ID）
     * 新结构：元素组的关键帧通过 perObject 存储组内所有元素的属性快照
     */
    readonly perObject?: Readonly<Record<number, AnimatedObjectProperties>>;
    /**
     * 旧结构兼容字段：组内每个元素的属性覆盖（按对象ID）
     * 值可以是 boolean（仅 hide）或部分属性对象
     */
    readonly perObjectHide?: Readonly<Record<number, boolean | AnimatedObjectProperties>>;
    /** 其他任意属性（包括组名称或ID等元信息） */
    readonly [key: string]: unknown;
}
