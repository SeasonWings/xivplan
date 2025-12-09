import Konva from 'konva';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, Rect } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import Icon from '../../assets/zone/line_stack.svg?react';
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
import { getArrowStyle } from './style';

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 150;

export const ZoneLineStack: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();

    return (
        <PrefabIcon
            draggable
            name={t('objects.lineStack', { defaultValue: 'Line stack' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.LineStack,
                        width: DEFAULT_WIDTH,
                        height: DEFAULT_HEIGHT,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<RectangleZone>(ObjectType.LineStack, (object, position) => {
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

const CHEVRON_ANGLE = 40;

const ARROW_SIZE_FRAC = 0.3;
const ARROW_HEIGHT_FRAC = 3 / 5;
const ARROW_PAD = 0.3;

const LineStackRenderer: React.FC<RendererProps<RectangleZone>> = ({ object }) => {
    const highlightProps = useHighlightProps(object);
    const [leftPattern, setLeftPattern] = useState<HTMLImageElement>();
    const [rightPattern, setRightPattern] = useState<HTMLImageElement>();
    const [pattern, setPattern] = useState<HTMLImageElement>();

    const patternWidth = object.width;
    const patternHeight = object.width / 2;

    const width = patternWidth * ARROW_SIZE_FRAC;
    const height = width * ARROW_HEIGHT_FRAC;

    const arrow: ChevronConfig = {
        ...getArrowStyle(object.color, object.opacity * 2),
        width,
        height,
        y: patternHeight / 2,
        chevronAngle: CHEVRON_ANGLE,
    };

    const leftArrowRef = useRef<Konva.Group>(null);
    const rightArrowRef = useRef<Konva.Group>(null);
    const arrowRef = useRef<Konva.Group>(null);

    useEffect(() => {
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

    // FF14风格的呼吸动画
    // 默认开启动画（仅对 LineStack 类型）
    const isAnimated =
        object.type === ObjectType.LineStack && (object as RectangleZone & { animated?: boolean }).animated !== false;

    // const [pulseOpacity, setPulseOpacity] = useState(1);
    // const [glowIntensity, setGlowIntensity] = useState(0);
    const [arrowProgress, setArrowProgress] = useState(0);
    const [arrowOpacity, setArrowOpacity] = useState(1);

    // 动画关闭时使用默认值
    // const finalPulseOpacity = isAnimated ? pulseOpacity : 1;
    // const finalGlowIntensity = isAnimated ? glowIntensity : 0;
    const finalArrowProgress = isAnimated ? arrowProgress : 1; // 关闭动画时箭头在结束位置（中间）
    const finalArrowOpacity = isAnimated ? arrowOpacity : 1;

    useEffect(() => {
        if (!isAnimated) {
            return;
        }

        let animationFrameId: number;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const moveDuration = 800; // 0.7s 移动阶段
            const fadeOutDuration = 300; // 0.3s 渐隐时间
            const pauseDuration = 100; // 1s 暂停时间
            const cycle = moveDuration + fadeOutDuration + pauseDuration; // 2s 总周期
            const currentTime = elapsed % cycle;

            // 箭头从两侧向中间移动的动画
            let progress: number;
            let opacity: number;

            if (currentTime < moveDuration + fadeOutDuration) {
                // 0-1s: 移动 + 渐隐阶段
                const moveProgress = Math.min(currentTime / moveDuration, 1);
                progress = moveProgress;

                if (currentTime < moveDuration) {
                    // 0-0.7s: 保持满透明度
                    opacity = 1;
                } else {
                    // 0.7-1s: 渐隐到0.1
                    const fadeProgress = (currentTime - moveDuration) / fadeOutDuration;
                    opacity = 1 - fadeProgress * 0.99; // 1 -> 0.1
                }
            } else {
                // 1-2s: 暂停阶段，保持在中间位置和最低透明度
                progress = 1;
                opacity = 0;
            }

            setArrowProgress(progress);
            setArrowOpacity(opacity);

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isAnimated]);

    return (
        <>
            <ResizeableObjectContainer object={object} transformerProps={{ centeredScaling: true, keepRatio: false }}>
                {(groupProps) => (
                    <Group {...groupProps}>
                        {highlightProps && <Rect width={object.width} height={object.height} {...highlightProps} />}
                        {isAnimated ? (
                            // ANIMATE
                            <HideGroup>
                                {/*/!* 外部发光层 - FF14风格脉动效果 *!/*/}
                                {/*<Rect*/}
                                {/*    width={object.width}*/}
                                {/*    height={object.height}*/}
                                {/*    stroke={object.color}*/}
                                {/*    strokeWidth={4}*/}
                                {/*    opacity={finalPulseOpacity * 0.4}*/}
                                {/*    fill="transparent"*/}
                                {/*    shadowColor={object.color}*/}
                                {/*    shadowBlur={20}*/}
                                {/*    shadowOpacity={finalPulseOpacity * 0.5}*/}
                                {/*    listening={false}*/}
                                {/*/>*/}

                                {/*/!* 中间发光层 *!/*/}
                                {/*<Rect*/}
                                {/*    width={object.width}*/}
                                {/*    height={object.height}*/}
                                {/*    stroke={object.color}*/}
                                {/*    strokeWidth={3}*/}
                                {/*    opacity={finalPulseOpacity * 0.6}*/}
                                {/*    fill="transparent"*/}
                                {/*    shadowColor={object.color}*/}
                                {/*    shadowBlur={finalGlowIntensity}*/}
                                {/*    shadowOpacity={finalPulseOpacity * 0.4}*/}
                                {/*    listening={false}*/}
                                {/*/>*/}

                                {/* 左侧箭头向右移动 - 扩展显示范围以显示超出的箭头 */}
                                <Group clip={undefined}>
                                    <Rect
                                        x={-object.width / 6}
                                        width={object.width / 2 + object.width / 6}
                                        height={object.height}
                                        fillPatternImage={leftPattern}
                                        fillPatternOffsetX={
                                            patternWidth / 5 -
                                            object.width / 3 -
                                            finalArrowProgress * (object.width / 3.5)
                                        }
                                        fillPatternOffsetY={patternHeight / 2}
                                        fillPatternX={-object.width / 6}
                                        fillPatternY={object.height / 2}
                                        fillPatternRepeat="repeat-y"
                                        opacity={finalArrowOpacity}
                                    />
                                </Group>

                                {/* 右侧箭头向左移动 - 扩展显示范围以显示超出的箭头 */}
                                <Group clip={undefined}>
                                    <Rect
                                        x={object.width / 2}
                                        width={object.width / 2 + object.width / 6}
                                        height={object.height}
                                        fillPatternImage={rightPattern}
                                        fillPatternOffsetX={
                                            patternWidth / 2 +
                                            object.width / 3 +
                                            finalArrowProgress * (object.width / 3.5)
                                        }
                                        fillPatternOffsetY={patternHeight / 2}
                                        fillPatternX={object.width / 2}
                                        fillPatternY={object.height / 2}
                                        fillPatternRepeat="repeat-y"
                                        opacity={finalArrowOpacity}
                                    />
                                </Group>

                                <ChevronTail
                                    rotation={180}
                                    chevronAngle={CHEVRON_ANGLE}
                                    x={object.width / 2}
                                    y={object.height / 2}
                                    width={object.width * 0.2}
                                    height={object.width * 0.13}
                                    fill={arrow.fill}
                                />
                            </HideGroup>
                        ) : (
                            // STATIC
                            <HideGroup>
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
                                <ChevronTail
                                    rotation={180}
                                    chevronAngle={CHEVRON_ANGLE}
                                    x={object.width / 2}
                                    y={object.height / 2}
                                    width={object.width * 0.2}
                                    height={object.width * 0.13}
                                    fill={arrow.fill}
                                />
                            </HideGroup>
                        )}
                    </Group>
                )}
            </ResizeableObjectContainer>

            {/*左侧箭头图案*/}
            <Group ref={leftArrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <ChevronTail x={patternWidth * ARROW_PAD} rotation={90} {...arrow} />
            </Group>

            {/*右侧箭头图案*/}
            <Group ref={rightArrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <ChevronTail x={patternWidth * (1 - ARROW_PAD)} rotation={-90} {...arrow} />
            </Group>

            {/*无动画箭头*/}
            <Group ref={arrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <ChevronTail x={patternWidth * ARROW_PAD} rotation={90} {...arrow} />
                <ChevronTail x={patternWidth * (1 - ARROW_PAD)} rotation={-90} {...arrow} />
            </Group>
        </>
    );
};

registerRenderer<RectangleZone>(ObjectType.LineStack, LayerName.Ground, LineStackRenderer);

const LineStackDetails: React.FC<ListComponentProps<RectangleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.lineStack', { defaultValue: 'Line stack' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<RectangleZone>(ObjectType.LineStack, LineStackDetails);
