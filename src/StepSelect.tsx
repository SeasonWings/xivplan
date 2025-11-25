import {
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Button,
    ButtonProps,
    Dialog,
    DialogActions,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    SelectTabData,
    SelectTabEvent,
    Tab,
    TabList,
    Tooltip,
    makeStyles,
    mergeClasses,
    tokens,
    typographyStyles,
} from '@fluentui/react-components';
import { AddFilled, ArrowSwapRegular, DeleteFilled, DeleteRegular, bundleIcon } from '@fluentui/react-icons';
import React, { HTMLAttributes, RefAttributes, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HotkeyBlockingDialogBody } from './HotkeyBlockingDialogBody';
import { useScene } from './SceneProvider';
import { ScenePreview } from './render/SceneRenderer';
import { Scene } from './scene';
import { MIN_STAGE_WIDTH } from './theme';

export const StepSelect: React.FC = () => {
    const classes = useStyles();
    const { scene, stepIndex, dispatch } = useScene();
    const steps = scene.steps.map((_, i) => i);

    const handleTabSelect = (event: SelectTabEvent, data: SelectTabData) => {
        const index = data.value as number;
        dispatch({ type: 'setStep', index });
    };

    const maxWidth = scene.arena.width + scene.arena.padding * 2;

    return (
        <div className={classes.root} style={{ maxWidth }}>
            <div className={classes.listWrapper}>
                <TabList
                    size="small"
                    appearance="subtle"
                    className={classes.tabList}
                    selectedValue={stepIndex}
                    onTabSelect={handleTabSelect}
                >
                    {steps.map((i) => {
                        return <StepButton key={i} index={i} />;
                    })}
                </TabList>
            </div>
            <div className={classes.actions}>
                <AddStepButton className={classes.addButton} />
                <ReorderStepsButton />
                <RemoveStepButton />
            </div>
        </div>
    );
};

const PREVIEW_SIZE = 180;

function getStepText(index: number, name?: string) {
    // 如果有自定义名称，显示自定义名称，否则显示步骤编号
    return name || (index + 1).toString();
}

interface StepButtonProps {
    index: number;
}

const StepButton: React.FC<StepButtonProps> = ({ index }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { scene, dispatch } = useScene();
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [tempName, setTempName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // 获取当前步骤的名称
    const step = scene.steps[index];
    const stepText = getStepText(index, step?.name);

    // 打开编辑对话框
    const handleOpenEditDialog = () => {
        setTempName(step?.name || '');
        setEditDialogOpen(true);
    };

    // 保存步骤名称
    const handleSaveName = () => {
        // 去除首尾空格，空字符串视为undefined（不设置名称）
        const trimmedName = tempName.trim();
        dispatch({
            type: 'updateStepName',
            index,
            name: trimmedName || undefined,
        });
        setEditDialogOpen(false);
    };

    // 处理Tab的右键点击
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        handleOpenEditDialog();
    };

    // 处理Tab的双击
    const handleDoubleClick = () => {
        handleOpenEditDialog();
    };

    return (
        <>
            <Tooltip content={t('steps.step', { n: stepText })} relationship="label" withArrow>
                <Tab value={index} onContextMenu={handleContextMenu} onDoubleClick={handleDoubleClick}>
                    <div className={classes.tab}>{stepText}</div>
                </Tab>
            </Tooltip>

            {/* 步骤名称编辑对话框 */}
            <Dialog open={editDialogOpen} onOpenChange={(e, data) => setEditDialogOpen(data.open)}>
                <DialogSurface>
                    <DialogTitle>{t('steps.editStepName')}</DialogTitle>
                    <DialogContent>
                        <input
                            ref={inputRef}
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            placeholder={t('steps.stepNamePlaceholder')}
                            className={classes.nameInput}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSaveName();
                                } else if (e.key === 'Escape') {
                                    setEditDialogOpen(false);
                                }
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleSaveName}>{t('actions.apply')}</Button>
                        <Button onClick={() => setEditDialogOpen(false)}>{t('actions.cancel')}</Button>
                    </DialogActions>
                </DialogSurface>
            </Dialog>
        </>
    );
};

const AddStepButton: React.FC<ButtonProps> = (props) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();

    return (
        <Tooltip content={t('steps.addNew')} relationship="label" withArrow>
            <Button icon={<AddFilled />} appearance="subtle" onClick={() => dispatch({ type: 'addStep' })} {...props} />
        </Tooltip>
    );
};

const DeleteIcon = bundleIcon(DeleteFilled, DeleteRegular);

