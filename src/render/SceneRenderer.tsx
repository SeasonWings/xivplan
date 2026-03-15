import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import React, { PropsWithChildren, RefAttributes, useContext, useRef, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { CanvasCursorController } from '../CanvasCursorController';
import { DefaultCursorProvider } from '../DefaultCursorProvider';
import { getDropAction } from '../DropHandler';
import { useEditActivity } from '../EditActivityContext';
import { SceneHotkeyHandler } from '../HotkeyHandler';
import { EditorState, SceneAction, SceneContext, useScene } from '../SceneProvider';
import { SelectionContext, SelectionState, SpotlightContext } from '../SelectionContext';
import { useAnimation } from '../animation/AnimationContext';
import { useAnimationV2 } from '../animation/AnimationV2Context';
import { useVisualEdit } from '../animation/VisualEditContext';
import { useCollaboration } from '../collaboration/CollaborationProvider';
import { CursorSyncLayer } from '../collaboration/cursor/CursorSyncLayer';
import { getCanvasCoord, getCanvasSize, getSceneCoord } from '../coord';
import { CANVAS_CROSSHAIR_CURSOR } from '../cursorIcon';
import { isMoveable, Scene, SceneObject } from '../scene';
import { selectNewObjects, selectNone, useSelection } from '../selection';
import { UndoContext } from '../undo/undoContext';
import { usePanelDrag } from '../usePanelDrag';
import { ArenaRenderer } from './ArenaRenderer';
import { DrawTarget } from './DrawTarget';
import { ObjectRenderer } from './ObjectRenderer';
import { StageContext } from './StageContext';
import { TetherEditRenderer } from './TetherEditRenderer';
import { LayerName } from './layers';

export const SceneRenderer: React.FC = () => {
    const { scene, step } = useScene();
    const [, setSelection] = useContext(SelectionContext);
    const size = getCanvasSize(scene);
    const [stage, stageRef] = useState<Konva.Stage | null>(null);
    const { startEditActivity, endEditActivity } = useEditActivity();
    const [lastUpdateTime, setLastUpdateTime] = useState(0);

    // 框选相关状态
    const [isSelecting, setIsSelecting] = useState(false);
    const isSelectingRef = useRef(false);
    const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasMovedRef = useRef(false);
    const { pickCallback, setLastPickedPoint } = useVisualEdit();

    // 使用协作上下文获取用户权限信息
    const collaboration = useCollaboration();
    const hasEditPermission =
        collaboration?.isHost ||
        collaboration?.connectedUsers?.find((user) => user.id === collaboration.userId)?.canEdit ||
        false;

    const onClickStage = (e: KonvaEventObject<MouseEvent>) => {
        if (pickCallback) {
            const stageInstance = e.target.getStage();
            const pos = stageInstance?.getPointerPosition();
            if (stageInstance && pos) {
                const scenePos = getSceneCoord(scene, pos);
                setLastPickedPoint({ x: scenePos.x, y: scenePos.y });
                pickCallback({ x: scenePos.x, y: scenePos.y });
            }
            return;
        }

        if (isSelecting || hasMovedRef.current) {
            return;
        }

        if (!e.evt.ctrlKey && !e.evt.shiftKey) {
            setSelection(selectNone());
        }
    };

    const onMouseDownStage = (e: KonvaEventObject<MouseEvent>) => {
        // 只处理左键
        if (e.evt.button !== 0) return;

        // 检查鼠标光标样式，禁止在拖拽或拉伸操作时触发框选
        const container = stage?.container();
        if (container) {
            const cursor = container.style.cursor;
            // 拖拽样式：move
            // 拉伸样式：ns-resize, ew-resize, nesw-resize, nwse-resize
            const isInteracting = cursor === 'move' || cursor.endsWith('-resize') || cursor === CANVAS_CROSSHAIR_CURSOR;
            if (isInteracting) {
                return;
            }
        }

        // 如果点击的是舞台背景（不是对象），开始长按计时
        const targetName = e.target.name();
        const isBackground = !targetName || targetName === '' || e.target === e.target.getStage();

        if (isBackground) {
            const pos = e.target.getStage()?.getPointerPosition();
            if (pos) {
                hasMovedRef.current = false;
                selectionStartRef.current = pos;

                // 设置长按延迟
                longPressTimerRef.current = setTimeout(() => {
                    setIsSelecting(true);
                    isSelectingRef.current = true;
                    setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
                }, 0);
            }
        }
    };

    const onMouseMoveStage = (e: KonvaEventObject<MouseEvent>) => {
        // 框选功能的处理
        // 如果正在框选，更新框选区域
        if (isSelectingRef.current && selectionStartRef.current) {
            const pos = e.target.getStage()?.getPointerPosition();
            if (pos) {
                const x = Math.min(selectionStartRef.current.x, pos.x);
                const y = Math.min(selectionStartRef.current.y, pos.y);
                const width = Math.abs(pos.x - selectionStartRef.current.x);
                const height = Math.abs(pos.y - selectionStartRef.current.y);
                setSelectionBox({ x, y, width, height });
            }
        }

        // 如果鼠标移动了，取消长按计时
        if (selectionStartRef.current && !isSelectingRef.current) {
            const pos = e.target.getStage()?.getPointerPosition();
            if (pos) {
                const moved =
                    Math.abs(pos.x - selectionStartRef.current.x) > 10 ||
                    Math.abs(pos.y - selectionStartRef.current.y) > 10;
                if (moved) {
                    hasMovedRef.current = true;
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                    }
                }
            }
        }

        // 编辑活动标记（仅在有编辑权限时）
        if (!hasEditPermission) return;

        const now = Date.now();
        // 每50ms更新一次画布
        if (now - lastUpdateTime >= 200) {
            startEditActivity(); // 标记开始编辑活动，确保触发场景更新
            setLastUpdateTime(now);
        }
    };

    const onMouseUpStage = () => {
        // 清除长按计时器
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // 如果正在框选，完成框选并选中区域内的对象
        if (isSelecting && stage && step) {
            const selectedIds = new Set<number>();
            const box = selectionBox;

            // 遍历所有对象，通过位置匹配
            step.objects.forEach((obj) => {
                // 只处理可移动的对象（有 x, y 属性）
                if (!isMoveable(obj)) {
                    return;
                }

                // 将对象的场景坐标转换为画布坐标
                const canvasPos = getCanvasCoord(scene, { x: obj.x, y: obj.y });

                // 检查对象是否在框选区域内
                const objInBox =
                    canvasPos.x >= box.x &&
                    canvasPos.x <= box.x + box.width &&
                    canvasPos.y >= box.y &&
                    canvasPos.y <= box.y + box.height;

                if (objInBox) {
                    selectedIds.add(obj.id);
                }
            });

            setSelection(selectedIds);
            setIsSelecting(false);
            isSelectingRef.current = false;
            setSelectionBox({ x: 0, y: 0, width: 0, height: 0 });
        }

        selectionStartRef.current = null;
        hasMovedRef.current = false;
    };

    // 重置计时当鼠标离开画布
    const onMouseLeaveStage = () => {
        setLastUpdateTime(0);
        endEditActivity(); // 标记结束编辑活动

        // 清除框选状态
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        setIsSelecting(false);
        isSelectingRef.current = false;
        selectionStartRef.current = null;
        hasMovedRef.current = false;
    };

    return (
        <DropTarget stage={stage}>
            <Stage
                {...size}
                ref={stageRef}
                onClick={onClickStage}
                onMouseDown={onMouseDownStage}
                onMouseMove={onMouseMoveStage}
                onMouseUp={onMouseUpStage}
                onMouseLeave={onMouseLeaveStage}
            >
                <StageContext value={stage}>
                    <DefaultCursorProvider>
                        <CanvasCursorController />
                        <SceneContents selectionBox={isSelecting ? selectionBox : null} />
                    </DefaultCursorProvider>
                </StageContext>
            </Stage>
        </DropTarget>
    );
};

