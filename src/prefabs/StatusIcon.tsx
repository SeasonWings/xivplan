import Konva from 'konva';
import React, { useLayoutEffect, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Rect, Text } from 'react-konva';
// import useImage from 'use-image';
import { useTranslation } from 'react-i18next';
import { getDragOffset, registerDropHandler } from '../DropHandler';
import { DetailsItem } from '../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../panel/ListComponentRegistry';
import { RendererProps, registerRenderer } from '../render/ObjectRegistry';
import { LayerName } from '../render/layers';
import { IconObject, ObjectType } from '../scene';
import { DEFAULT_IMAGE_OPACITY } from '../theme';
import { useImageTracked } from '../useObjectLoading';
import { usePanelDrag } from '../usePanelDrag';
import { HideGroup } from './HideGroup';
import { PrefabIcon } from './PrefabIcon';
import { ResizeableObjectContainer } from './ResizeableObjectContainer';
import { useHighlightProps } from './highlight';

const DEFAULT_SIZE = 32;

registerDropHandler<IconObject>(ObjectType.Icon, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Icon,
            image: '',
            width: DEFAULT_SIZE,
            height: DEFAULT_SIZE,
            rotation: 0,
            opacity: DEFAULT_IMAGE_OPACITY,
            ...object,
            ...position,
        } as IconObject,
    };
});

interface IconTimerProps {
    time: number;
    width: number;
    height: number;
}

