import { KonvaEventObject } from 'konva/lib/Node';
import React, { Dispatch, ReactNode } from 'react';
import { getCanvasCoord, getSceneCoord } from '../coord';
import { CursorGroup } from '../CursorGroup';
import { EditMode } from '../editMode';
import { moveObjectsBy } from '../groupOperations';
import { MoveableObject, Scene, SceneStep, UnknownObject } from '../scene';
import { SceneAction, useScene } from '../SceneProvider';
import {
    getNewDragSelection,
    getSelectedObjects,
    selectNone,
    selectSingle,
    useDragSelection,
    useSelection,
} from '../selection';
import { SceneSelection } from '../SelectionContext';
import { useEditMode } from '../useEditMode';
import { vecSub } from '../vector';
import { SelectableObject } from './SelectableObject';
import { TetherTarget } from './TetherTarget';
import { useEditActivity } from '../EditActivityContext';
import { useAnimation } from '../animation/AnimationContext';

export interface DraggableObjectProps {
    object: MoveableObject & UnknownObject;
    children?: ReactNode;
}

export const DraggableObject: React.FC<DraggableObjectProps> = ({ object, children }) => {
    const [editMode] = useEditMode();
    const { scene, step, dispatch } = useScene();
    const [selection, setSelection] = useSelection();
    const [dragSelection, setDragSelection] = useDragSelection();
    const { startEditActivity, endEditActivity } = useEditActivity();
    const { animation, playerState, startRecordingTrajectory, recordTrajectoryPoint, endRecordingTrajectory } =
        useAnimation();
    const center = getCanvasCoord(scene, object);

    const isDraggable = !object.pinned && editMode === EditMode.Normal;

    // 判断是否在关键帧之间
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const isInKeyframeInterval = React.useMemo(() => {
        if (!animation || !animation.keyframes || animation.keyframes.length < 2) {
            return null;
        }

        const currentTime = playerState.currentTime;
        for (let i = 0; i < animation.keyframes.length - 1; i++) {
            const kf1 = animation.keyframes[i];
            const kf2 = animation.keyframes[i + 1];
            if (currentTime >= kf1.time && currentTime <= kf2.time) {
                return { startTime: kf1.time, endTime: kf2.time };
            }
        }
        return null;
    }, [animation, playerState.currentTime]);

    const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
        let newSelection: SceneSelection;

        // If we start dragging an object that isn't selected, it should
        // become the new selection.
        if (!selection.has(object.id)) {
            newSelection = selectSingle(object.id);
            setSelection(newSelection);
        } else {
            newSelection = getNewDragSelection(step, selection);
        }

        setDragSelection(newSelection);
        startEditActivity(); // 标记开始编辑活动

        // 如果在关键帧之间，开始记录轨迹
        if (isInKeyframeInterval) {
            startRecordingTrajectory(object.id, isInKeyframeInterval.startTime, isInKeyframeInterval.endTime);
            // 记录起始点
            recordTrajectoryPoint(object.id, object.x, object.y, Date.now());
        }

        updatePosition(scene, step, object, newSelection, e, dispatch);
    };

    const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
        // 如果在关键帧之间，记录轨迹点
        if (isInKeyframeInterval) {
            const pos = getSceneCoord(scene, e.target.position());
            recordTrajectoryPoint(object.id, pos.x, pos.y, Date.now());
        }

        updatePosition(scene, step, object, dragSelection, e, dispatch);
    };

    const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
        // 如果在关键帧之间，记录最后一点并结束记录
        if (isInKeyframeInterval) {
            const pos = getSceneCoord(scene, e.target.position());
            recordTrajectoryPoint(object.id, pos.x, pos.y, Date.now());
            endRecordingTrajectory(object.id);
        }

        updatePosition(scene, step, object, dragSelection, e, dispatch);
        dispatch({ type: 'commit' });

        setDragSelection(selectNone());
        endEditActivity(); // 标记结束编辑活动
    };

    // TODO: Konva moves the shape immediately before calling the dragMove event,
    // so the object being dragged is always one frame ahead of the rest of the
    // state. Is there any way to delay the render until the event is handled,
    // or do we need to implement our own drag logic to replace Konva's?
    return (
        <SelectableObject object={object}>
            <TetherTarget object={object}>
                <CursorGroup
                    {...center}
                    cursor={isDraggable ? 'move' : undefined}
                    draggable={isDraggable}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                >
                    {children}
                </CursorGroup>
            </TetherTarget>
        </SelectableObject>
    );
};

function updatePosition(
    scene: Scene,
    step: SceneStep,
    targetObject: MoveableObject & UnknownObject,
    dragSelection: SceneSelection,
    e: KonvaEventObject<DragEvent>,
    dispatch: Dispatch<SceneAction>,
) {
    // Konva automatically moves the object to e.target.position() in canvas
    // coordinates. Subtracting the object's original position gives the offset
    // that needs to be applied to all objects being dragged.
    const pos = getSceneCoord(scene, e.target.position());
    const offset = vecSub(pos, targetObject);

    if (offset.x === 0 && offset.y === 0) {
        return;
    }

    // 获取正在拖动的对象
    let draggedObjects = getSelectedObjects(step, dragSelection);

    // 如果目标对象有groupId，将同组的所有对象也加入拖动列表
    if (targetObject.groupId) {
        const groupMembers = step.objects.filter(
            (obj): obj is MoveableObject & UnknownObject =>
                'groupId' in obj && obj.groupId === targetObject.groupId && 'x' in obj && 'y' in obj,
        );

        // 合并拖动对象和组成员，去重
        const allObjects = new Map<number, MoveableObject & UnknownObject>();
        draggedObjects.forEach((obj) => {
            if ('x' in obj && 'y' in obj) {
                allObjects.set(obj.id, obj as MoveableObject & UnknownObject);
            }
        });
        groupMembers.forEach((obj) => allObjects.set(obj.id, obj));

        draggedObjects = Array.from(allObjects.values());
    }

    const value = moveObjectsBy(draggedObjects, offset);

    dispatch({ type: 'update', value, transient: true });
}
