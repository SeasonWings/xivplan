import React from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Group, Line } from 'react-konva';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import Icon from '../../assets/zone/meteor_tower.svg?react';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { LayerName } from '../../render/layers';
import { ObjectType, TowerZoneZXSJ } from '../../scene';
import { CENTER_DOT_RADIUS, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { HideGroup } from '../HideGroup';
import { PrefabIcon } from '../PrefabIcon';
import { RadiusObjectContainer } from '../RadiusObjectContainer';
import { useHighlightProps } from '../highlight';
import { getZoneStyle } from '../zone/style';

const DEFAULT_COLOR = '#bae3ff';
const DEFAULT_RADIUS = 40;
const DEFAULT_COUNT = 1;

export const ZoneTowerZXSJ: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();

    return (
        <PrefabIcon
            draggable
            name={t('objects.towerZXSJ', { defaultValue: 'Tower (ZXSJ)' })}
            icon={<Icon />}
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.TowerZXSJ,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};

registerDropHandler<TowerZoneZXSJ>(ObjectType.TowerZXSJ, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.TowerZXSJ,
            color: DEFAULT_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            radius: DEFAULT_RADIUS,
            count: DEFAULT_COUNT,
            ...object,
            ...position,
        },
    };
});

// 渐变双头针型竖线组件
interface GradientSpikeProps {
    x: number;
    y: number;
    height: number;
    width: number;
    color: string;
}

// 使用 Path 绘制针形并填充渐变
const SpindleShape: React.FC<GradientSpikeProps> = ({ x, y, height, width, color }) => {
    // const halfHeight = height / 2;
    const halfWidth = width / 2;
    const topHalfWidth = width * 0.25; // 顶部保留 50% 的宽度 (0.25 * 2 = 0.5)

    // 形状修改：
    // 上半部分：梯形收缩
    // 下半部分：矩形不收缩
    // 底部：平底

    return (
        <Group x={x} y={y}>
            <Line
                points={[
                    topHalfWidth,
                    -height, // 右上
                    halfWidth,
                    -height / 2, // 右中
                    halfWidth,
                    0, // 右底
                    -halfWidth,
                    0, // 左底
                    -halfWidth,
                    -height / 2, // 左中
                    -topHalfWidth,
                    -height, // 左上
                ]}
                closed
                fillLinearGradientStartPoint={{ x: 0, y: -height }}
                fillLinearGradientEndPoint={{ x: 0, y: 0 }}
                // 从上到下：透明 -> 颜色 -> 颜色
                fillLinearGradientColorStops={[0, 'transparent', 0.5, color, 1, color]}
                opacity={0.9}
            />
            {/* 底部衔接点 */}
            <Circle
                x={0}
                y={0}
                radius={width}
                fill={color}
                opacity={0.8}
                shadowColor={color}
                shadowBlur={5}
                shadowOpacity={0.5}
            />
        </Group>
    );
};

interface TowerRendererProps extends RendererProps<TowerZoneZXSJ> {
    radius: number;
    isDragging?: boolean;
}

