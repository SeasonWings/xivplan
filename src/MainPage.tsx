import { makeStyles, tokens, Button } from '@fluentui/react-components';
import React, { useState } from 'react';
import { AnimationPanel } from './animation/AnimationPanel';
import { EditModeProvider } from './EditModeProvider';
import { RegularHotkeyHandler } from './HotkeyHandler';
import { MainToolbar } from './MainToolbar';
import { PanelDragProvider } from './PanelDragProvider';
import { SceneLoadErrorNotifier } from './SceneLoadErrorNotifier';
import { useScene } from './SceneProvider';
import { SelectionProvider } from './SelectionProvider';
import { StepSelect } from './StepSelect';
import { DetailsPanel } from './panel/DetailsPanel';
import { MainPanel } from './panel/MainPanel';
import { SceneRenderer } from './render/SceneRenderer';
import { MIN_STAGE_WIDTH } from './theme';
import { getCanvasSize } from './coord'; // 导入 getCanvasSize 函数
import { useIsDirty } from './useIsDirty';
import { removeFileExtension } from './util';
import CollaborationPanel from './collaboration/CollaborationPanel';
import { TutorialOverlay } from './tutorial/TutorialOverlay';
import { usePWA } from './usePWA';
import { ChevronLeft20Regular, ChevronRight20Regular } from '@fluentui/react-icons';

export const MainPage: React.FC = () => {
    return (
        <EditModeProvider>
            <SelectionProvider>
                <PanelDragProvider>
                    <MainPageContent />
                </PanelDragProvider>
            </SelectionProvider>
        </EditModeProvider>
    );
};

