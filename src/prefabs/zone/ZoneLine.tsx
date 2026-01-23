import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Group, Rect } from 'react-konva';
import Icon from '../../assets/zone/line.svg?react';
import { getPointerAngle, snapAngle } from '../../coord';
import { getResizeCursor } from '../../cursor';
import { getDragOffset, registerDropHandler } from '../../DropHandler';
import { rotateGroupObjects } from '../../groupOperations';
import AoeRect from '../../lib/aoe/AoeRect';
import { DetailsItem } from '../../panel/DetailsItem';
import { ListComponentProps, registerListComponent } from '../../panel/ListComponentRegistry';
import { LayerName } from '../../render/layers';
import { registerRenderer, RendererProps } from '../../render/ObjectRegistry';
import { ActivePortal } from '../../render/Portals';
import { LineZone, ObjectType } from '../../scene';
import { useScene } from '../../SceneProvider';
import { useIsDragging } from '../../selection';
import { CENTER_DOT_RADIUS, DEFAULT_AOE_COLOR, DEFAULT_AOE_OPACITY, panelVars } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { distance, getDistanceFromLine, VEC_ZERO, vecAtAngle } from '../../vector';
import { MIN_LINE_LENGTH, MIN_LINE_WIDTH } from '../bounds';
import { CONTROL_POINT_BORDER_COLOR, createControlPointManager, HandleFuncProps, HandleStyle } from '../ControlPoint';
import { DraggableObject } from '../DraggableObject';
import { HideGroup } from '../HideGroup';
import { useHighlightProps, useShowResizer } from '../highlight';
import { PrefabIcon } from '../PrefabIcon';
import { getZoneStyle } from './style';

const DEFAULT_WIDTH = 100;
const DEFAULT_LENGTH = 250;

const ICON_SIZE = 32;

export const ZoneLine: React.FC = () => {
    const [, setDragObject] = usePanelDrag();
    const { t } = useTranslation();
    return (
        <PrefabIcon
            draggable
            name={t('objects.line', { defaultValue: 'Line' })}
            icon={<Icon />}
            onDragStart={(e) => {
                const offset = getDragOffset(e);
                setDragObject({
                    object: {
                        type: ObjectType.Line,
                    },
                    offset: {
                        x: offset.x,
                        y: offset.y - ICON_SIZE / 2,
                    },
                });
            }}
        />
    );
};

registerDropHandler<LineZone>(ObjectType.Line, (object, position) => {
    return {
        type: 'add',
        object: {
            type: ObjectType.Cone,
            color: DEFAULT_AOE_COLOR,
            opacity: DEFAULT_AOE_OPACITY,
            width: DEFAULT_WIDTH,
            length: DEFAULT_LENGTH,
            rotation: 0,
            native: false,
            ...object,
            ...position,
        },
    };
});

const LineDetails: React.FC<ListComponentProps<LineZone>> = ({ object, ...props }) => {
    const { t } = useTranslation();
    // 缩略图颜色：
    // - 朴素样式使用 object.color
    // - 原生样式使用 object.baseColor（若未设置则回退到 DEFAULT_AOE_COLOR）
    const isNative = object.native ?? true;
    const displayColor = isNative ? (object.baseColor ?? DEFAULT_AOE_COLOR) : object.color;
    return (
        <DetailsItem
            icon={<Icon width="100%" height="100%" style={{ [panelVars.colorZoneOrange]: displayColor }} />}
            name={t('objects.line', { defaultValue: 'Line' })}
            object={object}
            {...props}
        />
    );
};

registerListComponent<LineZone>(ObjectType.Line, LineDetails);

enum HandleId {
    Length,
    Width,
}

interface LineState {
    length: number;
    width: number;
    rotation: number;
}

const ROTATE_SNAP_DIVISION = 15;
const ROTATE_SNAP_TOLERANCE = 2;

const OUTSET = 2;

function getLength(object: LineZone, { pointerPos, activeHandleId }: HandleFuncProps) {
    if (pointerPos && activeHandleId === HandleId.Length) {
        return Math.max(MIN_LINE_LENGTH, Math.round(distance(pointerPos) - OUTSET));
    }

    return object.length;
}

