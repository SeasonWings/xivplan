import { Button, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { Checkmark24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AnimationPanel } from './animation/AnimationPanel';
import {
    AnimationPanelVisibilityProvider,
    useAnimationPanelVisibility,
} from './animation/AnimationPanelVisibilityContext';
import { AnimationV2Panel } from './animation/AnimationV2Panel';
import { VisualEditProvider, useVisualEdit } from './animation/VisualEditContext';
import CollaborationPanel from './collaboration/CollaborationPanel';
import { CommunityDialog } from './community/CommunityDialog';
import { EditModeProvider } from './EditModeProvider';
import { RegularHotkeyHandler } from './HotkeyHandler';
import { MainToolbar } from './MainToolbar';
import { DetailsPanel } from './panel/DetailsPanel';
import { MainPanel } from './panel/MainPanel';
import { PanelDragProvider } from './PanelDragProvider';
import { SceneRenderer } from './render/SceneRenderer';
import { SceneLoadErrorNotifier } from './SceneLoadErrorNotifier';
import { RotationLockNotifier } from './RotationLockNotifier';
import { useScene } from './SceneProvider';
import { SelectionProvider } from './SelectionProvider';
import { StepSelect } from './StepSelect';
import { MIN_STAGE_WIDTH } from './theme';
import { TutorialOverlay } from './tutorial/TutorialOverlay';
import { useIsDirty } from './useIsDirty';
import { removeFileExtension } from './util';

export const MainPage: React.FC = () => {
    return (
        <EditModeProvider>
            <SelectionProvider>
                <PanelDragProvider>
                    <AnimationPanelVisibilityProvider>
                        <VisualEditProvider>
                            <MainPageContent />
                            <RotationLockNotifier />
                        </VisualEditProvider>
                    </AnimationPanelVisibilityProvider>
                </PanelDragProvider>
            </SelectionProvider>
        </EditModeProvider>
    );
};

const MainPageContent: React.FC = () => {
    const classes = useStyles();
    const title = usePageTitle();
    const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
    const [showCommunityPanel, setShowCommunityPanel] = useState(false);
    const [animationPanelWidth, setAnimationPanelWidth] = useState(400); // 旧版右侧宽度
    const [animationPanelHeight, setAnimationPanelHeight] = useState(300);
    const [isDragging, setIsDragging] = useState(false);
    const [useNewAnimation, setUseNewAnimation] = useState(true); // 默认使用新版

    // 使用动画面板可见性Context
    const { isVisible: showAnimationPanel, setIsVisible: setShowAnimationPanel } = useAnimationPanelVisibility();

    // 使用可视化编辑Context
    const {
        isVisualEditing,
        saveVisualEdit,
        cancelVisualEdit,
        shouldRestoreDialogs,
        setShouldRestoreDialogs,
        pickCallback,
        lastPickedPoint,
    } = useVisualEdit();

    // 使用 ref 来跟踪之前的状态
    const prevShouldRestoreDialogs = useRef(shouldRestoreDialogs);

    // 组件挂载时输出日志
    useEffect(() => {
        // 初始化完成
    }, []);

    // 监听 shouldRestoreDialogs 变化，当从 true 变为 false 时恢复弹窗
    useEffect(() => {
        // 如果之前是 true（悬浮窗模式），现在变为 false（点击了确定/取消），则恢复弹窗
        if (prevShouldRestoreDialogs.current === true && shouldRestoreDialogs === false) {
            // 恢复动画时间线面板
            setShowAnimationPanel(true);
        }
        // 更新 ref 为当前值
        prevShouldRestoreDialogs.current = shouldRestoreDialogs;
    }, [shouldRestoreDialogs, setShowAnimationPanel]);

    const animationHeightAnimRef = useRef<number | null>(null);
    const animationHeightStateRef = useRef(animationPanelHeight);

    useEffect(() => {
        animationHeightStateRef.current = animationPanelHeight;
    }, [animationPanelHeight]);

    const animatePanelHeight = React.useCallback((target: number) => {
        if (animationHeightAnimRef.current !== null) {
            cancelAnimationFrame(animationHeightAnimRef.current);
            animationHeightAnimRef.current = null;
        }

        const from = animationHeightStateRef.current;
        if (from === target) {
            return;
        }

        const duration = 200;
        const start = performance.now();

        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const value = from + (target - from) * eased;
            setAnimationPanelHeight(value);

            if (t < 1) {
                animationHeightAnimRef.current = requestAnimationFrame(step);
            } else {
                animationHeightAnimRef.current = null;
                setAnimationPanelHeight(target);
            }
        };

        animationHeightAnimRef.current = requestAnimationFrame(step);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseMove = React.useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;

            if (useNewAnimation) {
                const newHeight = window.innerHeight - e.clientY;
                setAnimationPanelHeight(Math.max(126, Math.min(800, newHeight)));
            } else {
                // 旧版动画：横向向左拖拽，调整宽度
                const collaborationWidth = showCollaborationPanel ? 380 : 0;
                const newWidth = window.innerWidth - e.clientX - collaborationWidth;
                setAnimationPanelWidth(Math.max(300, Math.min(800, newWidth)));
            }
        },
        [isDragging, useNewAnimation, showCollaborationPanel],
    );

    const handleMouseUp = React.useCallback(() => {
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <>
            <title>{title}</title>

            <RegularHotkeyHandler />
            <SceneLoadErrorNotifier />

            <MainToolbar
                showCollaborationPanel={showCollaborationPanel}
                onToggleCollaborationPanel={setShowCollaborationPanel}
                showAnimationPanel={showAnimationPanel}
                onToggleAnimationPanel={setShowAnimationPanel}
                showCommunityPanel={showCommunityPanel}
                onToggleCommunityPanel={setShowCommunityPanel}
            />

            {/* TODO: make panel collapsable */}
            <MainPanel />

            <StepSelect />

            <div className={showCollaborationPanel ? classes.stageWithCollaboration : classes.stage}>
                <SceneRenderer />
            </div>

            {/* TODO: make panel collapsable */}
            <DetailsPanel />

            {/* 动画面板：新版在底部，旧版在右侧 - 使用 CSS 隐藏而不是卸载，以保持弹窗状态 */}
            <div
                className={useNewAnimation ? classes.animationWrapperBottom : classes.animationWrapperRight}
                style={{
                    // 新版：只控制高度，横向自动铺满（left: 0, right: 0）
                    // 旧版：只控制宽度和right位置，纵向自动铺满（height: calc(100vh - 48px)）
                    ...(useNewAnimation
                        ? { height: `${animationPanelHeight}px` }
                        : {
                              width: `${animationPanelWidth}px`,
                              right: showCollaborationPanel ? '380px' : '0',
                          }),
                    // 使用 CSS 隐藏而不是卸载，以保持 EffectEditDialog 的状态
                    display: showAnimationPanel ? 'flex' : 'none',
                }}
            >
                {/* 拖拽手柄：新版在顶部，旧版在左侧 */}
                {useNewAnimation ? (
                    <div className={classes.resizeHandleTop} onMouseDown={handleMouseDown} />
                ) : (
                    <div className={classes.resizeHandleLeft} onMouseDown={handleMouseDown} />
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {/* 动画面板内容 */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        {useNewAnimation ? (
                            <AnimationV2Panel
                                onMinimize={() => animatePanelHeight(126)}
                                onMaximize={() => {
                                    const target = Math.min(600, Math.max(132, Math.round(window.innerHeight * 0.4)));
                                    animatePanelHeight(target);
                                }}
                                onClose={() => setShowAnimationPanel(false)}
                            />
                        ) : (
                            <AnimationPanel />
                        )}
                    </div>
                    {/* 版本切换独立放在弹窗下方 */}
                    <div
                        style={{
                            padding: '4px 0px 4px 8px',
                            borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
                            display: 'flex',
                            gap: '8px',
                            backgroundColor: tokens.colorNeutralBackground2,
                            flexShrink: 0,
                        }}
                    >
                        <Tooltip content="使用新版动画编辑器（推荐）" relationship="label">
                            <Button
                                appearance={useNewAnimation ? 'primary' : 'secondary'}
                                size="small"
                                onClick={() => setUseNewAnimation(true)}
                            >
                                新版 V2
                            </Button>
                        </Tooltip>
                        <Tooltip content="使用旧版动画编辑器" relationship="label">
                            <Button
                                appearance={!useNewAnimation ? 'primary' : 'secondary'}
                                size="small"
                                onClick={() => setUseNewAnimation(false)}
                            >
                                旧版 Legacy
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* 协作面板固定在最右侧 */}
            {showCollaborationPanel && (
                <div className={classes.collaborationWrapper}>
                    <CollaborationPanel />
                </div>
            )}

            {/* 社区弹窗 */}
            <CommunityDialog open={showCommunityPanel} onClose={() => setShowCommunityPanel(false)} />

            {/* 教程覆盖层 */}
            <TutorialOverlay />

            {/* 可视化编辑悬浮气泡 - 独立于对话框 */}
            {isVisualEditing && (
                <div className={classes.floatingBubble}>
                    <div className={classes.bubbleContent}>
                        <div className={classes.bubbleTitle}>{pickCallback ? '正在选择圆心' : '正在编辑节点'}</div>
                        <div className={classes.bubbleHint}>
                            {pickCallback
                                ? lastPickedPoint
                                    ? `已选择圆心：X=${Math.round(lastPickedPoint.x)}, Y=${Math.round(
                                          lastPickedPoint.y,
                                      )}（可继续点击修改）`
                                    : '请在画布上点击选择圆心位置'
                                : '请在画布上拖动对象到目标位置'}
                        </div>
                    </div>
                    <div className={classes.bubbleActions}>
                        <Button
                            appearance="primary"
                            icon={<Checkmark24Regular />}
                            onClick={() => {
                                // 先设置 shouldRestoreDialogs 为 false，确保在 isVisualEditing 变为 false 之前恢复面板
                                setShouldRestoreDialogs(false);
                                // 然后调用 saveVisualEdit，这会将 isVisualEditing 设置为 false
                                saveVisualEdit();
                            }}
                        >
                            确定
                        </Button>
                        <Button
                            appearance="secondary"
                            icon={<Dismiss24Regular />}
                            onClick={() => {
                                // 先设置 shouldRestoreDialogs 为 false，确保在 isVisualEditing 变为 false 之前恢复面板
                                setShouldRestoreDialogs(false);
                                // 然后调用 cancelVisualEdit，这会将 isVisualEditing 设置为 false
                                cancelVisualEdit();
                            }}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};

const TITLE = 'XIVPlan';

function usePageTitle() {
    const { source } = useScene();
    const isDirty = useIsDirty();

    let title = TITLE;
    if (source) {
        title += ': ';
        title += removeFileExtension(source?.name);
    }
    if (isDirty) {
        title += ' ●';
    }
    return title;
}

const useStyles = makeStyles({
    stage: {
        gridArea: 'content',
        display: 'flex',
        flexFlow: 'row',
        justifyContent: 'center',
        overflow: 'auto',
        minWidth: MIN_STAGE_WIDTH,
        backgroundColor: tokens.colorNeutralBackground1,
    },
    stageWithCollaboration: {
        gridArea: 'content',
        display: 'flex',
        flexFlow: 'row',
        justifyContent: 'center',
        overflow: 'auto',
        minWidth: MIN_STAGE_WIDTH,
        backgroundColor: tokens.colorNeutralBackground1,
        // 不挤占其他元素，保持原样
    },
    collaborationWrapper: {
        position: 'fixed',
        top: '48px',
        right: '0',
        height: 'calc(100vh - 48px)',
        zIndex: 100,
    },
    animationWrapperRight: {
        position: 'fixed',
        top: '48px',
        right: '0',
        height: 'calc(100vh - 48px)',
        zIndex: 100,
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow16,
        display: 'flex',
        flexDirection: 'row',
        transition: 'right 0.2s ease',
    },
    animationWrapperBottom: {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        zIndex: 100,
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow16,
        display: 'flex',
        flexDirection: 'column',
    },
    resizeHandleLeft: {
        width: '4px',
        cursor: 'ew-resize',
        backgroundColor: tokens.colorNeutralBackground3,
        '&:hover': {
            backgroundColor: tokens.colorBrandBackground,
        },
        flexShrink: 0,
    },
    resizeHandleTop: {
        height: '4px',
        cursor: 'ns-resize',
        backgroundColor: tokens.colorNeutralBackground3,
        '&:hover': {
            backgroundColor: tokens.colorBrandBackground,
        },
        flexShrink: 0,
    },
    // 可视化编辑悬浮气泡样式
    floatingBubble: {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusLarge,
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
        boxShadow: tokens.shadow16,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        border: `2px solid ${tokens.colorBrandBackground}`,
    },
    bubbleContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
    },
    bubbleTitle: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
    },
    bubbleHint: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
    bubbleActions: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
    },
});
