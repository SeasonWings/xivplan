import Konva from 'konva';
import { CircleConfig } from 'konva/lib/shapes/Circle';
import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Group } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import { useScene } from '../../SceneProvider';
import Icon from '../../assets/zone/stack.svg?react';
import { getCanvasCoord } from '../../coord';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { ForegroundPortal } from '../../render/Portals';
import { LayerName } from '../../render/layers';
import { ObjectType, StackZone } from '../../scene';
import { DEFAULT_AOE_COLOR, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { useKonvaCache } from '../../useKonvaCache';
import { usePanelDrag } from '../../usePanelDrag';
import { HideGroup } from '../HideGroup';
import { PrefabIcon } from '../PrefabIcon';
import { RadiusObjectContainer } from '../RadiusObjectContainer';
import { useHighlightProps } from '../highlight';
import { Orb } from './Orb';
import { ChevronTail } from './shapes';
import { getStackCircleProps } from './stackUtil';
import { getArrowStyle, getZoneStyle } from './style';

const DEFAULT_RADIUS = 75;

export const ZoneStack: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();

    return (
        <PrefabIcon
            draggable
            name={t('objects.stack', { defaultValue: 'Stack' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.Stack,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<StackZone>(ObjectType.Stack, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Stack,
            color: DEFAULT_AOE_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            radius: DEFAULT_RADIUS,
            count: 1,
            animated: true,
            ...object,
            ...position,
        } as StackZone,
    };
});

const CHEVRON_ANGLES = [45, 135, 225, 315];

interface StackRendererProps extends RendererProps<StackZone> {
    radius: number;
}

const StackRenderer: React.FC<StackRendererProps> = ({ object, radius }) => {
    const highlightProps = useHighlightProps(object);
    const ring = getZoneStyle(object.color, object.opacity, radius * 2);
    const arrow = getArrowStyle(object.color, object.opacity * 2);

    const cx = radius * 0.6;
    const cw = radius * 0.5;
    const ch = radius * 0.325;
    const ca = 40;

    const showOrbs = !object.hide && object.count > 1;

    // FF14风格的呼吸动画
    // 默认开启动画
    const isAnimated = object.animated !== false;

    // const [pulseOpacity, setPulseOpacity] = useState(1);
    const [glowScale, setGlowScale] = useState(1);
    const [arrowOffset, setArrowOffset] = useState(0);

    // 动画关闭时使用默认值
    // const finalPulseOpacity = isAnimated ? pulseOpacity : 1;
    const finalGlowScale = isAnimated ? glowScale : 1;
    const finalArrowOffset = isAnimated ? arrowOffset : 0;

    useEffect(() => {
        if (!isAnimated) {
            return;
        }

        let animationFrameId: number;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const cycle = 1000; // 时间周期
            const progress = (elapsed % cycle) / cycle;

            // 使用正弦波创建平滑的呼吸效果
            const sineWave = Math.sin(progress * Math.PI * 2);

            // // 光晕透明度在 0.6 ~ 1.0 之间波动
            // setPulseOpacity(0.6 + (sineWave * 0.5 + 0.5) * 0.4);

            // 光晕缩放在 0.95 ~ 1.05 之间波动
            setGlowScale(0.95 + (sineWave * 0.5 + 0.5) * 0.1);

            // 箭头从内向外移动的动画
            // 从内部 (0) 移动到外部 (cx * 0.4)，循环往复
            setArrowOffset(progress * cx * 0.4);

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [cx, isAnimated]);

    return (
        <>
            {highlightProps && <Circle radius={radius + ring.strokeWidth} {...highlightProps} />}

            {isAnimated ? (
                // ANIMATE
                <HideGroup>
                    {/*/!* 外部发光层 - FF14风格脉动效果 *!/*/}
                    {/*<Circle*/}
                    {/*    radius={radius * finalGlowScale}*/}
                    {/*    stroke={object.color}*/}
                    {/*    strokeWidth={ring.strokeWidth * 1.5}*/}
                    {/*    opacity={finalPulseOpacity * 0.3}*/}
                    {/*    fill="transparent"*/}
                    {/*    shadowColor={object.color}*/}
                    {/*    shadowBlur={20}*/}
                    {/*    shadowOpacity={finalPulseOpacity * 0.5}*/}
                    {/*    listening={false}*/}
                    {/*/>*/}

                    {/*/!* 中间发光层 *!/*/}
                    {/*<Circle*/}
                    {/*    radius={radius * (1 + (finalGlowScale - 1) * 0.5)}*/}
                    {/*    stroke={object.color}*/}
                    {/*    strokeWidth={ring.strokeWidth * 1.2}*/}
                    {/*    opacity={finalPulseOpacity * 0.5}*/}
                    {/*    fill="transparent"*/}
                    {/*    shadowColor={object.color}*/}
                    {/*    shadowBlur={15}*/}
                    {/*    shadowOpacity={finalPulseOpacity * 0.4}*/}
                    {/*    listening={false}*/}
                    {/*/>*/}

                    {/* 主圆环 */}
                    <Circle radius={radius} {...ring} opacity={0.75} fill="transparent" />

                    {/* 箭头组 - 添加轻微的脉动缩放 */}
                    <Group scaleX={0.98 + finalGlowScale * 0.02} scaleY={0.98 + finalGlowScale * 0.02}>
                        {object.count === 1 && (
                            <ChevronTail
                                rotation={180}
                                chevronAngle={ca}
                                width={cw * 0.6}
                                height={ch * 0.6}
                                {...arrow}
                                listening={false}
                            />
                        )}
                        {showOrbs && <StackOrbs object={object} radius={radius} ring={ring} orb={arrow} />}

                        {/* 外圈箭头 - 从内向外移动 */}
                        {CHEVRON_ANGLES.map((r, i) => (
                            <ChevronTail
                                key={i}
                                offsetY={-cx + finalArrowOffset}
                                rotation={r}
                                chevronAngle={ca}
                                width={cw}
                                height={ch}
                                {...arrow}
                            />
                        ))}
                    </Group>
                </HideGroup>
            ) : (
                // OLD
                <HideGroup>
                    <Circle radius={radius} {...ring} opacity={0.75} fill="transparent" />

                    {object.count === 1 && (
                        <ChevronTail
                            rotation={180}
                            chevronAngle={ca}
                            width={cw * 0.6}
                            height={ch * 0.6}
                            {...arrow}
                            listening={false}
                        />
                    )}
                    {showOrbs && <StackOrbs object={object} radius={radius} ring={ring} orb={arrow} />}

                    {CHEVRON_ANGLES.map((r, i) => (
                        <ChevronTail
                            key={i}
                            offsetY={-cx}
                            rotation={r}
                            chevronAngle={ca}
                            width={cw}
                            height={ch}
                            {...arrow}
                        />
                    ))}
                </HideGroup>
            )}
        </>
    );
};

interface StackOrbsProps extends StackRendererProps {
    ring: ReturnType<typeof getZoneStyle>;
    orb: CircleConfig;
}

const StackOrbs: React.FC<StackOrbsProps> = ({ object, radius, ring }) => {
    const { scene } = useScene();
    const center = getCanvasCoord(scene, object);

    const orbRadius = Math.min(radius * 0.25, 40);
    const orbs = getStackCircleProps(orbRadius, object.count);

    const shapeRef = useRef<Konva.Group>(null);

    useKonvaCache(shapeRef, [object, radius]);

    return (
        <ForegroundPortal>
            <Group ref={shapeRef} {...center} opacity={object.opacity / 40} listening={false}>
                <Circle
                    radius={orbRadius}
                    {...ring}
                    strokeWidth={ring.strokeWidth / 2}
                    opacity={0.35}
                    fill="transparent"
                />
                {orbs.map((props, i) => (
                    <Orb key={i} fill={object.color} {...props} />
                ))}
            </Group>
        </ForegroundPortal>
    );
};

const StackContainer: React.FC<RendererProps<StackZone>> = ({ object }) => {
    return (
        <RadiusObjectContainer object={object}>
            {({ radius }) => <StackRenderer object={object} radius={radius} />}
        </RadiusObjectContainer>
    );
};

registerRenderer<StackZone>(ObjectType.Stack, LayerName.Ground, StackContainer);

const StackDetails: React.FC<ListComponentProps<StackZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.stack', { defaultValue: 'Stack' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<StackZone>(ObjectType.Stack, StackDetails);
