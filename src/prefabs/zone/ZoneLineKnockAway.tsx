import Konva from 'konva';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import Icon from '../../assets/zone/line_knock_away.svg?react';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { LayerName } from '../../render/layers';
import { ObjectType, RectangleZone } from '../../scene';
import { DEFAULT_AOE_COLOR, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { HideGroup } from '../HideGroup';
import { PrefabIcon } from '../PrefabIcon';
import { ResizeableObjectContainer } from '../ResizeableObjectContainer';
import { useHighlightProps } from '../highlight';
import { ChevronConfig, ChevronTail } from './shapes';
import { getArrowStyle, getZoneStyle } from './style';
import { useTranslation } from 'react-i18next';

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 250;

export const ZoneLineKnockAway: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();

    return (
        <PrefabIcon
            draggable
            name={t('objects.lineKnockAway', { defaultValue: 'Line knock away' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.LineKnockAway,
                        width: DEFAULT_WIDTH,
                        height: DEFAULT_HEIGHT,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<RectangleZone>(ObjectType.LineKnockAway, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Rect,
            color: DEFAULT_AOE_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            rotation: 0,
            animated: true,
            ...object,
            ...position,
        },
    };
});

const OFFSCREEN_X = -10000;
const OFFSCREEN_Y = -10000;

const ARROW_SIZE_FRAC = 0.3;
const ARROW_HEIGHT_FRAC = 3 / 5;
const ARROW_PAD = 0.08;

const LineKnockAwayRenderer: React.FC<RendererProps<RectangleZone>> = ({ object }) => {
    const highlightProps = useHighlightProps(object);
    const [pattern, setPattern] = useState<HTMLImageElement>();
    const style = getZoneStyle(object.color, object.opacity, Math.min(object.width, object.height));
    const { fill, ...stroke } = style;

    const patternWidth = object.width;
    const patternHeight = object.width / 2;

    const width = patternWidth * ARROW_SIZE_FRAC;
    const height = width * ARROW_HEIGHT_FRAC;

    const arrow: ChevronConfig = {
        ...getArrowStyle(object.color, object.opacity * 3),
        width,
        height,
        y: patternHeight / 2,
        chevronAngle: 40,
        opacity: (object.opacity * 2) / 100,
    };

    const arrowRef = useRef<Konva.Group>(null);
    const leftArrowRef = useRef<Konva.Group>(null);
    const rightArrowRef = useRef<Konva.Group>(null);
    const [leftPattern, setLeftPattern] = useState<HTMLImageElement>();
    const [rightPattern, setRightPattern] = useState<HTMLImageElement>();

    useLayoutEffect(() => {
        arrowRef.current?.toImage({
            // This seems like a hack. Is there a better way to draw offscreen?
            x: OFFSCREEN_X,
            y: OFFSCREEN_Y,
            width: patternWidth,
            height: patternHeight,
            callback: setPattern,
        });

        // 生成左侧箭头图案
        leftArrowRef.current?.toImage({
            x: OFFSCREEN_X,
            y: OFFSCREEN_Y,
            width: patternWidth,
            height: patternHeight,
            callback: setLeftPattern,
        });

        // 生成右侧箭头图案
        rightArrowRef.current?.toImage({
            x: OFFSCREEN_X,
            y: OFFSCREEN_Y,
            width: patternWidth,
            height: patternHeight,
            callback: setRightPattern,
        });
    }, [patternWidth, patternHeight, object.color, object.opacity, arrowRef]);

    // 默认开启动画（仅对 LineKnockAway 类型）
    const isAnimated =
        object.type === ObjectType.LineKnockAway &&
        (object as RectangleZone & { animated?: boolean }).animated !== false;

    const [arrowProgress, setArrowProgress] = useState(0);
    const [pulseOpacity, setPulseOpacity] = useState(1);

    // 动画关闭时使用默认值
    const finalArrowProgress = isAnimated ? arrowProgress : 1; // 关闭动画时箭头在结束位置（中间）
    const finalPulseOpacity = isAnimated ? pulseOpacity : 1;

    useEffect(() => {
        if (!isAnimated) {
            return;
        }

        let animationFrameId: number;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const moveDuration = 800; // 0.8s 向中间移动
            const returnDuration = 250; // 0.5s 原路返回
            const totalCycle = moveDuration + returnDuration; // 1.3s 总周期
            const cycleTime = elapsed % totalCycle;

            // 箭头移动
            let progress: number;
            if (cycleTime < moveDuration) {
                // 前半周期：向中间移动 (0.8s)
                progress = cycleTime / moveDuration;
            } else {
                // 后半周期：原路返回 (0.5s)
                progress = 1 - (cycleTime - moveDuration) / returnDuration;
            }
            setArrowProgress(progress);

            // 闪烁
            const minOpacity = 0.2; // 最小透明度
            let opacity: number;

            if (cycleTime < moveDuration) {
                // 移动阶段：从1逐渐变暗到0.2 (0.8s)
                const fadeDownProgress = cycleTime / moveDuration;
                opacity = 1 - fadeDownProgress * (1 - minOpacity);
            } else {
                // 返回阶段：从0.2逐渐变亮到1 (0.5s)
                const returnTime = cycleTime - moveDuration;
                const fadeUpProgress = returnTime / returnDuration;
                opacity = minOpacity + fadeUpProgress * (1 - minOpacity);
            }

            setPulseOpacity(opacity);

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isAnimated]);

    const highlightOffset = style.strokeWidth;
    const highlightWidth = object.width + highlightOffset;
    const highlightHeight = object.height + highlightOffset;

    return (
        <>
            <ResizeableObjectContainer object={object} transformerProps={{ keepRatio: false }}>
                {(groupProps) => (
                    <Group {...groupProps}>
                        {highlightProps && (
                            <Rect
                                offsetX={highlightOffset / 2}
                                offsetY={highlightOffset / 2}
                                width={highlightWidth}
                                height={highlightHeight}
                                {...highlightProps}
                            />
                        )}
                        <HideGroup>
                            {/* 背景层 - 始终静态显示 */}
                            <Rect width={object.width} height={object.height} fill={fill} {...stroke} />

                            {isAnimated ? (
                                // ANIMATE - 只显示移动的箭头
                                <>
                                    {/* 左侧箭头向右移动 */}
                                    <Rect
                                        width={object.width / 2}
                                        height={object.height}
                                        fillPatternImage={leftPattern}
                                        fillPatternOffsetX={patternWidth / 12 - finalArrowProgress * (object.width / 6)}
                                        fillPatternOffsetY={patternHeight / 2}
                                        fillPatternY={object.height / 2}
                                        fillPatternRepeat="repeat-y"
                                        opacity={finalPulseOpacity}
                                    />

                                    {/* 右侧箭头向左移动 */}
                                    <Rect
                                        x={object.width / 2}
                                        width={object.width / 2}
                                        height={object.height}
                                        fillPatternImage={rightPattern}
                                        fillPatternOffsetX={
                                            patternWidth / 1.1 + finalArrowProgress * (object.width / 6)
                                        }
                                        fillPatternOffsetY={patternHeight / 2}
                                        fillPatternX={object.width / 2}
                                        fillPatternY={object.height / 2}
                                        fillPatternRepeat="repeat-y"
                                        opacity={finalPulseOpacity}
                                    />
                                </>
                            ) : (
                                // STATIC - 显示静态箭头
                                <Rect
                                    width={object.width}
                                    height={object.height}
                                    fillPatternImage={pattern}
                                    fillPatternOffsetX={patternWidth / 2}
                                    fillPatternOffsetY={patternHeight / 2}
                                    fillPatternX={object.width / 2}
                                    fillPatternY={object.height / 2}
                                    fillPatternRepeat="repeat-y"
                                />
                            )}
                        </HideGroup>
                    </Group>
                )}
            </ResizeableObjectContainer>
            {/* 静态箭头图案（动画关闭时使用） */}
            <Group ref={arrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <Rect width={patternWidth} height={patternHeight} fill={fill} />
                <ChevronTail x={patternWidth * ARROW_PAD} rotation={-90} {...arrow} />
                <ChevronTail x={patternWidth * (1 - ARROW_PAD)} rotation={90} {...arrow} />
            </Group>

            {/* 左侧箭头图案 - 透明背景 */}
            <Group ref={leftArrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <ChevronTail x={patternWidth * ARROW_PAD} rotation={-90} {...arrow} />
            </Group>

            {/* 右侧箭头图案 - 透明背景 */}
            <Group ref={rightArrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <ChevronTail x={patternWidth * (1 - ARROW_PAD)} rotation={90} {...arrow} />
            </Group>
        </>
    );
};

registerRenderer<RectangleZone>(ObjectType.LineKnockAway, LayerName.Ground, LineKnockAwayRenderer);

const LineKnockAwayDetails: React.FC<ListComponentProps<RectangleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.lineKnockAway', { defaultValue: 'Line knock away' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<RectangleZone>(ObjectType.LineKnockAway, LineKnockAwayDetails);
