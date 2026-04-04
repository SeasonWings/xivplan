import React, { useEffect, useMemo, useState } from 'react';
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
import { wrapImageUrl } from '../../util/cos';
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
                if (a !== undefined && a > 0) {
                    data[i] = tr;
                    data[i + 1] = tg;
                    data[i + 2] = tb;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }, [image, targetColor]);
}

export const ZoneArrowZXSJ: React.FC = () => {
    const { t } = useTranslation();
    const [, setDragObject] = usePanelDrag();

    const name = t('objects.arrowZXSJ');
    const iconPath = '/marker/zxsj/fangxiangjiantou.png';
    const [image] = useImageTracked(iconPath);
    void image;

    const icon = useMemo(() => wrapImageUrl(iconPath), [iconPath]);
    const defaultColor = '#ff6600';

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
                        type: ObjectType.ArrowZXSJ,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<CircleZone>(ObjectType.ArrowZXSJ, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.ArrowZXSJ,
            color: '#ff6600',
            opacity: 100,
            radius: 30, // 默认半径设置为 30
            rotation: 0,
            animated: true,
            ...object,
            ...position,
        },
    };
});

const ArrowZXSJRenderer: React.FC<RendererProps<CircleZone>> = ({ object }) => {
    const highlightProps = useHighlightProps(object);
    const [image] = useImageTracked(wrapImageUrl('/marker/zxsj/fangxiangjiantou.png'));
    const radius = object.radius;
    const processedImage = useProcessedImage(image, object.color);

    // 箭头随时间上下浮动的动画
    const [floatY, setFloatY] = useState(0);
    const isAnimated = object.animated !== false;

    useEffect(() => {
        if (!isAnimated) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFloatY(0);
            return;
        }

        let animationFrameId: number;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            // 浮动幅度随半径等比例缩放 (radius / 15)
            // 在默认半径 30 时，幅度为 2 (即之前要求的 10 的 20%)
            const float = Math.sin(elapsed / 300) * (radius / 6);
            setFloatY(float);
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [isAnimated, radius]);

    return (
        <RadiusObjectContainer object={object} minRadius={10} allowRotate>
            {(groupProps) => (
                <Group {...groupProps}>
                    {highlightProps && <Circle radius={radius} {...highlightProps} />}

                    <HideGroup>
                        <KonvaImage
                            image={processedImage}
                            x={-radius}
                            y={-radius + floatY} // 加入浮动效果
                            width={radius * 2}
                            height={radius * 2}
                            opacity={object.opacity / 100}
                        />
                    </HideGroup>
                </Group>
            )}
        </RadiusObjectContainer>
    );
};

registerRenderer<CircleZone>(ObjectType.ArrowZXSJ, LayerName.Ground, ArrowZXSJRenderer);

const ArrowZXSJDetails: React.FC<ListComponentProps<CircleZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    const iconPath = '/marker/zxsj/fangxiangjiantou.png';
    const [image] = useImageTracked(iconPath);
    void image;

    const iconUrl = useMemo(() => wrapImageUrl(iconPath), [iconPath]);

    return (
        <DetailsItem
            icon={
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: object.color,
                        maskImage: `url(${iconUrl})`,
                        WebkitMaskImage: `url(${iconUrl})`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                    }}
                />
            }
            name={t('objects.arrowZXSJ')}
            object={object}
            {...props}
        />
    );
};

registerListComponent<CircleZone>(ObjectType.ArrowZXSJ, ArrowZXSJDetails);
