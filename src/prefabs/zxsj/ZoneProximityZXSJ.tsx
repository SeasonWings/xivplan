import Konva from 'konva';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Group, Image as KonvaImage } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { LayerName } from '../../render/layers';
import { CircleZone, ObjectType } from '../../scene';
import { useImageTracked } from '../../useObjectLoading';
import { usePanelDrag } from '../../usePanelDrag';
import { HideGroup } from '../HideGroup';
import { PrefabIcon } from '../PrefabIcon';
import { RadiusObjectContainer } from '../RadiusObjectContainer';
import { useHighlightProps } from '../highlight';

/**
 * 处理图片：
 * 1. 抠除指定背景色（变为透明）
 * 2. 将剩余内容染成目标颜色
 */
function useProcessedImage(image: HTMLImageElement | undefined, targetColor: string): HTMLCanvasElement | undefined {
    return useMemo(() => {
        if (!image) return undefined;

        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return undefined;

        // 绘制原图
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 解析目标颜色 (object.color)
        let tr = 255,
            tg = 0,
            tb = 0;
        if (targetColor.startsWith('#')) {
            const hex = targetColor.substring(1);
            if (hex.length === 3) {
                tr = parseInt((hex[0] ?? 'f') + (hex[0] ?? 'f'), 16);
                tg = parseInt((hex[1] ?? 'f') + (hex[1] ?? 'f'), 16);
                tb = parseInt((hex[2] ?? 'f') + (hex[2] ?? 'f'), 16);
            } else if (hex.length === 6) {
                tr = parseInt(hex.substring(0, 2), 16);
                tg = parseInt(hex.substring(2, 4), 16);
                tb = parseInt(hex.substring(4, 6), 16);
            }
        }

        // 背景色 #ede9d6
        const bgR = 0xed; // 237
        const bgG = 0xe9; // 233
        const bgB = 0xd6; // 214
        const tolerance = 20; // 容差，防止边缘锯齿

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // 如果接近背景色，设为透明
            if (
                r !== undefined &&
                g !== undefined &&
                b !== undefined &&
                Math.abs(r - bgR) < tolerance &&
                Math.abs(g - bgG) < tolerance &&
                Math.abs(b - bgB) < tolerance
            ) {
                data[i + 3] = 0; // Alpha = 0
            } else {
                // 否则，染成目标颜色，保留原有的 Alpha（如果是半透明纹理）
                // 这里我们假设非背景区域就是纹理，直接染色
                if (a !== undefined && a > 0) {
                    data[i] = tr;
                    data[i + 1] = tg;
                    data[i + 2] = tb;
                    // Alpha 保持不变，或者可以根据亮度调整
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }, [image, targetColor]);
}

interface ProximityRippleProps {
    startRadius: number; // 新增：起始半径
    endRadius: number; // 新增：结束半径 (原 radius)
    color: string;
    animated?: boolean;
}

const SingleRipple: React.FC<ProximityRippleProps> = ({ startRadius, endRadius, color, animated }) => {
    const circleRef = useRef<Konva.Circle>(null);

    useEffect(() => {
        const node = circleRef.current;
        if (!node) return;

        if (!animated) {
            node.visible(false);
            return;
        }

        const duration = 1000; // 动画时长
        const delay = 400; // 延迟时间
        const totalDuration = duration + delay;

        const anim = new Konva.Animation((frame) => {
            if (!frame) return;

            // 当前在整个周期中的时间
            const timeInCycle = frame.time % totalDuration;

            if (timeInCycle < duration) {
                node.visible(true);
                // 在动画时间内：正常播放 (0 ~ 1)
                const time = timeInCycle / duration;

                // 半径：从 startRadius 到 endRadius
                const currentRadius = startRadius + time * (endRadius - startRadius);
                node.radius(currentRadius);

                // 透明度曲线：前90%保持最大透明度，最后10%快速消失
                let opacity = 0.6;
                if (time > 0.9) {
                    opacity = 0.6 * (1 - (time - 0.9) / 0.1);
                }
                node.opacity(opacity);

                // 线宽：起始5，缓慢变细，结束时约为2.5
                node.strokeWidth(5 * (1 - time * 0.5));
            } else {
                // 在延迟时间内：隐藏
                node.visible(false);
            }
        }, node.getLayer());

        anim.start();

        return () => {
            anim.stop();
        };
    }, [startRadius, endRadius, animated]); // 依赖项更新

    return <Circle ref={circleRef} radius={startRadius} stroke={color} strokeWidth={0} opacity={0} listening={false} />;
};

// 不再需要 Group，直接导出 SingleRipple 或改名
const ProximityRipple: React.FC<ProximityRippleProps> = (props) => {
    return <SingleRipple {...props} />;
};

export const ZoneProximityZXSJ: React.FC = () => {
    const { t } = useTranslation();
    const [, setDragObject] = usePanelDrag();

    const name = t('objects.proximity', { defaultValue: 'Proximity AOE' });
    const icon = '/marker/zxsj/proximity_zxsj.png';
    const defaultColor = '#ff0000';

    return (
        <PrefabIcon
            draggable
            name={name}
            icon={
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: defaultColor,
                        maskImage: `url(${icon})`,
                        WebkitMaskImage: `url(${icon})`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                    }}
                />
            }
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.ProximityZXSJ,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<CircleZone>(ObjectType.ProximityZXSJ, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.ProximityZXSJ,
            color: '#ff0000',
            opacity: 100,
            radius: 200,
            // CircleZone interface doesn't strictly include innerRadius but runtime supports it
            innerRadius: 80,
            rotation: 0,
            animated: true,
            ...object,
            ...position,
        },
    };
});

