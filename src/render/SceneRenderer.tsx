import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import React, { PropsWithChildren, RefAttributes, useContext, useRef, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { useAnimation } from '../animation/AnimationContext';
import { DefaultCursorProvider } from '../DefaultCursorProvider';
import { getDropAction } from '../DropHandler';
import { useEditActivity } from '../EditActivityContext';
import { SceneHotkeyHandler } from '../HotkeyHandler';
import { EditorState, SceneAction, SceneContext, useScene } from '../SceneProvider';
import { SelectionContext, SelectionState, SpotlightContext } from '../SelectionContext';
import { useCollaboration } from '../collaboration/CollaborationProvider';
import { getCanvasSize, getSceneCoord, getCanvasCoord } from '../coord';
import { Scene, isMoveable } from '../scene';
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

    // 使用协作上下文获取用户权限信息
    const collaboration = useCollaboration();
    const hasEditPermission =
        collaboration?.isHost ||
        collaboration?.connectedUsers?.find((user) => user.id === collaboration.userId)?.canEdit ||
        false;

    const onClickStage = (e: KonvaEventObject<MouseEvent>) => {
        // 如果正在框选，不处理点击事件
        if (isSelecting || hasMovedRef.current) {
            return;
        }

        // Clicking on nothing (with no modifier keys held) should cancel selection.
        if (!e.evt.ctrlKey && !e.evt.shiftKey) {
            setSelection(selectNone());
        }
    };

    const onMouseDownStage = (e: KonvaEventObject<MouseEvent>) => {
        // 只处理左键
        if (e.evt.button !== 0) return;

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
                }, 50);
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
                            <SceneContents listening={false} simple={simple} backgroundColor={backgroundColor} />
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
}

const SceneContents: React.FC<SceneContentsProps> = ({ listening, simple, backgroundColor, selectionBox }) => {
    listening = listening ?? true;

    const { getAnimatedObjects } = useAnimation();

    // 如果有动画正在播放，使用动画后的对象，否则使用原始对象
    const objects = getAnimatedObjects();

    return (
        <>
            {listening && <SceneHotkeyHandler />}

            <Layer name={LayerName.Ground} listening={listening}>
                <ArenaRenderer backgroundColor={backgroundColor} simple={simple} />
                <ObjectRenderer objects={objects} layer={LayerName.Ground} />
            </Layer>
            <Layer name={LayerName.Default} listening={listening}>
                <ObjectRenderer objects={objects} layer={LayerName.Default} />
            </Layer>
            <Layer name={LayerName.Foreground} listening={listening}>
                <ObjectRenderer objects={objects} layer={LayerName.Foreground} />

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
