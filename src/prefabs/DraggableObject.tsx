import { KonvaEventObject } from 'konva/lib/Node';
import React, { Dispatch, ReactNode } from 'react';
import { getCanvasCoord, getSceneCoord } from '../coord';
import { CursorGroup } from '../CursorGroup';
import { useEditActivity } from '../EditActivityContext';
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
    const center = getCanvasCoord(scene, object);

    const isDraggable = !object.pinned && editMode === EditMode.Normal;

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

        updatePosition(scene, step, object, newSelection, e, dispatch);
    };

    const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
        updatePosition(scene, step, object, dragSelection, e, dispatch);
    };

    const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
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
    const pos = getSceneCoord(scene, e.target.position());
    const baseTarget =
        step.objects.find((obj): obj is MoveableObject & UnknownObject => obj.id === targetObject.id) ?? targetObject;
    const offset = vecSub(pos, baseTarget);

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