const ProximityZXSJRenderer: React.FC<RendererProps<CircleZone>> = ({ object }) => {
    const highlightProps = useHighlightProps(object);
    const [image] = useImageTracked('/marker/zxsj/proximity_zxsj.png');
    const radius = object.radius;
    // @ts-expect-error: CircleZone does not have innerRadius
    const innerRadius = object.innerRadius ?? 60;

    // 使用手动控制的 innerRadius 作为渲染半径
    const renderRadius = innerRadius;

    // 使用自定义 Hook 处理图片：抠除 #ede9d6 并染色
    const processedImage = useProcessedImage(image, object.color);

    // 确保 object 有 innerRadius，否则 RadiusObjectContainer 在渲染内圆控制点时会因半径为 0 而出错
    const objectWithInner = { ...object, innerRadius: innerRadius };

    return (
        <RadiusObjectContainer object={objectWithInner} minRadius={60} allowInnerRadius allowRotate>
            {(groupProps) => (
                <Group {...groupProps}>
                    {/* 高亮圈使用真实半径 */}
                    {highlightProps && <Circle radius={radius} {...highlightProps} />}

                    {/* 添加冲击波动画 */}
                    <ProximityRipple
                        startRadius={renderRadius}
                        endRadius={radius}
                        color={object.color}
                        animated={object.animated}
                    />

                    <HideGroup>
                        {/* 绘制圆形遮罩和图片 */}
                        <Group
                            clipFunc={(ctx) => {
                                // 遮罩也使用受限的渲染半径
                                ctx.arc(0, 0, renderRadius, 0, Math.PI * 2, false);
                            }}
                        >
                            {/* 图片：使用受限的渲染半径 */}
                            <KonvaImage
                                image={processedImage} // 使用处理后的图片
                                x={-renderRadius}
                                y={-renderRadius}
                                width={renderRadius * 2}
                                height={renderRadius * 2}
                                opacity={object.opacity / 100}
                            />
                        </Group>
                    </HideGroup>
                </Group>
            )}
        </RadiusObjectContainer>
    );
};

registerRenderer<CircleZone>(ObjectType.ProximityZXSJ, LayerName.Ground, ProximityZXSJRenderer);

const ProximityZXSJDetails: React.FC<ListComponentProps<CircleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: object.color,
                        maskImage: `url(/marker/zxsj/proximity_zxsj.png)`,
                        WebkitMaskImage: `url(/marker/zxsj/proximity_zxsj.png)`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                    }}
                />
            }
            name={t('objects.proximity', { defaultValue: 'Proximity AOE' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<CircleZone>(ObjectType.ProximityZXSJ, ProximityZXSJDetails);