function getIconTimerText(seconds: number) {
    if (seconds < 60) {
        return seconds.toString();
    }
    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)}m`;
    }

    return `${Math.floor(seconds / 3600)}h`;
}

const IconTimer: React.FC<IconTimerProps> = ({ time, width, height }) => {
    const text = getIconTimerText(time);

    const fontSize = Math.max(14, height / 3);
    const strokeWidth = Math.max(1, fontSize / 8);

    const [textNode, setTextNode] = useState<Konva.Text | null>(null);
    const [textWidth, setTextWidth] = useState(width);
    useLayoutEffect(() => {
        // Need to sync state with actual Konva text node size before anything is rendered.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTextWidth(textNode?.measureSize(text).width ?? width);
    }, [textNode, text, fontSize, width, setTextWidth]);

    if (time <= 0) {
        return null;
    }

    return (
        <Text
            ref={setTextNode}
            text={text}
            x={(width - textWidth) / 2}
            y={height * 0.8}
            width={textWidth}
            height={fontSize}
            align="center"
            fill="white"
            stroke="black"
            fontSize={fontSize}
            strokeWidth={strokeWidth}
            fillAfterStrokeEnabled
        />
    );
};

const IconRenderer: React.FC<RendererProps<IconObject>> = ({ object }) => {
    const highlightProps = useHighlightProps(object);
    const [image] = useImageTracked(object.image);
    const coloredImage = useColoredCanvas(image, object.color);

    return (
        <ResizeableObjectContainer object={object} transformerProps={{ centeredScaling: true, keepRatio: true }}>
            {(groupProps) => (
                <Group {...groupProps}>
                    {highlightProps &&
                        (object.shape === 'circle' ? (
                            <Circle
                                x={object.width / 2}
                                y={object.height / 2}
                                radius={Math.max(object.width, object.height) / 2}
                                {...highlightProps}
                            />
                        ) : (
                            <Rect
                                width={object.width}
                                height={object.height}
                                cornerRadius={(object.width + object.height) / 2 / 5}
                                {...highlightProps}
                            />
                        ))}
                    <HideGroup>
                        <KonvaImage
                            image={object.color ? coloredImage : image}
                            width={object.width}
                            height={object.height}
                            opacity={object.opacity ? object.opacity / 100 : 1}
                        />
                        <IconTimer time={object.time ?? 0} width={object.width} height={object.height} />
                    </HideGroup>
                </Group>
            )}
        </ResizeableObjectContainer>
    );
};

function useColoredCanvas(image: HTMLImageElement | undefined, color: string | undefined) {
    const [canvas, setCanvas] = useState<HTMLCanvasElement | HTMLImageElement | undefined>(image);

    useLayoutEffect(() => {
        // 使用标志位或状态来处理
        let result: HTMLCanvasElement | HTMLImageElement | undefined;

        if (!image) {
            result = undefined;
        } else if (!color) {
            result = image;
        } else if (image.width > 0 && image.height > 0) {
            const c = document.createElement('canvas');
            c.width = image.width;
            c.height = image.height;
            const ctx = c.getContext('2d');
            if (ctx) {
                if (image.src.includes('ju.png')) {
                    // 1. 绘制颜色背景
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, c.width, c.height);

                    // 2. 使用 destination-in 和图片，只保留图片形状的颜色层
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(image, 0, 0);

                    // 3. 恢复混合模式，在上面绘制原始图片
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(image, 0, 0);
                } else {
                    // 默认模式：图片染色（mask）
                    ctx.fillStyle = color;
                    ctx.fillRect(0, 0, c.width, c.height);
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(image, 0, 0);
                }
                result = c;
            } else {
                result = image;
            }
        } else {
            // image loaded but width/height 0? keep previous or undefined
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCanvas(result);
    }, [image, color]);

    return canvas;
}

registerRenderer<IconObject>(ObjectType.Icon, LayerName.Default, IconRenderer);

const IconDetails: React.FC<ListComponentProps<IconObject>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    const name = object.name ?? (object.defaultNameKey ? t(object.defaultNameKey) : '');

    // 场景列表图标染色支持
    const icon = object.color ? (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: object.color,
                maskImage: `url(${object.image})`,
                WebkitMaskImage: `url(${object.image})`,
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
            }}
        />
    ) : (
        object.image
    );

    return <DetailsItem icon={icon} name={name} object={object} {...props} />;
};

registerListComponent<IconObject>(ObjectType.Icon, IconDetails);

export interface StatusIconProps {
    name: string;
    defaultNameKey?: string;
    icon: string;
    iconId?: number;
    maxStacks?: number;
    scale?: number;
    color?: string; // 添加 color 属性
}

export const StatusIcon: React.FC<StatusIconProps> = ({ name, defaultNameKey, icon, iconId, maxStacks, color }) => {
    const [, setDragObject] = usePanelDrag();
    // const [image] = useImage(icon);

    // scale = scale ?? 1;
    // let { width, height } = image ?? {};

    // if (width) {
    //     width /= scale;
    // }
    // if (height) {
    //     height /= scale;
    // }

    // 使用默认大小
    const width = DEFAULT_SIZE;
    const height = DEFAULT_SIZE;

    // 如果指定了颜色，图标需要显示该颜色。
    // 在面板图标中，我们通常用 style 来染色，或者如果是 svg，可以用 fill。
    // 对于 png，我们可以用 filter 或者 mask。
    // 这里简单起见，如果是在 PrefabIcon 中显示，我们尝试传递 style。
    // 但是 PrefabIcon 的 icon 属性接受 ReactNode。
    // 如果 icon 是字符串路径，PrefabIcon 内部会渲染 img。

    // 如果提供了 color，我们可能需要在这里处理一下预览图。
    // 但 PrefabIcon 主要是用于拖拽源。
    // 关键是 onDragStart 中传递的数据。

    return (
        <PrefabIcon
            draggable
            name={name}
            title={getTitle(name, maxStacks)}
            icon={
                color ? (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: color,
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
                ) : (
                    icon
                )
            }
            width={width}
            height={height}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.Icon,
                        image: icon,
                        defaultNameKey,
                        width,
                        height,
                        iconId,
                        maxStacks,
                        color, // 传递 color
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

function getTitle(name: string, maxStacks: number | undefined) {
    if (!maxStacks) {
        return name;
    }

    return `${name} \u00D7${maxStacks}`;
}
