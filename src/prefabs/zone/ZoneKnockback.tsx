import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Group } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import Icon from '../../assets/zone/knockback.svg?react';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { LayerName } from '../../render/layers';
import { CircleZone, ObjectType } from '../../scene';
import { CENTER_DOT_RADIUS, DEFAULT_AOE_COLOR, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { HideGroup } from '../HideGroup';
import { PrefabIcon } from '../PrefabIcon';
import { RadiusObjectContainer } from '../RadiusObjectContainer';
import { useHighlightProps } from '../highlight';
import { ChevronTail } from './shapes';
import { getArrowStyle, getZoneStyle } from './style';

const DEFAULT_RADIUS = 150;

export const ZoneKnockback: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();
    return (
        <PrefabIcon
            draggable
            name={t('objects.circularKnockback', { defaultValue: 'Circular knockback' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.Knockback,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<CircleZone>(ObjectType.Knockback, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Knockback,
            color: DEFAULT_AOE_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            radius: DEFAULT_RADIUS,
            ...object,
            ...position,
        },
    };
});

const CHEVRON_ANGLES = Array.from({ length: 16 }).map((_, i) => (i * 360) / 16);

interface KnockbackRendererProps extends RendererProps<CircleZone> {
    radius: number;
    isDragging?: boolean;
}

const KnockbackRenderer: React.FC<KnockbackRendererProps> = ({ object, radius, isDragging }) => {
    const highlightProps = useHighlightProps(object);
    const ring = getZoneStyle(object.color, object.opacity, radius * 2);
    const arrow = getArrowStyle(object.color, object.opacity * 3);

    const cx = radius;
    const cw = radius * 0.24;
    const ch = radius * 0.12;
    const ca = 40;

    // 默认开启动画（仅对 Knockback 类型）
    const isAnimated =
        object.type === ObjectType.Knockback && (object as CircleZone & { animated?: boolean }).animated !== false;

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
            const pulseCycle = 1200; // 闪烁周期
            const fadeUpDuration = 200; // 从0.2回到1的过渡时间(0.2秒)
            const pulseProgress = (elapsed % pulseCycle) / pulseCycle;

            // 箭头从中心向外连续移动（沿着径向击退方向）
            // 持续移动，不重置位置，移动速度约为宽度的一半每500ms
            const moveSpeed = cw / 2 / 300; // 每毫秒移动的距离
            const totalOffset = elapsed * moveSpeed; // 持续累加，不取模
            setArrowOffset(totalOffset);

            // 闪烁效果: 1 → 0.2 (800ms) → 1 (200ms)
            const fadeDownDuration = pulseCycle - fadeUpDuration; // 800ms
            const minOpacity = 0.2; // 最小透明度
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
    }, [isAnimated, cw]);

    return (
        <>
            {highlightProps && <Circle radius={radius + ring.strokeWidth / 2} {...highlightProps} />}

            <HideGroup>
                <Circle radius={radius} {...ring} strokeEnabled={false} opacity={0.5} />

                {isDragging && <Circle radius={CENTER_DOT_RADIUS} fill={ring.stroke} />}

                {isAnimated ? (
                    // 动画版本
                    <Group
                        clipFunc={(ctx) => {
                            ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
                        }}
                    >
                        {CHEVRON_ANGLES.map((r, i) => (
                            <Group key={i} rotation={r} listening={false}>
                                {/* 生成足够多的组，确保可见范围内始终有3组箭头 */}
                                {Array.from({ length: 10 }).map((_, groupIndex) => {
                                    // 计算每组箭头的位置偏移
                                    const groupSpacing = cx / 3; // 每组间距为半径的1/3
                                    const groupBaseOffset = groupIndex * groupSpacing; // 正向排列
                                    const startOffset = cx * 0.2; // 箭头从圆心向外20%的距离开始生成
                                    // 使用取模确保循环，周期为半径加一个间距
                                    const rawOffset = (finalArrowOffset - groupBaseOffset) % (cx + groupSpacing);
                                    // 处理负数取模结果，并加上起始偏移
                                    const currentOffset =
                                        (rawOffset < 0 ? rawOffset + (cx + groupSpacing) : rawOffset) + startOffset;

                                    // 只渲染在可见范围内的箭头（从起始位置到超出边界一定距离）
                                    // 留出一个箭头宽度的缓冲区，让箭头完全移出边界后再消失
                                    if (currentOffset < startOffset || currentOffset > cx + cw) return null;

                                    // 根据位置计算缩放比例：从0.25（起始位置）到0.85（圈边）
                                    // 重新映射进度：从startOffset到cx的范围映射到0-1，超出cx后保持在最大值
                                    const progress = Math.min(1, (currentOffset - startOffset) / (cx - startOffset)); // 0到1的进度，最大1
                                    const scale = 0.25 + progress * (0.85 - 0.25); // 线性插值

                                    return (
                                        <ChevronTail
                                            key={groupIndex}
                                            offsetY={currentOffset}
                                            chevronAngle={ca}
                                            width={cw * scale}
                                            height={ch * scale}
                                            opacity={(object.opacity / 100) * finalPulseOpacity}
                                            {...arrow}
                                        />
                                    );
                                })}
                            </Group>
                        ))}
                    </Group>
                ) : (
                    // 静态版本
                    CHEVRON_ANGLES.map((r, i) => (
                        <Group key={i} rotation={r} listening={false}>
                            {[0.25, 0.52, 0.85].map((s, j) => (
                                <ChevronTail
                                    key={j}
                                    offsetY={cx * s}
                                    chevronAngle={ca}
                                    width={cw * s}
                                    height={ch * s}
                                    opacity={object.opacity / 100}
                                    {...arrow}
                                />
                            ))}
                        </Group>
                    ))
                )}
            </HideGroup>
        </>
    );
};

const KnockbackContainer: React.FC<RendererProps<CircleZone>> = ({ object }) => {
    return (
        <RadiusObjectContainer object={object}>
            {(props) => <KnockbackRenderer object={object} {...props} />}
        </RadiusObjectContainer>
    );
};

registerRenderer<CircleZone>(ObjectType.Knockback, LayerName.Ground, KnockbackContainer);

const KnockbackDetails: React.FC<ListComponentProps<CircleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.circularKnockback', { defaultValue: 'Circular knockback' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<CircleZone>(ObjectType.Knockback, KnockbackDetails);