function getRotation(object: LineZone, { pointerPos, activeHandleId }: HandleFuncProps) {
    if (pointerPos && activeHandleId === HandleId.Length) {
        const angle = getPointerAngle(pointerPos);
        return snapAngle(angle, ROTATE_SNAP_DIVISION, ROTATE_SNAP_TOLERANCE);
    }

    return object.rotation;
}

function getWidth(object: LineZone, { pointerPos, activeHandleId }: HandleFuncProps) {
    if (pointerPos && activeHandleId == HandleId.Width) {
        const start = VEC_ZERO;
        const end = vecAtAngle(object.rotation);
        const distance = getDistanceFromLine(start, end, pointerPos);

        return Math.max(MIN_LINE_WIDTH, Math.round(distance * 2));
    }

    return object.width;
}

const LineControlPoints = createControlPointManager<LineZone, LineState>({
    handleFunc: (object, handle) => {
        const length = getLength(object, handle) + OUTSET;
        const width = getWidth(object, handle);
        const rotation = getRotation(object, handle);

        const x = width / 2;
        const y = -length / 2;

        return [
            { id: HandleId.Length, style: HandleStyle.Square, cursor: getResizeCursor(rotation), x: 0, y: -length },
            { id: HandleId.Width, style: HandleStyle.Diamond, cursor: getResizeCursor(rotation + 90), x: x, y: y },
            { id: HandleId.Width, style: HandleStyle.Diamond, cursor: getResizeCursor(rotation + 90), x: -x, y: y },
        ];
    },
    getRotation: getRotation,
    stateFunc: (object, handle) => {
        const length = getLength(object, handle);
        const width = getWidth(object, handle);
        const rotation = getRotation(object, handle);

        return { length, width, rotation };
    },
    onRenderBorder: (object, state) => {
        const strokeWidth = 1;
        const width = state.width + strokeWidth * 2;
        const length = state.length + strokeWidth * 2;

        return (
            <>
                <Rect
                    x={-width / 2}
                    y={-length + strokeWidth}
                    width={width}
                    height={length}
                    stroke={CONTROL_POINT_BORDER_COLOR}
                    strokeWidth={strokeWidth}
                    fillEnabled={false}
                />
                <Circle radius={CENTER_DOT_RADIUS} fill={CONTROL_POINT_BORDER_COLOR} />
            </>
        );
    },
});

interface LineRendererProps extends RendererProps<LineZone> {
    length: number;
    width: number;
    rotation: number;
    isDragging?: boolean;
    isResizing?: boolean;
    scene: any;
}