export interface ScenePreviewProps extends RefAttributes<Konva.Stage> {
    scene: Scene;
    stepIndex?: number;
    width?: number;
    height?: number;
    backgroundColor?: string;
    /** Do not draw complex objects that may slow down rendering. Useful for small previews. */
    simple?: boolean;
}

export const ScenePreview: React.FC<ScenePreviewProps> = ({
    ref,
    scene,
    stepIndex,
    width,
    height,
    backgroundColor,
    simple,
}) => {
    const size = getCanvasSize(scene);
    let scale = 1;
    let x = 0;
    let y = 0;

    if (width) {
        scale = Math.min(scale, width / size.width);
    }
    if (height) {
        scale = Math.min(scale, height / size.height);
    }

    size.width *= scale;
    size.height *= scale;

    if (width) {
        x = (width - size.width) / 2;
    }
    if (height) {
        y = (height - size.height) / 2;
    }

    const present: EditorState = {
        scene,
        currentStep: stepIndex ?? 0,
    };

    const sceneContext: UndoContext<EditorState, SceneAction> = [
        {
            present,
            transientPresent: present,
            past: [],
            future: [],
        },
        () => undefined,
    ];

    const selectionContext: SelectionState = [new Set<number>(), () => {}];
    const spotlightContext: SelectionState = [new Set<number>(), () => {}];

    return (
        <Stage ref={ref} x={x} y={y} width={width} height={height} scaleX={scale} scaleY={scale}>
            <DefaultCursorProvider>
                <SceneContext value={sceneContext}>
                    <SelectionContext value={selectionContext}>
                        <SpotlightContext value={spotlightContext}>
                            <SceneContents
                                listening={false}
                                simple={simple}
                                backgroundColor={backgroundColor}
                                objects={
                                    stepIndex !== undefined ? scene.steps[stepIndex]?.objects : scene.steps[0]?.objects
                                }
                            />
                        </SpotlightContext>
                    </SelectionContext>
                </SceneContext>
            </DefaultCursorProvider>
        </Stage>
    );
};

