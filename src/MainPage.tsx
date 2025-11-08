import { makeStyles, tokens } from '@fluentui/react-components';
import React, { useState } from 'react';
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

    return (
        <>
            <title>{title}</title>

            <RegularHotkeyHandler />
            <SceneLoadErrorNotifier />

            <MainToolbar
                showCollaborationPanel={showCollaborationPanel}
                onToggleCollaborationPanel={setShowCollaborationPanel}
            />

            {/* TODO: make panel collapsable */}
            <MainPanel />

            <StepSelect />

            <div className={showCollaborationPanel ? classes.stageWithCollaboration : classes.stage}>
                <SceneRenderer />
            </div>

            {/* TODO: make panel collapsable */}
            <DetailsPanel />

            {/* 协作面板从右侧展开 */}
            {showCollaborationPanel && (
                <div className={classes.collaborationWrapper}>
                    <CollaborationPanel />
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
        zIndex: 10,
    },
});
