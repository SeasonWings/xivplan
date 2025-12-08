import Konva from 'konva';
import React, { useEffect, useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import Icon from '../../assets/zone/line_knockback.svg?react';
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
import { ChevronTail } from './shapes';
import { getArrowStyle, getZoneStyle } from './style';
import { useTranslation } from 'react-i18next';

const DEFAULT_SIZE = 150;

export const ZoneLineKnockback: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();

    return (
        <PrefabIcon
            draggable
            name={t('objects.lineKnockback', { defaultValue: 'Line knockback' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.LineKnockback,
                        width: DEFAULT_SIZE,
                        height: DEFAULT_SIZE,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<RectangleZone>(ObjectType.LineKnockback, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Rect,
            color: DEFAULT_AOE_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            width: DEFAULT_SIZE,
            height: DEFAULT_SIZE,
            rotation: 0,
            ...object,
            ...position,
        },
    };
});

const OFFSCREEN_X = -10000;
const OFFSCREEN_Y = -10000;

const PATTERN_W = 50;
const PATTERN_H = 50;
const ARROW_W = 25;
const ARROW_H = 15;

const LineKnockbackRenderer: React.FC<RendererProps<RectangleZone>> = ({ object }) => {
    const highlightProps = useHighlightProps(object);
    const [pattern, setPattern] = useState<HTMLImageElement>();
    const style = getZoneStyle(object.color, object.opacity, Math.min(object.width, object.height));

    const arrow = getArrowStyle(object.color, object.opacity * 3);
    const { fill, ...stroke } = style;

    const arrowRef = useRef<Konva.Group>(null);
    useEffect(() => {
        arrowRef.current?.toImage({
            // This seems like a hack. Is there a better way to draw offscreen?
            x: OFFSCREEN_X,
            y: OFFSCREEN_Y,
            width: PATTERN_W,
            height: PATTERN_H,
            callback: setPattern,
        });
    }, [fill, arrow, object.opacity, arrowRef]);

    // 默认开启动画（仅对 LineKnockback 类型）
    const isAnimated =
        object.type === ObjectType.LineKnockback &&
        (object as RectangleZone & { animated?: boolean }).animated !== false;

    // 箭头持续移动动画
    const [arrowOffset, setArrowOffset] = useState(0);
    // 箭头闪烁效果
    const [pulseOpacity, setPulseOpacity] = useState(1);

    // 动画关闭时使用默认值
    const finalArrowOffset = isAnimated ? arrowOffset : 0;
    const finalPulseOpacity = isAnimated ? pulseOpacity : 1;

    useEffect(() => {
        if (!isAnimated) {
            return;
        }

        let animationFrameId: number;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const arrowCycle = 500; // 箭头移动周期
            const pulseCycle = 1200; // 闪烁周期
            const fadeUpDuration = 200; // 从0回到1的过渡时间(0.2秒)
            const arrowProgress = (elapsed % arrowCycle) / arrowCycle;
            const pulseProgress = (elapsed % pulseCycle) / pulseCycle;

            // 箭头持续向下移动（沿着击退方向）
            // 从顶部 (0) 移动到底部 (PATTERN_H)，循环往复
            setArrowOffset(arrowProgress * PATTERN_H);

            // 闪烁效果: 1 → 0.2 (800ms) → 1 (200ms)
            const fadeDownDuration = pulseCycle - fadeUpDuration; // 800ms
            const minOpacity = 0.1; // 最小透明度
            let opacity: number;

            if (pulseProgress < fadeDownDuration / pulseCycle) {
                // 前800ms: 从1降到0.2
                const fadeDownProgress = (pulseProgress * pulseCycle) / fadeDownDuration;
                opacity = 1 - fadeDownProgress * (1 - minOpacity);
            } else {
                // 后200ms: 从0.2快速回到1
                const fadeUpProgress = (pulseProgress * pulseCycle - fadeDownDuration) / fadeUpDuration;
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
                            {/* 背景填充 - 不闪烁 */}
                            <Rect width={object.width} height={object.height} fill={fill} {...stroke} />
                            {/*箭头图案 - 带闪烁效果 */}
                            <Rect
                                width={object.width}
                                height={object.height}
                                fillPatternImage={pattern}
                                fillPatternOffsetX={PATTERN_W / 2}
                                fillPatternOffsetY={PATTERN_H / 2 - finalArrowOffset}
                                fillPatternX={object.width / 2}
                                fillPatternY={object.height / 2}
                                fillPatternRepeat="repeat"
                                opacity={finalPulseOpacity}
                            />
                        </HideGroup>
                    </Group>
                )}
            </ResizeableObjectContainer>

            <Group ref={arrowRef} x={OFFSCREEN_X} y={OFFSCREEN_Y}>
                <ChevronTail
                    width={ARROW_W}
                    height={ARROW_H}
                    chevronAngle={40}
                    x={PATTERN_W / 2}
                    y={PATTERN_H / 2 + ARROW_H}
                    rotation={180}
                    opacity={(object.opacity * 2) / 100}
                    {...arrow}
                />
            </Group>
        </>
    );
};

registerRenderer<RectangleZone>(ObjectType.LineKnockback, LayerName.Ground, LineKnockbackRenderer);

const LineKnockbackDetails: React.FC<ListComponentProps<RectangleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.lineKnockback', { defaultValue: 'Line knockback' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<RectangleZone>(ObjectType.LineKnockback, LineKnockbackDetails);