const TowerRenderer: React.FC<TowerRendererProps> = ({ object, radius, isDragging }) => {
    const highlightProps = useHighlightProps(object);
    const style = getZoneStyle(object.color, object.opacity, radius * 2);

    // 计算竖线的位置
    const lineWidth = 3; // 针变细一点 (6 -> 3, 细50%)
    const lineHeight = radius * 2.4; // 加长 (1.6 * 1.5 = 2.4)

    const lines = [];

    // 根据数量决定布局
    // 2：和第一根保持直线，直线中点在圆心
    // 3：三根针形成三角形，三角形的中心点在圆心
    // 4：四根针形成正方形，正方形中心点在圆心

    // 由于 SpindleShape 的原点是底部 (0,0)，我们需要调整放置位置
    // 以便视觉中心（针的几何中心，即 -lineHeight/2）位于布局点

    // 用户反馈：希望针的下端点和圆心重合（对于单根针情况）。
    // 这意味着我们不需要将针向下偏移来使其中心对齐，而是直接用底部对齐。
    const yOffset = 0;

    if (object.count === 1) {
        lines.push(
            <SpindleShape
                key={0}
                x={0}
                y={yOffset}
                height={lineHeight}
                width={lineWidth}
                color={style.stroke as string}
            />,
        );
    } else if (object.count === 2) {
        // 直线排列，中点在圆心
        // 间距适当加大
        const spacing = radius * 0.8; // 两个针之间的距离
        const halfSpacing = spacing / 2;

        lines.push(
            <SpindleShape
                key={0}
                x={-halfSpacing}
                y={yOffset}
                height={lineHeight}
                width={lineWidth}
                color={style.stroke as string}
            />,
        );
        lines.push(
            <SpindleShape
                key={1}
                x={halfSpacing}
                y={yOffset}
                height={lineHeight}
                width={lineWidth}
                color={style.stroke as string}
            />,
        );
    } else if (object.count === 3) {
        // 三角形，中心在圆心
        // 半径
        const layoutRadius = radius * 0.5;
        // 角度：-90 (上), 30 (右下), 150 (左下)
        // 或者是：0, 120, 240
        // 通常三角形是正三角，顶点朝上
        const angles = [-90, 30, 150];

        for (let i = 0; i < 3; i++) {
            const angle = angles[i];
            if (angle === undefined) continue;
            const angleRad = (angle * Math.PI) / 180;
            const lx = layoutRadius * Math.cos(angleRad);
            const ly = layoutRadius * Math.sin(angleRad);
            lines.push(
                <SpindleShape
                    key={i}
                    x={lx}
                    y={ly + yOffset}
                    height={lineHeight}
                    width={lineWidth}
                    color={style.stroke as string}
                />,
            );
        }
    } else if (object.count === 4) {
        // 正方形，中心在圆心
        // 4个点：左上，右上，右下，左下
        // 半径
        const layoutRadius = radius * 0.5;
        // 角度：-135, -45, 45, 135 (从左上开始顺时针)
        // 顺时针旋转15度：-120, -30, 60, 150
        const angles = [-120, -30, 60, 150];

        for (let i = 0; i < 4; i++) {
            const angle = angles[i];
            if (angle === undefined) continue;
            const angleRad = (angle * Math.PI) / 180;
            const lx = layoutRadius * Math.cos(angleRad);
            const ly = layoutRadius * Math.sin(angleRad);
            lines.push(
                <SpindleShape
                    key={i}
                    x={lx}
                    y={ly + yOffset}
                    height={lineHeight}
                    width={lineWidth}
                    color={style.stroke as string}
                />,
            );
        }
    } else {
        // 5个及以上，沿圆周排列或直线排列？
        // 默认回退到直线排列
        const lineSpacing = 12;
        const totalWidth = object.count * lineWidth + (object.count - 1) * lineSpacing;
        const startX = -totalWidth / 2 + lineWidth / 2;

        for (let i = 0; i < object.count; i++) {
            lines.push(
                <SpindleShape
                    key={i}
                    x={startX + i * (lineWidth + lineSpacing)}
                    y={yOffset}
                    height={lineHeight}
                    width={lineWidth}
                    color={style.stroke as string}
                />,
            );
        }
    }

    return (
        <>
            {highlightProps && <Circle radius={radius + style.strokeWidth / 2} {...highlightProps} />}

            <HideGroup>
                {/* 背景渐变圆 - 由外向内渐变 */}
                <Circle
                    radius={radius}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={radius} // 外圈
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndRadius={0} // 内圈
                    fillRadialGradientColorStops={[0, object.color, 1, 'transparent']} // 0是startRadius(外), 1是endRadius(内)
                    opacity={object.opacity}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    dash={style.dash}
                />

                {/* 玩家数量指示（渐变竖线） */}
                {lines}

                {isDragging && <Circle radius={CENTER_DOT_RADIUS} fill={style.stroke} />}
            </HideGroup>
        </>
    );
};

const TowerContainer: React.FC<RendererProps<TowerZoneZXSJ>> = ({ object }) => {
    return (
        <RadiusObjectContainer object={object}>
            {(props) => <TowerRenderer object={object} {...props} />}
        </RadiusObjectContainer>
    );
};

registerRenderer<TowerZoneZXSJ>(ObjectType.TowerZXSJ, LayerName.Ground, TowerContainer);

const TowerDetails: React.FC<ListComponentProps<TowerZoneZXSJ>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: object.color }} />}
            name={t('objects.towerZXSJ', { defaultValue: 'Tower (ZXSJ)' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<TowerZoneZXSJ>(ObjectType.TowerZXSJ, TowerDetails);