const RemoveStepButton: React.FC = () => {
    const { scene, stepIndex, dispatch } = useScene();
    const { t } = useTranslation();
    const currentStep = scene.steps[stepIndex];
    const stepText = getStepText(stepIndex, currentStep?.name);

    return (
        <Tooltip content={t('steps.deleteStep', { n: stepText })} relationship="label" withArrow>
            <Button
                icon={<DeleteIcon />}
                appearance="subtle"
                disabled={scene.steps.length < 2}
                onClick={() => dispatch({ type: 'removeStep', index: stepIndex })}
            />
        </Tooltip>
    );
};

const ReorderStepsButton: React.FC = () => {
    const classes = useStyles();
    const { scene } = useScene();
    const { t } = useTranslation();

    return (
        <Dialog>
            <DialogTrigger>
                <Tooltip content={t('steps.reorder')} relationship="label" withArrow>
                    <Button icon={<ArrowSwapRegular />} disabled={scene.steps.length < 2} appearance="subtle" />
                </Tooltip>
            </DialogTrigger>
            <DialogSurface className={classes.dialogSurface}>
                <HotkeyBlockingDialogBody>
                    <ReoderStepsDialogContent />
                </HotkeyBlockingDialogBody>
            </DialogSurface>
        </Dialog>
    );
};

const ReoderStepsDialogContent: React.FC = () => {
    const classes = useStyles();
    const { scene, dispatch } = useScene();
    const { t } = useTranslation();
    const [sceneSnapshot] = useState<Scene>(scene);
    const [order, setOrder] = useState<StepOrderItem[]>(scene.steps.map((_, i) => getStepOrderItem(i)));

    const applyOrder = () => {
        dispatch({ type: 'reoderSteps', order: order.map((x) => x.index) });
    };

    return (
        <>
            <DialogTitle>{t('steps.reorder')}</DialogTitle>
            <DialogContent className={classes.dialogContent}>
                <div>{t('steps.reorderInstructions')}</div>

                <ReorderStepsList scene={sceneSnapshot} order={order} onOrderChange={setOrder} />
            </DialogContent>
            <DialogActions>
                <DialogTrigger>
                    <Button appearance="primary" onClick={applyOrder}>
                        {t('actions.apply')}
                    </Button>
                </DialogTrigger>
                <DialogTrigger>
                    <Button>{t('actions.cancel')}</Button>
                </DialogTrigger>
            </DialogActions>
        </>
    );
};

interface StepOrderItem {
    id: string;
    index: number;
}

function getStepOrderItem(index: number | string): StepOrderItem {
    if (typeof index === 'string') {
        index = parseInt(index);
    }

    return {
        id: index.toString(),
        index,
    };
}

interface ReorderStepsListProps {
    scene: Scene;
    order: StepOrderItem[];
    onOrderChange: (order: StepOrderItem[]) => void;
}

const ReorderStepsList: React.FC<ReorderStepsListProps> = ({ scene, order, onOrderChange }) => {
    const classes = useStyles();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = order.findIndex((x) => x.id === active.id);
        const newIndex = order.findIndex((x) => x.id === over.id);
        const newOrder = arrayMove(order, oldIndex, newIndex);

        onOrderChange(newOrder);
    };

    return (
        <div className={classes.dialogList}>
            <DndContext
                sensors={sensors}
                modifiers={[restrictToParentElement]}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={order}>
                    {order.map((step) => (
                        <ReorderableStepItem key={step.id} scene={scene} step={step} />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    );
};

interface StepItemProps extends HTMLAttributes<HTMLDivElement>, RefAttributes<HTMLDivElement> {
    scene: Scene;
    step: StepOrderItem;
}

const ReorderableStepItem: React.FC<StepItemProps> = ({ scene, step }) => {
    const classes = useStyles();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: step.id,
    });

    return (
        <StepItem
            ref={setNodeRef}
            scene={scene}
            step={step}
            className={mergeClasses(isDragging && classes.dragging)}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            {...listeners}
            {...attributes}
        />
    );
};