const MainPageContent: React.FC = () => {
    const classes = useStyles();
    const title = usePageTitle();
    const isPWA = usePWA();
    const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
    const [showAnimationPanel, setShowAnimationPanel] = useState(false);
    const [animationPanelWidth, setAnimationPanelWidth] = useState(400);
    const [isDragging, setIsDragging] = useState(false);
    const [showLeftPanel, setShowLeftPanel] = useState(true);
    const [showRightPanel, setShowRightPanel] = useState(true);

    // 添加一个状态来存储窗口宽度，以便在缩放计算中使用
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

    // 获取当前场景信息
    const { scene } = useScene();

    // 监听窗口大小变化以更新可用宽度
    React.useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        // 初始化时也设置一次
        setWindowWidth(window.innerWidth);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // 调试日志
    React.useEffect(() => {
        console.log('[PWA Debug] windowWidth:', windowWidth);
        console.log('[PWA Debug] isPWA:', isPWA, 'showLeftPanel:', showLeftPanel, 'showRightPanel:', showRightPanel);
    }, [isPWA, showLeftPanel, showRightPanel, windowWidth]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleMouseMove = React.useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;
            // 计算新宽度时需要考虑协作面板的宽度
            const collaborationWidth = showCollaborationPanel ? 380 : 0;
            const newWidth = window.innerWidth - e.clientX - collaborationWidth;
            setAnimationPanelWidth(Math.max(300, Math.min(800, newWidth)));
        },
        [isDragging, showCollaborationPanel],
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

    // 计算侧边栏宽度，用于挤压场景
    const leftPanelWidth = isPWA && showLeftPanel ? 268 : 0;
    const rightPanelWidth = isPWA && showRightPanel ? 320 : 0;
    const animationPanelRealWidth = showAnimationPanel ? animationPanelWidth : 0;
    const collaborationPanelRealWidth = showCollaborationPanel ? 380 : 0;

    // 计算可用宽度用于场景缩放
    const availableWidth = isPWA
        ? windowWidth - leftPanelWidth - rightPanelWidth - animationPanelRealWidth - collaborationPanelRealWidth
        : windowWidth;

    // 获取场景尺寸
    const sceneSize = scene ? getCanvasSize(scene) : { width: 600, height: 600 }; // 默认尺寸作为后备

    // 根据可用宽度计算缩放比例，使场景适应剩余空间 - 现在基于场景宽度而不是窗口宽度
    const sceneScale = isPWA ? Math.min(1, availableWidth / sceneSize.width) : 1;

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
            />

            {isPWA ? (
                <>
                    {/*左侧控制按钮*/}
                    <div className={classes.leftSidebarControl}>
                        <Button
                            icon={<ChevronLeft20Regular />}
                            onClick={() => setShowLeftPanel(!showLeftPanel)}
                            className={classes.sidebarToggleButton}
                            title={showLeftPanel ? '隐藏左侧面板' : '显示左侧面板'}
                        />
                    </div>

                    {/*右侧控制按钮*/}
                    <div className={classes.rightSidebarControl}>
                        <Button
                            icon={<ChevronRight20Regular />}
                            onClick={() => setShowRightPanel(!showRightPanel)}
                            className={classes.sidebarToggleButton}
                            title={showRightPanel ? '隐藏右侧面板' : '显示右侧面板'}
                        />
                    </div>
                </>
            ) : null}

            {isPWA ? (
                // 左侧面板
                showLeftPanel && (
                    <div className={isPWA ? classes.floatingLeftPanel : classes.leftPanel}>
                        <MainPanel />
                    </div>
                )
            ) : (
                <MainPanel />
            )}

            <StepSelect />

            {isPWA ? (
                <div
                    className={showCollaborationPanel ? classes.stageWithCollaboration : classes.stage}
                    style={{
                        marginLeft: `${leftPanelWidth}px`,
                        marginRight: `${rightPanelWidth + animationPanelRealWidth + collaborationPanelRealWidth}px`,
                        overflow: 'hidden', // 添加overflow hidden防止出现滚动条
                    }}
                >
                    <div
                        className={classes.stageContent}
                        style={{
                            // 根据可用宽度计算缩放比例，使场景适应剩余空间
                            transform: `scale(${sceneScale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        <SceneRenderer />
                    </div>
                </div>
            ) : (
                <div className={showCollaborationPanel ? classes.stageWithCollaboration : classes.stage}>
                    <SceneRenderer />
                </div>
            )}

            {isPWA ? (
                // 右侧面板
                showRightPanel && (
                    <div className={isPWA ? classes.floatingRightPanel : classes.rightPanel}>
                        <DetailsPanel />
                    </div>
                )
            ) : (
                <DetailsPanel />
            )}

            {/* 动画面板从右侧展开，可拖拽调整宽度 */}
            {showAnimationPanel && (
                <div
                    className={classes.animationWrapper}
                    style={{
                        width: `${animationPanelWidth}px`,
                        right: showCollaborationPanel ? '380px' : '0',
                    }}
                >
                    <div className={classes.resizeHandle} onMouseDown={handleMouseDown} />
                    <AnimationPanel />
                </div>
            )}

            {/* 协作面板固定在最右侧 */}
            {showCollaborationPanel && (
                <div className={classes.collaborationWrapper}>
                    <CollaborationPanel />
                </div>
            )}

            {/* 教程覆盖层 */}
            <TutorialOverlay />
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
    leftSidebarControl: {
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        zIndex: 100,
        marginLeft: '5px',
    },

    rightSidebarControl: {
        position: 'absolute',
        top: '50%',
        right: 0,
        transform: 'translateY(-50%)',
        zIndex: 100,
        marginRight: '5px',
    },

    sidebarToggleButton: {
        margin: '2px',
    },

    leftPanel: {
        position: 'fixed',
        left: 0,
        top: '48px',
        height: 'calc(100vh - 48px)',
        width: '268px',
        zIndex: 99,
        backgroundColor: tokens.colorNeutralBackground2,
        boxShadow: tokens.shadow16,
        display: 'flex',
        flexDirection: 'column',
    },

    rightPanel: {
        position: 'fixed',
        right: 0,
        top: '48px',
        height: 'calc(100vh - 48px)',
        width: '320px',
        zIndex: 99,
        backgroundColor: tokens.colorNeutralBackground2,
        boxShadow: tokens.shadow16,
        display: 'flex',
        flexDirection: 'column',
    },

    panelHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: tokens.spacingVerticalMNudge,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },

    panelTitle: {
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase300,
    },

    closeButton: {
        marginLeft: tokens.spacingHorizontalS,
    },

    panelContent: {
        flex: 1,
        overflow: 'auto',
    },

    stage: {
        gridArea: 'content',
        display: 'flex',
        flexFlow: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        overflow: 'auto',
        minWidth: MIN_STAGE_WIDTH,
        backgroundColor: tokens.colorNeutralBackground1,
        position: 'relative',
        transition: 'margin 0.2s ease',
        scrollbarWidth: 'thin',
    },
    stageWithCollaboration: {
        gridArea: 'content',
        display: 'flex',
        flexFlow: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        overflow: 'auto',
        minWidth: MIN_STAGE_WIDTH,
        backgroundColor: tokens.colorNeutralBackground1,
        position: 'relative',
        transition: 'margin 0.2s ease',
        scrollbarWidth: 'thin',
    },
    stageContent: {
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        transition: 'transform 0.2s ease',
    },
    floatingLeftPanel: {
        position: 'fixed',
        left: 0,
        top: '48px',
        height: 'calc(100vh - 48px)',
        width: '268px',
        zIndex: 99,
        backgroundColor: tokens.colorNeutralBackground2,
        boxShadow: tokens.shadow16,
        animation: 'slideInLeft 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform 0.2s ease',
    },
    floatingRightPanel: {
        position: 'fixed',
        right: 0,
        top: '48px',
        height: 'calc(100vh - 48px)',
        width: '320px',
        zIndex: 99,
        backgroundColor: tokens.colorNeutralBackground2,
        boxShadow: tokens.shadow16,
        animation: 'slideInRight 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'right 0.2s ease',
    },
    collaborationWrapper: {
        position: 'fixed',
        top: '48px',
        right: '0',
        bottom: '0',
        width: '380px',
        zIndex: 100,
        overflow: 'hidden',
    },
    animationWrapper: {
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
    resizeHandle: {
        width: '4px',
        cursor: 'ew-resize',
        backgroundColor: tokens.colorNeutralBackground3,
        '&:hover': {
            backgroundColor: tokens.colorBrandBackground,
        },
        flexShrink: 0,
    },
});
