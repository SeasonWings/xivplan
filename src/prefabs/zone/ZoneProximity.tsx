import Color from 'colorjs.io';
import { ShapeConfig } from 'konva/lib/Shape';
import React, { useEffect, useState } from 'react';
import { Circle, Group, Line, Path, Wedge } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import Icon from '../../assets/zone/falloff.svg?react';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { LayerName } from '../../render/layers';
import { CircleZone, ObjectType } from '../../scene';
import { COLOR_BLUE_WHITE, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { degtorad } from '../../util';
import { HideGroup } from '../HideGroup';
import { PrefabIcon } from '../PrefabIcon';
import { RadiusObjectContainer } from '../RadiusObjectContainer';
import { useHighlightProps } from '../highlight';
import { getArrowStyle, getShadowColor } from './style';
import { useTranslation } from 'react-i18next';

const DEFAULT_RADIUS = 200;

export const ZoneProximity: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();
    return (
        <PrefabIcon
            draggable
            name={t('objects.proximityAoe', { defaultValue: 'Proximity AOE' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.Proximity,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<CircleZone>(ObjectType.Proximity, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Proximity,
            color: COLOR_BLUE_WHITE,
            opacity: DEFAULT_AOE_OPACITY,
            radius: DEFAULT_RADIUS,
            animated: true,
            ...object,
            ...position,
        },
    };
});

const FlareCorner: React.FC<ShapeConfig> = ({ ...props }) => {
    return <Path data="M4-6H6V-4H7V-7H4" {...props} listening={false} />;
};

const ARROW_A = 50;
const ARROW_W = 20;
const ARROW_H = 8;
const SPOKE_H = 20;
const SPOKE_A = 10;

function getArrowPoints() {
    const a = degtorad(ARROW_A);
    const x1 = Math.cos(a) * ARROW_W;
    const y1 = Math.sin(a) * ARROW_W;
    const x2 = x1 - Math.cos(a) * ARROW_H;
    const y2 = y1 + Math.sin(a) * ARROW_H;
    const y3 = ARROW_H / Math.cos(a);
    // prettier-ignore
    return [
        0, 0,
        x1, y1,
        x2, y2,
        0, y3,
        -x2, y2,
        -x1, y1,
    ];
}

const FlareArrow: React.FC<ShapeConfig> = ({ ...props }) => {
    const { offsetX, offsetY, rotation, shadowColor, ...arrowProps } = props;
    const points = getArrowPoints();

    return (
        <Group offsetX={offsetX} offsetY={offsetY} rotation={rotation} listening={false}>
            <Line points={points} closed={true} {...arrowProps} fill={shadowColor} offsetY={-4} />
            <Line points={points} closed={true} {...arrowProps} />
            <Wedge
                rotation={-90 - SPOKE_A / 2}
                angle={SPOKE_A}
                radius={SPOKE_H}
                y={SPOKE_H + ARROW_H * 2}
                fill={shadowColor}
            />
        </Group>
    );
};

const CORNER_ANGLES = [0, 90, 180, 270];
const ARROW_ANGLES = [0, 120, 240];
const SCALE1 = 1;
const SCALE2 = 2;

function getGradient(color: string, opacity: number) {
    const c = new Color(color);

    // TODO: update to c.set({ alpha: value }) once colorjs.io v0.6.0 is released
    const center = c.clone();
    center.alpha = opacity / 100;
    const centerStr = center.display();

    const edge = c.clone();
    edge.alpha = 0.05;
    const edgeStr = edge.display();

    return [0, centerStr, 1, edgeStr];
}

function getShadowOffset(i: number): ShapeConfig {
    switch (i) {
        case 0:
            return { shadowOffsetX: -0.5, shadowOffsetY: 0.5 };
        case 1:
            return { shadowOffsetX: -0.5, shadowOffsetY: -0.5 };
        case 2:
            return { shadowOffsetX: 0.5, shadowOffsetY: -0.5 };
        default:
            return { shadowOffsetX: 0.5, shadowOffsetY: 0.5 };
    }
}

interface ProximityRendererProps extends RendererProps<CircleZone> {
    radius: number;
    isDragging?: boolean;
}

const ProximityRenderer: React.FC<ProximityRendererProps> = ({ object, radius }) => {
    const highlightProps = useHighlightProps(object);
    const gradient: ShapeConfig = {
        fillRadialGradientColorStops: getGradient(object.color, object.opacity),
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: radius,
    };
    const arrow = getArrowStyle(object.color, object.opacity * 3);
    const shadowColor = getShadowColor(object.color);

    const arrowScale = Math.max(1, radius / DEFAULT_RADIUS);

    // 默认开启动画（仅对 Proximity 类型）
    const isAnimated =
        object.type === ObjectType.Proximity && (object as CircleZone & { animated?: boolean }).animated !== false;

    // 箭头沿半径方向移动的距离
    const [arrowOffset, setArrowOffset] = useState(0);
    // 四角的动画偏移（略有延迟）
    const [cornerOffset, setCornerOffset] = useState(0);

    // 动画关闭时使用默认值
    const finalArrowOffset = isAnimated ? arrowOffset : 0;
    const finalCornerOffset = isAnimated ? cornerOffset : 0;

    useEffect(() => {
        if (!isAnimated) {
            return;
        }

        let animationFrameId: number;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const moveDuration = 800; // 0.8s 向外移动
            const returnDuration = 300; // 0.5s 原路返回
            const totalCycle = moveDuration + returnDuration; // 1.3s 总周期
            const cycleTime = elapsed % totalCycle;

            // 箭头沿半径方向来回移动
            // 0 -> 0.8s: 向外移动 (0 -> 1)
            // 0.8s -> 1.3s: 原路返回 (1 -> 0)
            let progress: number;
            if (cycleTime < moveDuration) {
                // 前半周期：向外移动 (0.8s)
                progress = cycleTime / moveDuration;
            } else {
                // 后半周期：原路返回 (0.5s)
                progress = 1 - (cycleTime - moveDuration) / returnDuration;
            }

            // 移动距离：最多向外移动15像素
            setArrowOffset(progress * 15);

            // 四角动画延迟播放
            const cornerDelay = -200;
            const delayedTime = elapsed - cornerDelay;
            if (delayedTime > 0) {
                const cornerCycleTime = delayedTime % totalCycle;
                let cornerProgress: number;
                if (cornerCycleTime < moveDuration) {
                    cornerProgress = cornerCycleTime / moveDuration;
                } else {
                    cornerProgress = 1 - (cornerCycleTime - moveDuration) / returnDuration;
                }
                setCornerOffset(cornerProgress * 15);
            } else {
                setCornerOffset(0);
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isAnimated]);

    return (
        <>
            {highlightProps && <Circle radius={radius} {...highlightProps} />}

            <HideGroup>
                <Circle radius={radius} {...gradient} />

                <Group scaleX={arrowScale} scaleY={arrowScale}>
                    {CORNER_ANGLES.map((r, i) => {
                        // 计算沿半径方向的偏移量（对角线方向，即角度+45°）
                        const offset = finalCornerOffset * 0.25;
                        const radians = degtorad(r + 135);
                        const offsetX = Math.cos(radians) * offset;
                        const offsetY = Math.sin(radians) * offset;

                        return (
                            <Group key={i} rotation={r} x={offsetX} y={offsetY}>
                                <FlareCorner scaleX={SCALE1} scaleY={SCALE1} {...arrow} />
                                <FlareCorner
                                    scaleX={SCALE2}
                                    scaleY={SCALE2}
                                    {...arrow}
                                    shadowColor={shadowColor}
                                    {...getShadowOffset(i)}
                                />
                            </Group>
                        );
                    })}
                    {ARROW_ANGLES.map((r, i) => (
                        <Group key={i} rotation={r}>
                            <FlareArrow offsetY={60 - finalArrowOffset} {...arrow} shadowColor={shadowColor} />
                        </Group>
                    ))}
                </Group>
            </HideGroup>
        </>
    );
};

const ProximityContainer: React.FC<RendererProps<CircleZone>> = ({ object }) => {
    return (
        <RadiusObjectContainer object={object}>
            {(props) => <ProximityRenderer object={object} {...props} />}
        </RadiusObjectContainer>
    );
};

registerRenderer<CircleZone>(ObjectType.Proximity, LayerName.Ground, ProximityContainer);

const ProximityDetails: React.FC<ListComponentProps<CircleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.proximityAoe', { defaultValue: 'Proximity AOE' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<CircleZone>(ObjectType.Proximity, ProximityDetails);
