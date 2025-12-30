import { makeStyles, tokens } from '@fluentui/react-components';
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
import { useIsDirty } from './useIsDirty';
import { removeFileExtension } from './util';
import CollaborationPanel from './collaboration/CollaborationPanel';
import { TutorialOverlay } from './tutorial/TutorialOverlay';

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
    const [showCollaborationPanel, setShowCollaborationPanel] = useState(false);
    const [showAnimationPanel, setShowAnimationPanel] = useState(false);
    const [animationPanelWidth, setAnimationPanelWidth] = useState(400);
    const [isDragging, setIsDragging] = useState(false);

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

            {/* TODO: make panel collapsable */}
            <MainPanel />

            <StepSelect />

            <div className={showCollaborationPanel ? classes.stageWithCollaboration : classes.stage}>
                <SceneRenderer />
            </div>

            {/* TODO: make panel collapsable */}
            <DetailsPanel />

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
