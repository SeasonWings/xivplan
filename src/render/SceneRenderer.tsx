import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import React, { PropsWithChildren, RefAttributes, useContext, useState } from 'react';
import { Layer, Stage } from 'react-konva';
import { useAnimation } from '../animation/AnimationContext';
import { DefaultCursorProvider } from '../DefaultCursorProvider';
import { getDropAction } from '../DropHandler';
import { useEditActivity } from '../EditActivityContext';
import { SceneHotkeyHandler } from '../HotkeyHandler';
import { EditorState, SceneAction, SceneContext, useScene } from '../SceneProvider';
import { SelectionContext, SelectionState, SpotlightContext } from '../SelectionContext';
import { useCollaboration } from '../collaboration/CollaborationProvider';
import { getCanvasSize, getSceneCoord } from '../coord';
import { Scene } from '../scene';
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
    const { scene } = useScene();
    const [, setSelection] = useContext(SelectionContext);
    const size = getCanvasSize(scene);
    const [stage, stageRef] = useState<Konva.Stage | null>(null);
    const { startEditActivity, endEditActivity } = useEditActivity();
    const [lastUpdateTime, setLastUpdateTime] = useState(0);

    // 使用协作上下文获取用户权限信息
    const collaboration = useCollaboration();
    const hasEditPermission =
        collaboration?.isHost ||
        collaboration?.connectedUsers?.find((user) => user.id === collaboration.userId)?.canEdit ||
        false;

    const onClickStage = (e: KonvaEventObject<MouseEvent>) => {
        // Clicking on nothing (with no modifier keys held) should cancel selection.
        if (!e.evt.ctrlKey && !e.evt.shiftKey) {
            setSelection(selectNone());
        }
    };

    const onMouseMoveStage = () => {
        if (!hasEditPermission) return;

        const now = Date.now();
        // 每50ms更新一次画布
        if (now - lastUpdateTime >= 200) {
            startEditActivity(); // 标记开始编辑活动，确保触发场景更新
            setLastUpdateTime(now);
        }
    };

    // 重置计时当鼠标离开画布
    const onMouseLeaveStage = () => {
        setLastUpdateTime(0);
        endEditActivity(); // 标记结束编辑活动
    };

    return (
        <DropTarget stage={stage}>
            <Stage
                {...size}
                ref={stageRef}
                onClick={onClickStage}
                onMouseMove={onMouseMoveStage}
                onMouseLeave={onMouseLeaveStage}
            >
                <StageContext value={stage}>
                    <DefaultCursorProvider>
                        <SceneContents />
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
}

const SceneContents: React.FC<SceneContentsProps> = ({ listening, simple, backgroundColor }) => {
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
            <Layer name={LayerName.Controls} listening={listening} />
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
