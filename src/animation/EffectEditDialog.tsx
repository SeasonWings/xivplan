import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Dropdown,
    Field,
    Input,
    makeStyles,
    Option,
    Switch,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { Add24Regular, ArrowFitInFilled, Copy24Regular, Delete24Regular, Play24Regular } from '@fluentui/react-icons';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isNamed, SceneObject } from '../scene';
import { useScene } from '../SceneProvider';
import { commonValue } from '../util';
import { extractAnimatableProperties } from './animationV2Engine';
import {
    AnimatedObjectProperties,
    AnimationEffectType,
    AnimationKeyframe,
    AnimationTrackItem,
    CurveMoveConfig,
    CurveMoveMode,
    EasingType,
} from './animationV2Types';
import { useVisualEdit } from './VisualEditContext';

// 获取对象的显示名称
function getObjectDisplayName(obj: SceneObject, t: TFunction<'translation'>): string {
    // 优先使用用户自定义名称（所有对象都可能有 name 属性）
    const name = (obj as unknown as Record<string, unknown>).name as string | undefined;
    if (name) {
        return name;
    }

    // 其次检查是否是 NamedObject 并有 defaultNameKey
    if (isNamed(obj)) {
        if (obj.defaultNameKey) {
            return t(obj.defaultNameKey);
        }
    }

    // 如果没有名称，使用翻译键获取元素类型名
    return t(`objects.${obj.type}`, obj.type);
}

function getGroupColor(groupId: string): string {
    let hash = 0;
    for (let i = 0; i < groupId.length; i++) {
        hash = (hash << 5) - hash + groupId.charCodeAt(i);
        hash = hash & hash;
    }

    const hue = Math.abs(hash) % 360;
    const saturation = 65;
    const lightness = 50;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const useStyles = makeStyles({
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        minWidth: '500px',
        maxHeight: '50vh',
        overflowY: 'auto',
    },
    formField: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    row: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        alignItems: 'center',
    },
    label: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    nodesContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        height: '200px',
        flexShrink: 0,
        overflowY: 'auto',
        padding: tokens.spacingVerticalS,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
    },
    nodeItem: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        padding: tokens.spacingVerticalS,
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusSmall,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    nodeTime: {
        minWidth: '80px',
    },
    nodeInfo: {
        flex: 1,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
});

interface EffectEditDialogProps {
    open: boolean;
    trackId: string;
    item?: AnimationTrackItem;
    onClose: () => void;
    onSave: (trackId: string, item: Omit<AnimationTrackItem, 'id'> | AnimationTrackItem) => void;
    onVisualEditStart?: (
        onSave?: () => void,
        onCancel?: () => void,
        objectId?: number,
        objectIds?: readonly number[],
    ) => void; // 进入可视化编辑时通知父组件，并传入对象ID
    onVisualEditEnd?: () => void; // 退出可视化编辑时通知父组件
}