interface SceneContentsProps {
    listening?: boolean;
    simple?: boolean;
    backgroundColor?: string;
    selectionBox?: { x: number; y: number; width: number; height: number } | null;
    // 添加可选的objects属性，用于预览场景时直接使用传入的对象
    objects?: readonly SceneObject[];
}

const SceneContents: React.FC<SceneContentsProps> = ({
    listening,
    simple,
    backgroundColor,
    selectionBox,
    objects: propObjects,
}) => {
    listening = listening ?? true;

    const { animatedObjects: legacyAnimatedObjects } = useAnimation();

    // 安全地使用 useAnimationV2，如果不在 Provider 内部则使用默认值
    let v2AnimatedObjects: readonly SceneObject[] = [];
    let v2PlayerState: { state: 'stopped' | 'playing' | 'paused' } = { state: 'stopped' };

    try {
        const v2Context = useAnimationV2();
        v2AnimatedObjects = v2Context.animatedObjects;
        v2PlayerState = v2Context.playerState;
    } catch {
        // 如果 useAnimationV2 抛出错误（不在 Provider 内部），使用默认值
        console.warn('AnimationV2Provider not found, using default animation state');
    }

    const { isVisualEditing, editingObjectId } = useVisualEdit();

    // 优先使用 V2 动画系统的对象（如果正在播放），否则使用传入的对象或旧版动画对象
    let objects: readonly SceneObject[];
    if (propObjects !== undefined) {
        objects = propObjects;
    } else if (v2PlayerState.state !== 'stopped') {
        // V2 动画正在播放
        objects = v2AnimatedObjects;
    } else {
        // 使用旧版动画或默认状态
        objects = legacyAnimatedObjects;
    }

    // 如果处于可视化编辑模式
    if (isVisualEditing && editingObjectId !== null) {
        const editingObj = objects.find((obj) => obj.id === editingObjectId);
        const groupId = (editingObj as (SceneObject & { groupId?: string }) | undefined)?.groupId;

        if (groupId) {
            objects = objects.filter((obj) => (obj as SceneObject & { groupId?: string }).groupId === groupId);
        } else {
            objects = objects.filter((obj) => obj.id === editingObjectId);
        }
    }

    return (
        <>
            {listening && <SceneHotkeyHandler />}

            <Layer name={LayerName.Ground} listening={listening}>
                <ArenaRenderer backgroundColor={backgroundColor} simple={simple} />
            </Layer>

            <UserLayerObjects objects={objects} listening={listening} userLayer="background" />
            <UserLayerObjects objects={objects} listening={listening} userLayer="main" />
            <UserLayerObjects objects={objects} listening={listening} userLayer="foreground" />

            <Layer name={LayerName.Foreground} listening={listening}>
                <TetherEditRenderer />
            </Layer>
            <Layer name={LayerName.Active} listening={listening}>
                <DrawTarget />
            </Layer>
            <Layer name={LayerName.Controls} listening={listening}>
                {/* 框选矩形 */}
                {selectionBox && (
                    <Rect
                        x={selectionBox.x}
                        y={selectionBox.y}
                        width={selectionBox.width}
                        height={selectionBox.height}
                        fill="rgba(0, 123, 255, 0.1)"
                        stroke="#007bff"
                        strokeWidth={2}
                        dash={[5, 5]}
                        listening={false}
                    />
                )}
            </Layer>
            <CursorSyncLayer />
        </>
    );
};

const UserLayerObjects: React.FC<{
    objects: readonly SceneObject[];
    listening: boolean;
    userLayer: 'background' | 'main' | 'foreground';
}> = ({ objects, listening, userLayer }) => {
    const selected = objects.filter((o) => (o.layer ?? 'main') === userLayer);
    return (
        <>
            <Layer listening={listening}>
                <ObjectRenderer objects={selected} layer={LayerName.Ground} />
            </Layer>
            <Layer listening={listening}>
                <ObjectRenderer objects={selected} layer={LayerName.Default} />
            </Layer>
            <Layer listening={listening}>
                <ObjectRenderer objects={selected} layer={LayerName.Foreground} />
            </Layer>
        </>
    );
};

interface DropTargetProps extends PropsWithChildren {
    stage: Konva.Stage | null;
}

const DropTarget: React.FC<DropTargetProps> = ({ stage, children }) => {
    const { scene, dispatch } = useScene();
    const [, setSelection] = useSelection();
    const [dragObject, setDragObject] = usePanelDrag();
    const { startEditActivity } = useEditActivity();

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();

        if (!dragObject || !stage) {
            return;
        }

        setDragObject(null);
        stage.setPointersPositions(e);

        const position = stage.getPointerPosition();
        if (!position) {
            return;
        }

        position.x -= dragObject.offset.x;
        position.y -= dragObject.offset.y;

        const action = getDropAction(dragObject, getSceneCoord(scene, position));
        if (action) {
            startEditActivity(); // 开始编辑活动，确保触发场景更新
            dispatch(action);
            setSelection(selectNewObjects(scene, 1));
        }
    };

    return (
        <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            {children}
        </div>
    );
};