const StepItem: React.FC<StepItemProps> = ({ ref, scene, step, className, ...props }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { dispatch } = useScene();
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [tempName, setTempName] = useState('');

    // 获取当前步骤的名称
    const stepData = scene.steps[step.index];
    const stepText = t('steps.step', { n: getStepText(step.index, stepData?.name) });

    // 处理步骤名称编辑
    const handleOpenEditDialog = () => {
        setTempName(stepData?.name || '');
        setEditDialogOpen(true);
    };

    const handleSaveName = () => {
        const trimmedName = tempName.trim();
        dispatch({
            type: 'updateStepName',
            index: step.index,
            name: trimmedName || undefined,
        });
        setEditDialogOpen(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        handleOpenEditDialog();
    };

    const handleDoubleClick = () => {
        handleOpenEditDialog();
    };

    return (
        <>
            <div
                ref={ref}
                className={mergeClasses(classes.stepItem, className)}
                {...props}
                onContextMenu={handleContextMenu}
                onDoubleClick={handleDoubleClick}
            >
                <div className={mergeClasses(classes.stepHeader, classes.clickableStepHeader)}>{stepText}</div>
                <ScenePreview
                    scene={scene}
                    stepIndex={step.index}
                    width={PREVIEW_SIZE}
                    height={PREVIEW_SIZE}
                    backgroundColor="transparent"
                    simple
                />
            </div>

            {/* 步骤名称编辑对话框 */}
            <Dialog open={editDialogOpen} onOpenChange={(e, data) => setEditDialogOpen(data.open)}>
                <DialogSurface>
                    <DialogTitle>{t('steps.editStepName')}</DialogTitle>
                    <DialogContent>
                        <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            placeholder={t('steps.stepNamePlaceholder')}
                            className={classes.nameInput}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSaveName();
                                } else if (e.key === 'Escape') {
                                    setEditDialogOpen(false);
                                }
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleSaveName}>{t('actions.apply')}</Button>
                        <Button onClick={() => setEditDialogOpen(false)}>{t('actions.cancel')}</Button>
                    </DialogActions>
                </DialogSurface>
            </Dialog>
        </>
    );
};

const useStyles = makeStyles({
    root: {
        gridArea: 'steps',
        display: 'flex',
        flexFlow: 'row',
        columnGap: tokens.spacingHorizontalXS,
        backgroundColor: tokens.colorNeutralBackground2,
        minWidth: MIN_STAGE_WIDTH,
    },
    listWrapper: {
        overflow: 'auto',
        padding: '4px 0 4px 4px',
    },
    actions: {
        display: 'flex',
        columnGap: tokens.spacingHorizontalXS,
        marginTop: '4px',
        height: '32px',
        flexShrink: 0,
        flexGrow: 1,
    },
    addButton: {
        marginRight: 'auto',
    },
    tabList: {
        flexWrap: 'wrap',
    },
    tab: {
        minWidth: '16px',
        userSelect: 'none',
        cursor: 'context-menu',
    },
    nameInput: {
        width: '88%',
        padding: '8px',
        margin: '20px',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        fontSize: '14px',
        outline: 'none',
    },

    dialogSurface: {
        maxWidth: 'calc(min(1050px, 100% - 50px))',
    },

    dialogContent: {
        display: 'flex',
        flexFlow: 'column',
        gap: tokens.spacingVerticalS,
        paddingBottom: tokens.spacingVerticalS,
    },

    dialogList: {
        display: 'flex',
        flexFlow: 'row wrap',
        maxHeight: '80vh',
        overflowX: 'hidden',
        overflowY: 'auto',
        scrollbarGutter: 'stable',
        padding: tokens.spacingHorizontalM,
        columnGap: tokens.spacingHorizontalM,
        rowGap: tokens.spacingVerticalL,
        background: tokens.colorNeutralBackground3,
        borderRadius: tokens.borderRadiusLarge,
    },

    stepItem: {
        display: 'flex',
        flexFlow: 'column',

        width: `${PREVIEW_SIZE + 2}px`,
        listStyle: 'none',
        boxSizing: 'border-box',
        border: `${tokens.strokeWidthThin} solid transparent`,
        borderRadius: tokens.borderRadiusLarge,

        transitionProperty: 'background, border, color',
        transitionDuration: tokens.durationFaster,
        transitionTimingFunction: tokens.curveEasyEase,

        ':hover': {
            backgroundColor: tokens.colorSubtleBackgroundHover,
        },
        ':hover:active': {
            backgroundColor: tokens.colorSubtleBackgroundPressed,
        },
    },

    stepHeader: {
        textAlign: 'center',
        marginTop: tokens.spacingVerticalS,
        marginBottom: '-10px',
        paddingInlineStart: tokens.spacingHorizontalS,
        paddingInlineEnd: tokens.spacingHorizontalS,
        ...typographyStyles.body2,
    },

    clickableStepHeader: {
        cursor: 'pointer',
        '&:hover': {
            textDecoration: 'underline',
        },
    },

    dragging: {
        zIndex: 1,
        backgroundColor: tokens.colorSubtleBackgroundPressed,
    },
});