export const EffectEditDialog: React.FC<EffectEditDialogProps> = ({
    open,
    trackId,
    item,
    onClose,
    onSave,
    onVisualEditStart,
    onVisualEditEnd,
}) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { step, dispatch } = useScene();
    const { setPickCallback, setLastPickedPoint } = useVisualEdit();

    // 表单状态
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(item?.objectId ?? null);
    const [selectedObjectIds, setSelectedObjectIds] = useState<number[]>(() => {
        if (item?.objectIds && item.objectIds.length > 0) {
            return [...item.objectIds];
        }
        if (item?.objectId != null) {
            return [item.objectId];
        }
        return [];
    });
    const [curveTargetId, setCurveTargetId] = useState<number | null>(item?.curveTargetId ?? item?.objectId ?? null);
    const [effectType, setEffectType] = useState<AnimationEffectType>(item?.effectType ?? AnimationEffectType.Move);
    const [startTime, setStartTime] = useState(item?.startTime ?? 0);
    const [duration, setDuration] = useState(item?.duration ?? 3000);
    const [easing, setEasing] = useState<EasingType>(item?.easing ?? EasingType.EaseInOut);
    const [effectName, setEffectName] = useState(item?.name ?? '');
    const [loop, setLoop] = useState(item?.loop ?? false); // 新增：循环播放开关
    const [nodes, setNodes] = useState<AnimationKeyframe[]>(item?.keyframes ? [...item.keyframes] : []);
    const [curveConfig, setCurveConfig] = useState<CurveMoveConfig | null>(
        item?.effectType === AnimationEffectType.CurveMove && item.curveConfig ? item.curveConfig : null,
    );
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(item?.groupId ?? null);
    const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>(() => {
        if (item?.groupId) {
            return [`group:${item.groupId}`];
        }
        if (item?.objectIds && item.objectIds.length > 0) {
            return item.objectIds.map((id) => `obj:${id}`);
        }
        if (item?.objectId != null) {
            return [`obj:${item.objectId}`];
        }
        return [];
    });
    const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
    // 编辑模式
    const [isVisualEditing, setIsVisualEditing] = useState(false);
    const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null);

    // 使用 ref 保存最新的 editingNodeIndex，避免闭包问题
    const editingNodeIndexRef = useRef<number | null>(null);
    useEffect(() => {
        editingNodeIndexRef.current = editingNodeIndex;
    }, [editingNodeIndex]);

    // 使用 ref 保存最新的 selectedObjectId / selectedGroupId，避免闭包问题
    const selectedObjectIdRef = useRef<number | null>(selectedObjectId);
    useEffect(() => {
        selectedObjectIdRef.current = selectedObjectId;
    }, [selectedObjectId]);
    const selectedGroupIdRef = useRef<string | null>(selectedGroupId);
    useEffect(() => {
        selectedGroupIdRef.current = selectedGroupId;
    }, [selectedGroupId]);
    const selectedObjectIdsRef = useRef<number[]>(selectedObjectIds);
    useEffect(() => {
        selectedObjectIdsRef.current = selectedObjectIds;
    }, [selectedObjectIds]);

    // 使用 ref 保存最新的 nodes，避免闭包问题
    const nodesRef = useRef<AnimationKeyframe[]>(nodes);
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // 使用 ref 保存回调函数，避免闭包问题
    const onVisualEditStartRef = useRef(onVisualEditStart);
    const onVisualEditEndRef = useRef(onVisualEditEnd);

    useEffect(() => {
        onVisualEditStartRef.current = onVisualEditStart;
        onVisualEditEndRef.current = onVisualEditEnd;
    }, [onVisualEditStart, onVisualEditEnd]);

    // 使用 ref 来跟踪之前的状态，用于区分是新建弹窗还是从可视化编辑恢复
    const prevOpenRef = useRef(open);
    // 使用 ref 来跟踪是否是暂时隐藏（进入可视化编辑）
    const isTemporarilyHiddenRef = useRef(false);

    // 当 item 或 open 变化时，重新初始化所有状态（编辑模式）
    useEffect(() => {
        // 当对话框关闭时（open=false），不做任何处理，等待重新打开时再判断
        if (!open) {
            prevOpenRef.current = open;
            return;
        }

        // 检查是否是从可视化编辑恢复（open 从 false 变为 true，且是暂时隐藏）
        const isRestoringFromVisualEdit = !prevOpenRef.current && open && isTemporarilyHiddenRef.current;

        prevOpenRef.current = open;

        // 如果是从可视化编辑恢复，保持当前状态不变
        if (isRestoringFromVisualEdit) {
            // 清除暂时隐藏标记
            isTemporarilyHiddenRef.current = false;
            // 只需要确保退出可视化编辑模式
            setTimeout(() => {
                setIsVisualEditing(false);
                setEditingNodeIndex(null);
            }, 0);
            return;
        }

        // 清除暂时隐藏标记
        isTemporarilyHiddenRef.current = false;
        if (item) {
            // 使用 setTimeout 避免在 effect 中同步调用 setState
            setTimeout(() => {
                setSelectedObjectId(item.objectId);
                setSelectedGroupId(item.groupId ?? null);
                setSelectedObjectIds(
                    item.objectIds && item.objectIds.length > 0 ? [...item.objectIds] : [item.objectId],
                );
                setSelectedTargetKeys(
                    item.groupId
                        ? [`group:${item.groupId}`]
                        : item.objectIds && item.objectIds.length > 0
                          ? item.objectIds.map((id) => `obj:${id}`)
                          : [`obj:${item.objectId}`],
                );
                setCurveTargetId(item.curveTargetId ?? item.objectId);
                setEffectType(item.effectType);
                setStartTime(item.startTime);
                setDuration(item.duration);
                setEasing(item.easing);
                setEffectName(item.name ?? '');
                setLoop(item.loop ?? false);
            }, 0);

            // setNodes inside effect is tricky, but here we are in an effect triggered by item change.
            // Using setTimeout to be safe.
            const nodesVal = item.keyframes ? [...item.keyframes] : [];
            setTimeout(() => setNodes(nodesVal), 0);

            if (item.effectType === AnimationEffectType.CurveMove && item.curveConfig) {
                setTimeout(() => setCurveConfig(item.curveConfig!), 0);
            } else {
                setTimeout(() => setCurveConfig(null), 0);
            }
        } else {
            setTimeout(() => {
                setSelectedObjectId(null);
                setSelectedGroupId(null);
                setSelectedObjectIds([]);
                setSelectedTargetKeys([]);
                setCurveTargetId(null);
                setEffectType(AnimationEffectType.Move);
                setStartTime(0);
                setDuration(3000);
                setEasing(EasingType.EaseInOut);
                setEffectName('');
                setLoop(false);
                setNodes([]);
                setCurveConfig(null);
            }, 0);
        }
        // 重置编辑状态
        setTimeout(() => {
            setIsVisualEditing(false);
            setEditingNodeIndex(null);
        }, 0);
    }, [item, open]);

    // 当节点发生变化且未开启loop时，自动更新duration为最后节点时间
    useEffect(() => {
        if (!loop && nodes.length > 0) {
            if (effectType === AnimationEffectType.CurveMove && curveConfig?.mode === 'rotate') {
                return;
            }
            const maxTime = Math.max(...nodes.map((n) => n.time));
            setTimeout(() => setDuration(maxTime), 0);
        }
    }, [nodes, loop, effectType, curveConfig]);

    useEffect(() => {
        if (selectedGroupId) {
            if (curveTargetId !== null) {
                setTimeout(() => setCurveTargetId(null), 0);
            }
            return;
        }
        if (selectedObjectIds.length === 0) {
            if (curveTargetId !== null) {
                setTimeout(() => setCurveTargetId(null), 0);
            }
            return;
        }
        if (curveTargetId === null || !selectedObjectIds.includes(curveTargetId)) {
            setTimeout(() => setCurveTargetId(selectedObjectIds[0]!), 0);
        }
    }, [curveTargetId, selectedGroupId, selectedObjectIds]);

    // 当选择对象时，初始化第一个节点
    useEffect(() => {
        if (selectedObjectId !== null && nodes.length === 0 && !item) {
            const obj = step.objects.find((o) => o.id === selectedObjectId);
            if (obj) {
                // ... (logic to calculate nodes)
                // Since this logic is long, I will use setTimeout for setNodes at the end of this block
                // But I need to extract properties first.

                const props = extractAnimatableProperties(obj);
                let initialNodes: AnimationKeyframe[] = [];

                const isMultiObject = !selectedGroupId && selectedObjectIds.length > 1;

                if (selectedGroupId || isMultiObject) {
                    const groupObjects = step.objects.filter((o) =>
                        selectedGroupId
                            ? (o as SceneObject & { groupId?: string }).groupId === selectedGroupId
                            : selectedObjectIds.includes(o.id),
                    );
                    const perObject: Record<number, AnimatedObjectProperties> = {};
                    let minX: number | undefined;
                    let maxX: number | undefined;
                    let minY: number | undefined;
                    let maxY: number | undefined;

                    for (const gObj of groupObjects) {
                        const objProps = extractAnimatableProperties(gObj);
                        perObject[gObj.id] = objProps;
                        const x = (objProps as { x?: number }).x;
                        const y = (objProps as { y?: number }).y;
                        if (typeof x === 'number') {
                            minX = minX === undefined ? x : Math.min(minX, x);
                            maxX = maxX === undefined ? x : Math.max(maxX, x);
                        }
                        if (typeof y === 'number') {
                            minY = minY === undefined ? y : Math.min(minY, y);
                            maxY = maxY === undefined ? y : Math.max(maxY, y);
                        }
                    }

                    const groupX = minX !== undefined && maxX !== undefined ? (minX + maxX) / 2 : (props.x ?? 0);
                    const groupY = minY !== undefined && maxY !== undefined ? (minY + maxY) / 2 : (props.y ?? 0);

                    initialNodes = [
                        {
                            time: 0,
                            value: {
                                x: groupX,
                                y: groupY,
                                perObject,
                            },
                        },
                    ];
                } else {
                    initialNodes = [
                        {
                            time: 0,
                            value: {
                                x: props.x ?? 0,
                                y: props.y ?? 0,
                                width: props.width ?? 100,
                                height: props.height ?? 100,
                                rotation: props.rotation ?? 0,
                                opacity: props.opacity ?? 1,
                                hide: props.hide,
                            },
                        },
                    ];
                }

                setTimeout(() => setNodes(initialNodes), 0);
            }
        }
    }, [selectedObjectId, selectedObjectIds, selectedGroupId, nodes.length, step.objects, item]);

    const stepObjectsRef = useRef(step.objects);
    useEffect(() => {
        stepObjectsRef.current = step.objects;
    }, [step.objects]);

    const originalObjectRef = useRef<SceneObject | SceneObject[] | null>(null);

    // 保存当前对象状态到节点
    const handleSaveNodeState = useCallback(() => {
        // 使用 ref 获取最新的值
        const currentEditingNodeIndex = editingNodeIndexRef.current;
        const currentSelectedObjectId = selectedObjectIdRef.current;
        const currentSelectedGroupId = selectedGroupIdRef.current;
        const currentNodes = nodesRef.current;

        if (currentEditingNodeIndex === null || currentSelectedObjectId === null) return;

        // 使用 ref 获取最新的对象状态
        const obj = stepObjectsRef.current.find((o) => o.id === currentSelectedObjectId);
        if (!obj) return;

        let value: AnimatedObjectProperties;

        const currentSelectedObjectIds = selectedObjectIdsRef.current;
        const isMultiObject = !currentSelectedGroupId && currentSelectedObjectIds.length > 1;

        if (currentSelectedGroupId || isMultiObject) {
            const groupObjects = stepObjectsRef.current.filter((o) =>
                currentSelectedGroupId
                    ? (o as SceneObject & { groupId?: string }).groupId === currentSelectedGroupId
                    : currentSelectedObjectIds.includes(o.id),
            );
            const perObject: Record<number, AnimatedObjectProperties> = {};
            let minX: number | undefined;
            let maxX: number | undefined;
            let minY: number | undefined;
            let maxY: number | undefined;

            for (const gObj of groupObjects) {
                const objProps = extractAnimatableProperties(gObj);
                perObject[gObj.id] = objProps;
                const x = (objProps as { x?: number }).x;
                const y = (objProps as { y?: number }).y;
                if (typeof x === 'number') {
                    minX = minX === undefined ? x : Math.min(minX, x);
                    maxX = maxX === undefined ? x : Math.max(maxX, x);
                }
                if (typeof y === 'number') {
                    minY = minY === undefined ? y : Math.min(minY, y);
                    maxY = maxY === undefined ? y : Math.max(maxY, y);
                }
            }

            const groupX = minX !== undefined && maxX !== undefined ? (minX + maxX) / 2 : 0;
            const groupY = minY !== undefined && maxY !== undefined ? (minY + maxY) / 2 : 0;

            value = {
                x: groupX,
                y: groupY,
                perObject,
            };
        } else {
            value = extractAnimatableProperties(obj);
        }

        const newNodes = currentNodes.map((node, i) =>
            i === currentEditingNodeIndex
                ? {
                      ...node,
                      value,
                  }
                : node,
        );

        console.log('[EffectEditDialog] 保存后的全部节点:', JSON.stringify(newNodes, null, 2));
        setNodes(newNodes);

        const originalObj = originalObjectRef.current;
        if (originalObj) {
            if (Array.isArray(originalObj)) {
                dispatch({
                    type: 'update',
                    value: originalObj,
                });
            } else {
                dispatch({
                    type: 'update',
                    value: originalObj,
                });
            }
            originalObjectRef.current = null;
        }

        setIsVisualEditing(false);
        setEditingNodeIndex(null);
        onVisualEditEndRef.current?.(); // 通知父组件重新打开主对话框
    }, [dispatch]);

    // 取消可视化编辑
    const handleCancelVisualEdit = useCallback(() => {
        const originalObj = originalObjectRef.current;
        if (originalObj) {
            if (Array.isArray(originalObj)) {
                dispatch({
                    type: 'update',
                    value: originalObj,
                });
            } else {
                dispatch({
                    type: 'update',
                    value: originalObj,
                });
            }
            originalObjectRef.current = null;
        }

        setIsVisualEditing(false);
        setEditingNodeIndex(null);
        onVisualEditEndRef.current?.(); // 通知父组件重新打开主对话框
    }, [dispatch]);

    // 进入可视化编辑模式
    const enterVisualEdit = useCallback(
        (index: number) => {
            if (selectedObjectId === null) return;

            const obj = step.objects.find((o) => o.id === selectedObjectId);
            if (!obj) return;

            const node = nodes[index];
            if (!node) return;

            const perObjectFromNew = (
                node.value as {
                    perObject?: Record<number, AnimatedObjectProperties>;
                }
            ).perObject;

            const perObjectHideFromOld = (
                node.value as {
                    perObjectHide?: Record<number, boolean | AnimatedObjectProperties>;
                }
            ).perObjectHide;

            const isMultiObject = !selectedGroupId && selectedObjectIds.length > 1;

            if (selectedGroupId || isMultiObject) {
                const groupObjects = step.objects.filter((o) =>
                    selectedGroupId
                        ? (o as SceneObject & { groupId?: string }).groupId === selectedGroupId
                        : selectedObjectIds.includes(o.id),
                );
                // 记录原始组对象
                originalObjectRef.current = groupObjects.map((o) => ({ ...o }) as SceneObject);

                let perObject: Record<number, AnimatedObjectProperties> | undefined;

                if (perObjectFromNew) {
                    perObject = perObjectFromNew;
                } else if (perObjectHideFromOld) {
                    const map: Record<number, AnimatedObjectProperties> = {};
                    for (const [idStr, entry] of Object.entries(perObjectHideFromOld)) {
                        const id = Number(idStr);
                        if (typeof entry === 'boolean') {
                            map[id] = { hide: entry };
                        } else if (entry && typeof entry === 'object') {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { perObjectHide: _innerIgnored, ...rest } = entry as Record<string, unknown>;
                            map[id] = rest as AnimatedObjectProperties;
                        }
                    }
                    if (Object.keys(map).length > 0) {
                        perObject = map;
                    }
                }

                const updatedGroupObjects = groupObjects.map((gObj) => {
                    const base = { ...(gObj as SceneObject & { hide?: boolean }) };

                    const overrideEntry = perObject ? perObject[gObj.id] : undefined;
                    if (overrideEntry && typeof overrideEntry === 'object') {
                        const {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            perObject: _perObject,
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            perObjectHide: _innerIgnored,
                            ...overrideProps
                        } = overrideEntry as Record<string, unknown>;
                        const hasOwnHide = Object.prototype.hasOwnProperty.call(overrideProps, 'hide');
                        const merged = {
                            ...base,
                            ...overrideProps,
                        } as SceneObject & { hide?: boolean };
                        if (!hasOwnHide) {
                            const nodeHide = (node.value as { hide?: boolean }).hide;
                            merged.hide = typeof nodeHide === 'boolean' ? nodeHide : false;
                        }
                        return merged as SceneObject;
                    }

                    return base as SceneObject;
                });

                // 将整个组恢复到节点记录的状态
                dispatch({
                    type: 'update',
                    value: updatedGroupObjects,
                });
            } else {
                // 非组效果：仅恢复当前对象
                originalObjectRef.current = { ...obj };

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { perObjectHide: _ignored, ...restValue } = node.value as Record<string, unknown>;
                dispatch({
                    type: 'update',
                    value: {
                        ...obj,
                        ...restValue,
                    } as SceneObject,
                });
            }

            setEditingNodeIndex(index);
            // 标记为暂时隐藏，这样当弹窗重新打开时不会重置状态
            isTemporarilyHiddenRef.current = true;
            // 先设置 isVisualEditing 为 true，然后通知父组件
            setIsVisualEditing(true);
            const visualEditObjectIds =
                !selectedGroupId && selectedObjectIds.length > 1 ? selectedObjectIds : undefined;
            onVisualEditStartRef.current?.(
                () => handleSaveNodeState(),
                () => handleCancelVisualEdit(),
                selectedObjectId,
                visualEditObjectIds,
            ); // 通知父组件进入可视化编辑，并传入保存/取消回调和对象ID
        },
        [
            selectedObjectId,
            selectedObjectIds,
            selectedGroupId,
            nodes,
            step.objects,
            dispatch,
            handleSaveNodeState,
            handleCancelVisualEdit,
        ],
    );

    const toggleGroupExpanded = useCallback((groupId: string) => {
        setExpandedGroupIds((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
        );
    }, []);

    // 添加新节点：直接进入可视化编辑模式（不自动定位，让用户在画布上选择位置）
    const handleAddNode = useCallback(() => {
        if (selectedObjectId === null) return;

        if (effectType === AnimationEffectType.CurveMove) {
            if (curveConfig?.mode === 'rotate') {
                return;
            }
            if ((curveConfig?.mode === 'arc' || curveConfig?.mode === 'bezier') && nodes.length >= 2) {
                alert('当前曲线模式仅支持两个节点（起点和终点）');
                return;
            }
        }

        const obj = step.objects.find((o) => o.id === selectedObjectId);
        if (!obj) return;
        originalObjectRef.current = null;

        // 计算新节点的时间（在最后一个节点之后500ms）
        const lastNode = nodes[nodes.length - 1];
        const newTime = lastNode ? lastNode.time + 500 : 0;

        // 创建新节点，使用当前状态作为初始值
        let newNode: AnimationKeyframe;
        const isMultiObject = !selectedGroupId && selectedObjectIds.length > 1;
        if (selectedGroupId || isMultiObject) {
            const groupObjects = step.objects.filter((o) =>
                selectedGroupId
                    ? (o as SceneObject & { groupId?: string }).groupId === selectedGroupId
                    : selectedObjectIds.includes(o.id),
            );
            const perObject: Record<number, AnimatedObjectProperties> = {};
            let minX: number | undefined;
            let maxX: number | undefined;
            let minY: number | undefined;
            let maxY: number | undefined;

            for (const gObj of groupObjects) {
                const objProps = extractAnimatableProperties(gObj);
                perObject[gObj.id] = objProps;
                const x = (objProps as { x?: number }).x;
                const y = (objProps as { y?: number }).y;
                if (typeof x === 'number') {
                    minX = minX === undefined ? x : Math.min(minX, x);
                    maxX = maxX === undefined ? x : Math.max(maxX, x);
                }
                if (typeof y === 'number') {
                    minY = minY === undefined ? y : Math.min(minY, y);
                    maxY = maxY === undefined ? y : Math.max(maxY, y);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const groupX = minX !== undefined && maxX !== undefined ? (minX + maxX) / 2 : ((obj as any).x ?? 0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const groupY = minY !== undefined && maxY !== undefined ? (minY + maxY) / 2 : ((obj as any).y ?? 0);

            newNode = {
                time: newTime,
                value: {
                    x: groupX,
                    y: groupY,
                    perObject,
                },
            };
        } else {
            newNode = {
                time: newTime,
                value: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    x: (obj as any).x ?? 0,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    y: (obj as any).y ?? 0,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    width: (obj as any).width ?? 100,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    height: (obj as any).height ?? 100,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    rotation: (obj as any).rotation ?? 0,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    opacity: (obj as any).opacity ?? 1,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    hide: (obj as any).hide,
                },
            };
        }

        const newIndex = nodes.length;
        setNodes([...nodes, newNode]);

        // 如果未开启loop，自动更新持续时间为最后节点时间
        if (!loop) {
            setDuration(newTime);
        } else {
            // 如果开启loop，确保持续时间至少大于最后节点时间
            const maxTime = Math.max(...[...nodes, newNode].map((n) => n.time));
            if (duration < maxTime) {
                setDuration(maxTime + 500);
            }
        }

        // 直接进入可视化编辑模式（不移动对象，让用户在画布上自由拖放）
        setEditingNodeIndex(newIndex);
        // 标记为暂时隐藏，这样当弹窗重新打开时不会重置状态
        isTemporarilyHiddenRef.current = true;
        // 先设置 isVisualEditing 为 true，然后通知父组件
        setIsVisualEditing(true);
        const visualEditObjectIds = !selectedGroupId && selectedObjectIds.length > 1 ? selectedObjectIds : undefined;
        onVisualEditStartRef.current?.(
            () => handleSaveNodeState(),
            () => handleCancelVisualEdit(),
            selectedObjectId,
            visualEditObjectIds,
        );
    }, [
        selectedObjectId,
        selectedObjectIds,
        selectedGroupId,
        nodes,
        step.objects,
        loop,
        duration,
        handleSaveNodeState,
        handleCancelVisualEdit,
        effectType,
        curveConfig,
    ]);

    // 删除节点
    const handleRemoveNode = useCallback(
        (index: number) => {
            if (nodes.length <= 1) {
                alert('至少需要保留一个节点');
                return;
            }
            const newNodes = nodes.filter((_, i) => i !== index);
            setNodes(newNodes);

            // 如果未开启loop，自动更新持续时间为最后节点时间
            if (!loop && newNodes.length > 0) {
                const maxTime = Math.max(...newNodes.map((n) => n.time));
                setDuration(maxTime);
            }
        },
        [nodes, loop],
    );

    // 更新节点时间
    const handleUpdateNodeTime = useCallback(
        (index: number, time: number) => {
            const newNodes = nodes.map((node, i) => (i === index ? { ...node, time } : node));
            setNodes(newNodes);

            // 如果未开启loop，自动更新持续时间为最后节点时间
            if (!loop) {
                const maxTime = Math.max(...newNodes.map((n) => n.time));
                setDuration(maxTime);
            } else {
                // 如果开启loop，确保持续时间至少大于最后节点时间
                const maxTime = Math.max(...newNodes.map((n) => n.time));
                if (duration < maxTime) {
                    setDuration(maxTime);
                }
            }
        },
        [nodes, duration, loop],
    );

    const handleDuplicateNode = useCallback(
        (index: number) => {
            const source = nodes[index];
            if (!source) return;

            const maxTime = nodes.length > 0 ? Math.max(...nodes.map((n) => n.time)) : 0;
            const newTime = maxTime + 100;

            const duplicated: AnimationKeyframe = {
                time: newTime,
                value: { ...source.value },
                easing: source.easing,
            };

            setNodes([...nodes, duplicated]);

            if (!loop) {
                setDuration(newTime);
            } else {
                const loopMax = Math.max(...[...nodes, duplicated].map((n) => n.time));
                if (duration < loopMax) {
                    setDuration(loopMax);
                }
            }
        },
        [nodes, loop, duration],
    );

    const handleSave = () => {
        const isMultiObject = !selectedGroupId && selectedObjectIds.length > 1;
        const effectiveObjectIds = selectedGroupId
            ? selectedObjectId != null
                ? [selectedObjectId]
                : []
            : isMultiObject
              ? selectedObjectIds
              : selectedObjectId != null
                ? [selectedObjectId]
                : [];

        if (effectiveObjectIds.length === 0) return;

        const curveTargetInSelection =
            effectType === AnimationEffectType.CurveMove &&
            isMultiObject &&
            curveTargetId != null &&
            effectiveObjectIds.includes(curveTargetId);
        const anchorId = curveTargetInSelection ? curveTargetId! : effectiveObjectIds[0]!;
        const obj = step.objects.find((o) => o.id === anchorId);
        const objectName = obj ? getObjectDisplayName(obj, t) : undefined;
        const objectNameLabel =
            !selectedGroupId && isMultiObject && effectiveObjectIds.length > 1
                ? `${objectName ?? ''} 等（${effectiveObjectIds.length} 个）`
                : objectName;
        let effectiveNodes = nodes;

        if (
            effectType === AnimationEffectType.CurveMove &&
            curveConfig?.mode === 'rotate' &&
            effectiveNodes.length === 0
        ) {
            if (obj) {
                const props = extractAnimatableProperties(obj);
                effectiveNodes = [
                    {
                        time: 0,
                        value: {
                            x: props.x ?? 0,
                            y: props.y ?? 0,
                            width: props.width ?? 100,
                            height: props.height ?? 100,
                            rotation: props.rotation ?? 0,
                            opacity: props.opacity ?? 1,
                            hide: props.hide,
                        },
                    },
                ];
                setNodes(effectiveNodes);
            }
        }

        if (effectiveNodes.length === 0) return;

        const sortedNodes = [...effectiveNodes].sort((a, b) => a.time - b.time);

        const baseName =
            effectType === AnimationEffectType.Move
                ? '直线移动'
                : effectType === AnimationEffectType.CurveMove
                  ? '曲线移动'
                  : '自定义';

        const itemCurveConfig: CurveMoveConfig | undefined =
            effectType === AnimationEffectType.CurveMove && curveConfig
                ? {
                      mode: curveConfig.mode,
                      centerX: curveConfig.centerX,
                      centerY: curveConfig.centerY,
                      angle: curveConfig.angle,
                      rotateDuration: curveConfig.rotateDuration,
                      controlX1: curveConfig.controlX1,
                      controlY1: curveConfig.controlY1,
                      controlX2: curveConfig.controlX2,
                      controlY2: curveConfig.controlY2,
                      direction: curveConfig.direction,
                  }
                : undefined;

        let finalDuration = duration;
        if (
            effectType === AnimationEffectType.CurveMove &&
            curveConfig?.mode === 'rotate' &&
            !loop &&
            curveConfig.rotateDuration &&
            curveConfig.rotateDuration > 0
        ) {
            finalDuration = curveConfig.rotateDuration;
        }

        let newItem: Omit<AnimationTrackItem, 'id'> | AnimationTrackItem = {
            objectId: anchorId,
            objectIds:
                !selectedGroupId && isMultiObject && effectiveObjectIds.length > 1 ? effectiveObjectIds : undefined,
            curveTargetId: curveTargetInSelection ? curveTargetId! : undefined,
            groupId: selectedGroupId ?? undefined,
            objectName: objectNameLabel,
            effectType,
            startTime,
            duration: finalDuration,
            easing,
            name: effectName || baseName,
            loop,
            keyframes: sortedNodes,
            curveConfig: itemCurveConfig,
        };

        if (item) {
            newItem = { ...newItem, id: item.id } as AnimationTrackItem;
        }

        onSave(trackId, newItem);
        onClose();
    };

    const groupedObjects = step.objects.reduce(
        (acc, obj) => {
            const anyObj = obj as SceneObject & { groupId?: string };
            if (anyObj.groupId) {
                const list = acc.groups.get(anyObj.groupId) ?? [];
                list.push(anyObj);
                acc.groups.set(anyObj.groupId, list);
            } else {
                acc.singles.push(anyObj);
            }
            return acc;
        },
        {
            groups: new Map<string, (SceneObject & { groupId?: string })[]>(),
            singles: [] as (SceneObject & { groupId?: string })[],
        },
    );

    const groupOptions = Array.from(groupedObjects.groups.entries()).map(([groupId, objects]) => {
        const names = objects.map((o) => getObjectDisplayName(o, t));
        const commonName = commonValue(names, (n) => n);
        const firstName = names[0] ?? '';
        const label =
            commonName !== undefined
                ? `${commonName}（组，${objects.length} 个元素）`
                : `${firstName} 等（组，${objects.length} 个元素）`;
        const anchorObjectId = objects[0]!.id;

        return {
            type: 'group' as const,
            key: `group:${groupId}`,
            groupId,
            objectId: anchorObjectId,
            label,
            color: getGroupColor(groupId),
            children: objects.map((obj) => ({
                type: 'object' as const,
                key: `obj:${obj.id}`,
                objectId: obj.id,
                label: getObjectDisplayName(obj, t),
            })),
        };
    });

    const objectOptions = groupedObjects.singles.map((obj) => ({
        type: 'object' as const,
        key: `obj:${obj.id}`,
        objectId: obj.id,
        label: getObjectDisplayName(obj, t),
    }));

    const selectedDisplayLabel = (() => {
        if (selectedGroupId) {
            const groupOption = groupOptions.find((opt) => opt.groupId === selectedGroupId);
            if (groupOption) {
                return groupOption.label;
            }
        }

        if (!selectedGroupId && selectedObjectIds.length > 1) {
            const first = step.objects.find((o) => o.id === selectedObjectIds[0]);
            const firstName = first ? getObjectDisplayName(first, t) : '';
            return `${firstName} 等（${selectedObjectIds.length} 个）`;
        }

        if (selectedObjectId !== null) {
            const obj = step.objects.find((o) => o.id === selectedObjectId);
            if (obj) {
                return getObjectDisplayName(obj, t);
            }
        }

        return '请选择对象';
    })();

    return (
        <>
            {/* 主对话框 - 在可视化编辑时隐藏 */}
            <Dialog open={open && !isVisualEditing} onOpenChange={(_, data) => !data.open && onClose()}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>{item ? '编辑动画效果' : '添加动画效果'}</DialogTitle>
                        <DialogContent>
                            <div className={classes.dialogContent}>
                                {/* 选择对象 */}
                                <Field label="选择对象">
                                    <Dropdown
                                        multiselect
                                        value={selectedDisplayLabel}
                                        selectedOptions={selectedTargetKeys}
                                        onOptionSelect={(_, data) => {
                                            const selected = data.selectedOptions ?? [];
                                            setSelectedTargetKeys(selected);

                                            const groupKey = selected.find((k) => k.startsWith('group:'));
                                            if (groupKey) {
                                                setSelectedTargetKeys([groupKey]);
                                                const groupId = groupKey.substring('group:'.length);
                                                const groupOption = groupOptions.find((opt) => opt.groupId === groupId);
                                                if (!groupOption) return;
                                                setSelectedObjectId(groupOption.objectId);
                                                setSelectedGroupId(groupId);
                                                setSelectedObjectIds([groupOption.objectId]);
                                                setNodes([]);
                                                return;
                                            }

                                            const ids = selected
                                                .filter((k) => k.startsWith('obj:'))
                                                .map((k) => parseInt(k.substring('obj:'.length), 10))
                                                .filter((n) => !Number.isNaN(n));

                                            setSelectedGroupId(null);
                                            setSelectedObjectIds(ids);
                                            setSelectedObjectId(ids.length > 0 ? ids[0]! : null);
                                            setNodes([]);
                                        }}
                                        disabled={!!item}
                                    >
                                        {groupOptions.map((opt) => {
                                            const isExpanded = expandedGroupIds.includes(opt.groupId);
                                            return (
                                                <React.Fragment key={opt.key}>
                                                    <Option value={opt.key} text={opt.label}>
                                                        <span
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: tokens.spacingHorizontalXS,
                                                            }}
                                                        >
                                                            <span
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    e.preventDefault();
                                                                    toggleGroupExpanded(opt.groupId);
                                                                }}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                }}
                                                            >
                                                                {isExpanded ? '▼' : '▶'}
                                                            </span>
                                                            <ArrowFitInFilled
                                                                fontSize={14}
                                                                style={{ color: opt.color }}
                                                            />
                                                            <span>{opt.label}</span>
                                                        </span>
                                                    </Option>
                                                    {isExpanded &&
                                                        opt.children.map((child) => (
                                                            <Option
                                                                key={child.key}
                                                                value={child.key}
                                                                text={child.label}
                                                            >
                                                                <span
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        paddingLeft: tokens.spacingHorizontalL,
                                                                    }}
                                                                >
                                                                    <span>{child.label}</span>
                                                                </span>
                                                            </Option>
                                                        ))}
                                                </React.Fragment>
                                            );
                                        })}
                                        {objectOptions.map((opt) => (
                                            <Option key={opt.key} value={opt.key} text={opt.label}>
                                                {opt.label}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>

                                {/* 效果类型 */}
                                <Field label="效果类型">
                                    <Dropdown
                                        value={effectType === AnimationEffectType.Move ? '直线移动' : '曲线移动'}
                                        selectedOptions={[effectType]}
                                        onOptionSelect={(_, data) => {
                                            if (!data.optionValue) {
                                                return;
                                            }
                                            const nextType = data.optionValue as AnimationEffectType;
                                            setEffectType(nextType);
                                            if (nextType === AnimationEffectType.CurveMove && !curveConfig) {
                                                setCurveConfig({
                                                    mode: 'rotate',
                                                    centerX: 0,
                                                    centerY: 0,
                                                    angle: 360,
                                                    rotateDuration: 3000,
                                                });
                                            }
                                        }}
                                    >
                                        <Option value={AnimationEffectType.Move}>直线移动</Option>
                                        <Option value={AnimationEffectType.CurveMove}>曲线移动</Option>
                                    </Dropdown>
                                </Field>

                                {effectType === AnimationEffectType.CurveMove &&
                                    !selectedGroupId &&
                                    selectedObjectIds.length > 1 && (
                                        <Field label="曲线对象">
                                            <Dropdown
                                                value={
                                                    curveTargetId != null
                                                        ? (() => {
                                                              const obj = step.objects.find(
                                                                  (o) => o.id === curveTargetId,
                                                              );
                                                              return obj
                                                                  ? getObjectDisplayName(obj as SceneObject, t)
                                                                  : '请选择曲线对象';
                                                          })()
                                                        : '请选择曲线对象'
                                                }
                                                selectedOptions={curveTargetId != null ? [`obj:${curveTargetId}`] : []}
                                                onOptionSelect={(_, data) => {
                                                    const value = data.optionValue;
                                                    if (!value) return;
                                                    const id = parseInt(value.substring('obj:'.length), 10);
                                                    if (Number.isNaN(id)) return;
                                                    setCurveTargetId(id);
                                                }}
                                            >
                                                {selectedObjectIds.map((id) => {
                                                    const obj = step.objects.find((o) => o.id === id);
                                                    if (!obj) return null;
                                                    const label = getObjectDisplayName(obj as SceneObject, t);
                                                    return (
                                                        <Option key={`obj:${id}`} value={`obj:${id}`} text={label}>
                                                            {label}
                                                        </Option>
                                                    );
                                                })}
                                            </Dropdown>
                                        </Field>
                                    )}

                                {/* 基本设置 */}
                                <Field label="开始时间 (ms)">
                                    <Input
                                        type="number"
                                        value={startTime.toString()}
                                        onChange={(e, data) => setStartTime(parseInt(data.value) || 0)}
                                    />
                                </Field>

                                <Field label="缓动函数">
                                    <Dropdown
                                        value={easing}
                                        selectedOptions={[easing]}
                                        onOptionSelect={(_, data) => {
                                            if (data.optionValue) {
                                                setEasing(data.optionValue as EasingType);
                                            }
                                        }}
                                    >
                                        <Option value={EasingType.Linear}>均速</Option>
                                        <Option value={EasingType.EaseIn}>加速</Option>
                                        <Option value={EasingType.EaseOut}>减速</Option>
                                        <Option value={EasingType.EaseInOut}>先加速后减速</Option>
                                        <Option value={EasingType.EaseInCubic}>三次加速</Option>
                                        <Option value={EasingType.EaseOutCubic}>三次减速</Option>
                                        <Option value={EasingType.EaseInOutCubic}>三次先加速后减速</Option>
                                    </Dropdown>
                                </Field>

                                <Field label="效果名称（可选）">
                                    <Input
                                        value={effectName}
                                        onChange={(e, data) => setEffectName(data.value)}
                                        placeholder={effectType === AnimationEffectType.Move ? '直线移动' : '曲线移动'}
                                    />
                                </Field>

                                {effectType === AnimationEffectType.CurveMove && (
                                    <>
                                        <Field label="曲线类型">
                                            <Dropdown
                                                value={curveConfig?.mode === 'arc' ? '起止点' : '圆心旋转'}
                                                selectedOptions={[curveConfig?.mode ?? ('rotate' as CurveMoveMode)]}
                                                onOptionSelect={(_, data) => {
                                                    if (!data.optionValue) {
                                                        return;
                                                    }
                                                    const mode = data.optionValue as CurveMoveMode;
                                                    setCurveConfig((prev) => ({
                                                        ...(prev ?? { mode }),
                                                        mode,
                                                    }));
                                                }}
                                            >
                                                <Option value="rotate">圆心旋转</Option>
                                                <Option value="arc">起止点</Option>
                                            </Dropdown>
                                        </Field>

                                        <Field label={curveConfig?.mode === 'arc' ? '旋转角度' : '圆心坐标与旋转角度'}>
                                            {curveConfig?.mode === 'rotate' && (
                                                <div className={classes.row}>
                                                    <Input
                                                        type="number"
                                                        value={
                                                            curveConfig?.centerX !== undefined
                                                                ? curveConfig.centerX.toString()
                                                                : ''
                                                        }
                                                        onChange={(e, data) => {
                                                            const v = parseFloat(data.value);
                                                            setCurveConfig((prev) => ({
                                                                ...(prev ?? { mode: 'rotate' as CurveMoveMode }),
                                                                centerX: Number.isNaN(v) ? undefined : v,
                                                            }));
                                                        }}
                                                        placeholder="圆心 X"
                                                        style={{ flex: 1 }}
                                                    />
                                                    <Input
                                                        type="number"
                                                        value={
                                                            curveConfig?.centerY !== undefined
                                                                ? curveConfig.centerY.toString()
                                                                : ''
                                                        }
                                                        onChange={(e, data) => {
                                                            const v = parseFloat(data.value);
                                                            setCurveConfig((prev) => ({
                                                                ...(prev ?? { mode: 'rotate' as CurveMoveMode }),
                                                                centerY: Number.isNaN(v) ? undefined : v,
                                                            }));
                                                        }}
                                                        placeholder="圆心 Y"
                                                        style={{ flex: 1 }}
                                                    />
                                                    <Button
                                                        appearance="secondary"
                                                        style={{ whiteSpace: 'nowrap' }}
                                                        onClick={() => {
                                                            const currentObjectId = selectedObjectIdRef.current;
                                                            if (!currentObjectId) {
                                                                return;
                                                            }
                                                            setLastPickedPoint(null);
                                                            setPickCallback((point) => {
                                                                setCurveConfig((prev) => ({
                                                                    ...(prev ?? {
                                                                        mode: 'rotate' as CurveMoveMode,
                                                                    }),
                                                                    centerX: point.x,
                                                                    centerY: point.y,
                                                                }));
                                                            });
                                                            isTemporarilyHiddenRef.current = true;
                                                            setIsVisualEditing(true);
                                                            onVisualEditStartRef.current?.(
                                                                () => {
                                                                    setIsVisualEditing(false);
                                                                    setPickCallback(null);
                                                                },
                                                                () => {
                                                                    setIsVisualEditing(false);
                                                                    setPickCallback(null);
                                                                },
                                                                currentObjectId,
                                                            );
                                                        }}
                                                    >
                                                        在画布上选择圆心
                                                    </Button>
                                                </div>
                                            )}
                                            <div className={classes.row} style={{ marginTop: tokens.spacingVerticalS }}>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={
                                                        curveConfig?.angle !== undefined
                                                            ? curveConfig.angle.toString()
                                                            : ''
                                                    }
                                                    onChange={(e, data) => {
                                                        const raw = parseFloat(data.value);
                                                        const v = Number.isNaN(raw) ? undefined : Math.max(0, raw);
                                                        setCurveConfig((prev) => ({
                                                            ...(prev ?? {
                                                                mode: 'rotate' as CurveMoveMode,
                                                            }),
                                                            angle: v,
                                                        }));
                                                    }}
                                                    placeholder="旋转角度(度)"
                                                    style={{ flex: 1 }}
                                                />
                                                {curveConfig?.mode === 'rotate' && (
                                                    <Input
                                                        type="number"
                                                        value={
                                                            curveConfig?.rotateDuration !== undefined
                                                                ? curveConfig.rotateDuration.toString()
                                                                : ''
                                                        }
                                                        onChange={(e, data) => {
                                                            const v = parseFloat(data.value);
                                                            setCurveConfig((prev) => ({
                                                                ...(prev ?? { mode: 'rotate' as CurveMoveMode }),
                                                                rotateDuration: Number.isNaN(v) ? undefined : v,
                                                            }));
                                                        }}
                                                        placeholder="旋转时间(ms)"
                                                        style={{ flex: 1 }}
                                                    />
                                                )}
                                            </div>
                                        </Field>

                                        {(curveConfig?.mode === 'arc' || curveConfig?.mode === 'rotate') && (
                                            <Field label="旋转方向">
                                                <Dropdown
                                                    value={curveConfig.direction === 'ccw' ? '逆时针' : '顺时针'}
                                                    selectedOptions={[curveConfig.direction ?? 'cw']}
                                                    onOptionSelect={(_, data) => {
                                                        if (!data.optionValue) {
                                                            return;
                                                        }
                                                        const dir = data.optionValue as 'cw' | 'ccw';
                                                        setCurveConfig((prev) => {
                                                            const mode: CurveMoveMode =
                                                                (prev?.mode as CurveMoveMode) ?? 'arc';
                                                            return {
                                                                ...(prev ?? { mode }),
                                                                direction: dir,
                                                            };
                                                        });
                                                    }}
                                                >
                                                    <Option value="cw">顺时针</Option>
                                                    <Option value="ccw">逆时针</Option>
                                                </Dropdown>
                                            </Field>
                                        )}
                                    </>
                                )}

                                {/* 循环播放开关 */}
                                <Field label="循环播放">
                                    <Switch
                                        checked={loop}
                                        onChange={(e, data) => setLoop(data.checked)}
                                        label="在效果持续时间内循环播放动画节点"
                                    />
                                </Field>

                                {/* 节点管理区域 */}
                                <div className={classes.label}>动画节点（按时间顺序播放）</div>

                                {effectType === AnimationEffectType.CurveMove && curveConfig?.mode === 'rotate' ? (
                                    <div className={classes.nodesContainer}>
                                        <div
                                            style={{
                                                textAlign: 'center',
                                                padding: tokens.spacingVerticalL,
                                                color: tokens.colorNeutralForeground3,
                                            }}
                                        >
                                            绕圆心旋转模式下无需手动配置动画节点，将根据当前对象状态和旋转参数自动计算运动轨迹
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className={classes.nodesContainer}>
                                            {nodes.length === 0 ? (
                                                <div
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: tokens.spacingVerticalL,
                                                        color: tokens.colorNeutralForeground3,
                                                    }}
                                                >
                                                    暂无节点，点击下方按钮添加第一个节点
                                                </div>
                                            ) : (
                                                nodes.map((node, index) => (
                                                    <div key={index} className={classes.nodeItem}>
                                                        <div className={classes.nodeTime}>
                                                            <Input
                                                                type="number"
                                                                value={node.time.toString()}
                                                                onChange={(e, data) =>
                                                                    handleUpdateNodeTime(
                                                                        index,
                                                                        parseInt(data.value) || 0,
                                                                    )
                                                                }
                                                                size="small"
                                                            />
                                                            <span style={{ fontSize: tokens.fontSizeBase200 }}>ms</span>
                                                        </div>
                                                        <div className={classes.nodeInfo}>
                                                            X:{Math.round(node.value.x ?? 0)} Y:
                                                            {Math.round(node.value.y ?? 0)}
                                                            {node.value.hide && (
                                                                <span
                                                                    style={{
                                                                        color: tokens.colorPaletteRedForeground1,
                                                                        marginLeft: tokens.spacingHorizontalXS,
                                                                    }}
                                                                >
                                                                    (隐藏)
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Tooltip content="复制节点" relationship="label">
                                                            <Button
                                                                icon={<Copy24Regular />}
                                                                appearance="subtle"
                                                                size="small"
                                                                onClick={() => {
                                                                    if (window.confirm('确定复制该节点吗？')) {
                                                                        handleDuplicateNode(index);
                                                                    }
                                                                }}
                                                            />
                                                        </Tooltip>
                                                        <Tooltip content="可视化编辑" relationship="label">
                                                            <Button
                                                                icon={<Play24Regular />}
                                                                appearance="subtle"
                                                                size="small"
                                                                onClick={() => enterVisualEdit(index)}
                                                            />
                                                        </Tooltip>
                                                        <Tooltip content="删除节点" relationship="label">
                                                            <Button
                                                                icon={<Delete24Regular />}
                                                                appearance="subtle"
                                                                size="small"
                                                                onClick={() => handleRemoveNode(index)}
                                                            />
                                                        </Tooltip>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <Button
                                            appearance="outline"
                                            icon={<Add24Regular />}
                                            onClick={handleAddNode}
                                            disabled={selectedObjectId === null}
                                            style={{
                                                width: '100%',
                                                minHeight: '30px',
                                                marginBottom: '10px',
                                            }}
                                        >
                                            添加新节点（在画布上设置位置）
                                        </Button>
                                    </>
                                )}
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={onClose}>
                                取消
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={handleSave}
                                disabled={selectedGroupId ? selectedObjectId === null : selectedObjectIds.length === 0}
                            >
                                {item ? '保存' : '添加'}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
};
