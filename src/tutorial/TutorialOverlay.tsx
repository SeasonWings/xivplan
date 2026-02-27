import { Button, makeStyles, PopoverSurface, tokens, typographyStyles } from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SceneObject } from '../scene';
import { useScene } from '../SceneProvider';
import { toggleSelection, useSelection } from '../selection';
import { SceneSelection } from '../SelectionContext';
import { TutorialActionContext, TutorialContext } from './TutorialContext';

const pulseKeyframes = {
    from: { opacity: 1 },
    '50%': { opacity: 0.5 },
    to: { opacity: 1 },
};

const useStyles = makeStyles({
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9998,
        pointerEvents: 'none',
    },
    spotlight: {
        position: 'absolute',
        borderTopWidth: '2px',
        borderRightWidth: '2px',
        borderBottomWidth: '2px',
        borderLeftWidth: '2px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: tokens.colorBrandForeground1,
        borderRightColor: tokens.colorBrandForeground1,
        borderBottomColor: tokens.colorBrandForeground1,
        borderLeftColor: tokens.colorBrandForeground1,
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.5)`,
        pointerEvents: 'auto',
        transitionProperty: 'all',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
        zIndex: 9999,
    },
    popover: {
        position: 'fixed',
        zIndex: 10000,
        minWidth: '300px',
        maxWidth: '400px',
        pointerEvents: 'auto',
        transitionProperty: 'top, left',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: tokens.spacingVerticalM,
    },
    title: {
        ...typographyStyles.subtitle1,
        margin: 0,
    },
    closeButton: {
        minWidth: 'auto',
    },
    content: {
        ...typographyStyles.body1,
        marginBottom: tokens.spacingVerticalL,
        lineHeight: tokens.lineHeightBase300,
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
    },
    progress: {
        ...typographyStyles.caption1,
        color: tokens.colorNeutralForeground3,
    },
    buttons: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
    },
    highlightedButton: {
        position: 'relative',
        animationName: pulseKeyframes,
        animationDuration: '2s',
        animationIterationCount: 'infinite',
        '&::before': {
            content: '""',
            position: 'absolute',
            top: '-4px',
            left: '-4px',
            right: '-4px',
            bottom: '-4px',
            borderTopWidth: '2px',
            borderRightWidth: '2px',
            borderBottomWidth: '2px',
            borderLeftWidth: '2px',
            borderTopStyle: 'solid',
            borderRightStyle: 'solid',
            borderBottomStyle: 'solid',
            borderLeftStyle: 'solid',
            borderTopColor: tokens.colorBrandForeground1,
            borderRightColor: tokens.colorBrandForeground1,
            borderBottomColor: tokens.colorBrandForeground1,
            borderLeftColor: tokens.colorBrandForeground1,
            borderRadius: tokens.borderRadiusMedium,
            boxShadow: `0 0 12px ${tokens.colorBrandForeground1}`,
            pointerEvents: 'none',
            zIndex: 10001,
        },
    },
});

export const TutorialOverlay: React.FC = () => {
    const classes = useStyles();
    const [tutorialState, setTutorialState] = useContext(TutorialContext);
    const { dispatch, step } = useScene();
    const [selection, setSelection] = useSelection();
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const popoverRef = useRef<HTMLDivElement>(null);
    const originalObjectsRef = useRef<typeof step.objects | null>(null);
    const isFirstDemoRef = useRef(true); // 跟踪是否是第一次添加演示
    const [isActionRunning, setIsActionRunning] = useState(false); // 添加状态跟踪action是否正在运行

    const { isActive, currentStepIndex, steps } = tutorialState;
    const currentStep = steps[currentStepIndex];

    // 监听 selection 变化（用于调试）
    useEffect(() => {
        // console.log('[TutorialOverlay] Selection changed, size:', selection.size, 'ids:', Array.from(selection));
    }, [selection]);

    // 创建稳定的 setSelection 回调
    const handleSetSelection = useCallback(
        (newSelection: SceneSelection) => {
            setSelection(() => newSelection);
        },
        [setSelection],
    );

    // 创建稳定的 updateSpotlight 回调
    const handleUpdateSpotlight = useCallback((selector: string) => {
        const targetElement = document.querySelector(selector);
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            console.log('[TutorialOverlay] updateSpotlight', rect);
            setSpotlightRect(rect);
        } else {
            setSpotlightRect(null);
        }
    }, []);

    // 创建稳定的 toggleSelection 回调
    const handleToggleSelection = useCallback((currentSelection: SceneSelection, id: number) => {
        return toggleSelection(currentSelection, id);
    }, []);

    // 创建 action context
    const actionContextRef = useRef<TutorialActionContext>({
        getSceneObjects: () => step.objects,
        setSelection: handleSetSelection,
        toggleSelection: handleToggleSelection,
    });

    // 更新 actionContext ref
    useEffect(() => {
        actionContextRef.current = {
            getSceneObjects: () => step.objects,
            setSelection: handleSetSelection,
            toggleSelection: handleToggleSelection,
            // 提供finishAction回调，允许action主动通知完成
            finishAction: () => {
                setIsActionRunning(false);
            },
            // 提供updateSpotlight方法，允许action更新高亮元素范围
            updateSpotlight: handleUpdateSpotlight,
        };
    }, [step.objects, handleSetSelection, handleToggleSelection, handleUpdateSpotlight]);

    // 处理演示对象的添加和移除
    useEffect(() => {
        if (!isActive) {
            // 教程结束时，恢复原始对象
            if (originalObjectsRef.current) {
                dispatch({ type: 'replace', value: originalObjectsRef.current as SceneObject[] });
                originalObjectsRef.current = null;
                isFirstDemoRef.current = true;
            }
            return;
        }

        if (currentStep?.demoObjects) {
            // 第一次添加演示对象时，保存原始对象
            if (isFirstDemoRef.current) {
                originalObjectsRef.current = step.objects;
                isFirstDemoRef.current = false;
            }

            console.log(
                '[TutorialOverlay] Replacing objects with demo objects, count:',
                currentStep.demoObjects.length,
            );
            // 添加演示对象
            dispatch({ type: 'replace', value: currentStep.demoObjects as SceneObject[] });
        }
        // 移除 step.objects 依赖，避免无限循环
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, currentStepIndex, dispatch, currentStep]);

    // 单独的 effect 处理 action 执行，在对象更新后触发
    useEffect(() => {
        if (!isActive || !currentStep?.demoObjects || !currentStep.action || !currentStep.autoAction) {
            return;
        }

        // 如果action已经在运行，则不重复执行
        if (isActionRunning) {
            return;
        }

        // 检查 demo 对象是否已经被添加到 step 中
        const demoObjectIds = currentStep.demoObjects.map((obj) => obj.id);
        const allDemoObjectsPresent = demoObjectIds.every((id) => step.objects.some((obj) => obj.id === id));

        if (allDemoObjectsPresent) {
            // 设置action运行状态为true
            setIsActionRunning(true);

            // 使用 setTimeout 确保 React 完成渲染
            const timeoutId = setTimeout(() => {
                currentStep.action!(actionContextRef.current);
                // 对于没有主动调用finishAction的action，我们增加一个额外的延迟以确保完成
                setTimeout(() => {
                    if (isActionRunning) {
                        setIsActionRunning(false);
                    }
                }, 5000); // 1秒后自动关闭，作为兜底机制
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [isActive, currentStep, step.objects, isActionRunning]);

    // 处理按钮高亮
    useEffect(() => {
        if (!isActive || !currentStep?.highlightButton) {
            return;
        }

        const buttonElement = document.querySelector(currentStep.highlightButton);
        if (buttonElement && buttonElement instanceof HTMLElement) {
            // 添加一个自定义属性来标记高亮状态
            buttonElement.setAttribute('data-tutorial-highlight', 'true');
            // 使用 className 直接添加类名字符串
            const originalClassName = buttonElement.className;
            buttonElement.className = `${originalClassName} ${classes.highlightedButton}`;

            return () => {
                buttonElement.removeAttribute('data-tutorial-highlight');
                buttonElement.className = originalClassName;
            };
        }
    }, [isActive, currentStepIndex, currentStep, classes.highlightedButton]);

    // 在 popover 渲染后立即更新位置（使用 layoutEffect 以避免闪烁）
    useLayoutEffect(() => {
        if (!isActive || !currentStep || !popoverRef.current) {
            return;
        }

        const targetElement = document.querySelector(currentStep.target);
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const placement = currentStep.placement || 'bottom';
            const padding = 16;

            const popoverElement = popoverRef.current;
            const popoverWidth = popoverElement.offsetWidth;
            const popoverHeight = popoverElement.offsetHeight;

            let top = 0;
            let left = 0;

            switch (placement) {
                case 'top':
                    top = rect.top - popoverHeight - padding;
                    left = rect.left + rect.width / 2 - popoverWidth / 2;
                    break;
                case 'bottom':
                    top = rect.bottom + padding;
                    left = rect.left + rect.width / 2 - popoverWidth / 2;
                    break;
                case 'left':
                    top = rect.top + rect.height / 2 - popoverHeight / 2;
                    left = rect.left - popoverWidth - padding;
                    break;
                case 'right':
                    top = rect.top + rect.height / 2 - popoverHeight / 2;
                    left = rect.right + padding;
                    break;
            }

            const maxTop = window.innerHeight - popoverHeight - padding;
            const maxLeft = window.innerWidth - popoverWidth - padding;

            top = Math.max(padding, Math.min(top, maxTop));
            left = Math.max(padding, Math.min(left, maxLeft));

            setPopoverPosition({ top, left });
        }
    }, [isActive, currentStep, spotlightRect]);

    useEffect(() => {
        if (!isActive || !currentStep) {
            return;
        }

        const updatePosition = () => {
            const targetElement = document.querySelector(currentStep.target);
            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                setSpotlightRect(rect);

                // 计算popover位置
                const placement = currentStep.placement || 'bottom';
                const padding = 16;

                // 使用实际的 popover 尺寸，如果还未渲染则使用估计值
                const popoverElement = popoverRef.current;
                const popoverWidth = popoverElement?.offsetWidth || 350;
                const popoverHeight = popoverElement?.offsetHeight || 200;

                let top = 0;
                let left = 0;

                switch (placement) {
                    case 'top':
                        top = rect.top - popoverHeight - padding;
                        left = rect.left + rect.width / 2 - popoverWidth / 2;
                        break;
                    case 'bottom':
                        top = rect.bottom + padding;
                        left = rect.left + rect.width / 2 - popoverWidth / 2;
                        break;
                    case 'left':
                        top = rect.top + rect.height / 2 - popoverHeight / 2;
                        left = rect.left - popoverWidth - padding;
                        break;
                    case 'right':
                        top = rect.top + rect.height / 2 - popoverHeight / 2;
                        left = rect.right + padding;
                        break;
                }

                // 确保popover不会超出屏幕边界
                const maxTop = window.innerHeight - popoverHeight - padding;
                const maxLeft = window.innerWidth - popoverWidth - padding;

                top = Math.max(padding, Math.min(top, maxTop));
                left = Math.max(padding, Math.min(left, maxLeft));

                setPopoverPosition({ top, left });
            }
        };

        // 初始更新
        updatePosition();

        // 使用 setTimeout 确保 popover 渲染后再次更新位置
        const timeoutId = setTimeout(updatePosition, 0);

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isActive, currentStep]);

    const handleNext = () => {
        // 如果action正在运行，不允许点击下一步
        if (isActionRunning) {
            return;
        }

        if (currentStepIndex < steps.length - 1) {
            setTutorialState((prev) => ({
                ...prev,
                currentStepIndex: prev.currentStepIndex + 1,
            }));
        } else {
            handleClose();
        }
    };

    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            setTutorialState((prev) => ({
                ...prev,
                currentStepIndex: prev.currentStepIndex - 1,
            }));
        }
    };

    const handleClose = () => {
        setTutorialState((prev) => ({
            ...prev,
            isActive: false,
            currentStepIndex: 0,
        }));
    };

    if (!isActive || !currentStep) {
        return null;
    }

    return (
        <>
            {/* 遮罩层 */}
            <div className={classes.overlay} />

            {/* 聚光灯 - 只有当找到目标元素时才显示 */}
            {spotlightRect && (
                <div
                    className={classes.spotlight}
                    style={{
                        top: spotlightRect.top,
                        left: spotlightRect.left,
                        width: spotlightRect.width,
                        height: spotlightRect.height,
                    }}
                />
            )}

            {/* 教程内容弹窗 */}
            <PopoverSurface
                ref={popoverRef}
                className={classes.popover}
                style={{
                    top: `${popoverPosition.top}px`,
                    left: `${popoverPosition.left}px`,
                }}
            >
                <div className={classes.header}>
                    <h3 className={classes.title}>{currentStep.title}</h3>
                    <Button
                        appearance="subtle"
                        icon={<Dismiss24Regular />}
                        className={classes.closeButton}
                        onClick={handleClose}
                    />
                </div>
                <div className={classes.content}>{currentStep.content}</div>
                <div className={classes.footer}>
                    <div className={classes.progress}>
                        {currentStepIndex + 1} / {steps.length}
                    </div>
                    <div className={classes.buttons}>
                        {currentStepIndex > 0 && (
                            <Button appearance="secondary" onClick={handlePrevious}>
                                上一步
                            </Button>
                        )}
                        <Button
                            appearance="primary"
                            onClick={handleNext}
                            disabled={isActionRunning} // 当action正在运行时禁用按钮
                        >
                            {currentStepIndex < steps.length - 1 ? '下一步' : '完成'}
                        </Button>
                    </div>
                </div>
            </PopoverSurface>
        </>
    );
};