const LineRenderer: React.FC<LineRendererProps> = ({
    object,
    length,
    width,
    rotation,
    isDragging,
    isResizing,
    scene,
}) => {
    // 使用可选链操作符和空值合并操作符，安全地获取场地宽度
    const arenaWidth = scene?.arena?.width ?? 999;
    const highlightProps = useHighlightProps(object);

    // 若 object 没有 native 字段，说明是原版数据，则：
    //   - 如果是空心，则不应用原生样式，以兼容原版数据
    //   - 否则如果是实心，则应用原生样式
    const isNative = object.native ?? object.hollow !== true;
    const isHollow = !isNative && (object.hollow ?? false);
    const isInverted = object.inverted ?? false;

    const style = getZoneStyle(object.color, object.opacity, Math.min(length, width), isHollow);
    const nativeStyle = {
        globalOpacity: object.globalOpacity,
        baseColor: object.baseColor,
        baseOpacity: object.baseOpacity,
        innerGlowColor: object.innerGlowColor,
        innerGlowOpacity: object.innerGlowOpacity,
        outlineColor: object.outlineColor,
        outlineOpacity: object.outlineOpacity,
    };

    // 确定高亮区域的参数
    const highlightOffset = style.strokeWidth;
    const highlightWidth = width + highlightOffset;
    const highlightLength = length + highlightOffset;
    const x = -width / 2;
    const y = -length;

    // 创建一个足够大的画布尺寸作为两侧区域的
    return (
        <Group rotation={rotation}>
            {highlightProps && (
                <Rect
                    x={x}
                    y={y}
                    width={highlightWidth}
                    height={highlightLength}
                    offsetX={highlightOffset / 2}
                    offsetY={highlightOffset / 2}
                    {...highlightProps}
                />
            )}
            <HideGroup>
                {isInverted ? (
                    // 反转模式：渲染两侧区域（除了直线范围外的部分）
                    isNative ? (
                        // 对于原生样式，只渲染左右两侧
                        <>
                            {/* 左侧区域 - 精确定位在中心线左侧 */}
                            <AoeRect
                                offsetX={-width / 2 - 1}
                                offsetY={length + 1.5}
                                width={arenaWidth * 1.5 - width / 2}
                                height={length + 3}
                                freeze={isResizing}
                                {...nativeStyle}
                            />
                            {/* 右侧区域 - 精确定位在中心线右侧 */}
                            <AoeRect
                                offsetX={arenaWidth * 1.5}
                                offsetY={length + 1.5}
                                width={arenaWidth * 1.5 - width / 2}
                                height={length + 3}
                                freeze={isResizing}
                                {...nativeStyle}
                            />
                        </>
                    ) : (
                        // 对于普通样式，只渲染左右两侧
                        <>
                            {/* 左侧区域 - 精确定位在中心线左侧 */}
                            <Rect x={width / 2 + 2} y={-length} width={9999 - width / 2} height={length} {...style} />
                            {/* 右侧区域 - 精确定位在中心线右侧 */}
                            <Rect x={-9999 - 2} y={-length} width={9999 - width / 2} height={length} {...style} />
                        </>
                    )
                ) : // 正常模式：渲染直线范围
                isNative ? (
                    <AoeRect
                        offsetX={-x}
                        offsetY={-y}
                        width={width}
                        height={length}
                        freeze={isResizing}
                        {...nativeStyle}
                    />
                ) : (
                    <Rect x={x} y={y} width={width} height={length} {...style} />
                )}

                {isDragging && <Circle radius={CENTER_DOT_RADIUS} fill={style.stroke} />}
            </HideGroup>
        </Group>
    );
};

function stateChanged(object: LineZone, state: LineState) {
    return state.length !== object.length || state.rotation !== object.rotation || state.width !== object.width;
}

const LineContainer: React.FC<RendererProps<LineZone>> = ({ object }) => {
    const { scene, step, dispatch } = useScene();
    const showResizer = useShowResizer(object);
    const [resizing, setResizing] = useState(false);
    const dragging = useIsDragging(object);

    const handleTransformStart = () => {
        // 旋转开始，记录初始状态到撤销栈
        if (object.groupId) {
            const rotatedObjects = rotateGroupObjects(step.objects, [object], object.rotation);
            dispatch({ type: 'update', value: rotatedObjects, transient: false });
        }
    };

    const updateObject = (state: LineState, transient = false) => {
        state.rotation = Math.round(state.rotation);
        state.width = Math.round(state.width);

        if (!stateChanged(object, state)) {
            return;
        }

        // 如果是旋转操作且对象在组中，同步旋转同组的所有对象
        if (state.rotation !== object.rotation && object.groupId) {
            const updatedObjects = rotateGroupObjects(step.objects, [object], state.rotation);
            dispatch({ type: 'update', value: updatedObjects, transient });
        } else {
            dispatch({ type: 'update', value: { ...object, ...state }, transient });
        }
    };

    const handleTransformMove = (state: LineState) => {
        updateObject(state, true);
    };

    const handleTransformEnd = (state: LineState) => {
        updateObject(state, false);
    };

    return (
        <ActivePortal isActive={dragging || resizing}>
            <DraggableObject object={object}>
                <LineControlPoints
                    object={object}
                    onActive={setResizing}
                    visible={showResizer && !dragging}
                    onTransformStart={handleTransformStart}
                    onTransformMove={handleTransformMove}
                    onTransformEnd={handleTransformEnd}
                >
                    {(props) => (
                        <LineRenderer
                            object={object}
                            isDragging={dragging || resizing}
                            isResizing={resizing}
                            scene={scene}
                            {...props}
                        />
                    )}
                </LineControlPoints>
            </DraggableObject>
        </ActivePortal>
    );
};

registerRenderer<LineZone>(ObjectType.Line, LayerName.Ground, LineContainer);
