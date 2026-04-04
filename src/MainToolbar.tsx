import {
    Menu,
    MenuButtonProps,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Toolbar,
    ToolbarDivider,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import {
    ArrowDownloadRegular,
    ArrowRedoRegular,
    ArrowUndoRegular,
    Calculator24Regular,
    OpenRegular,
    PeopleRegular,
    PeopleTeamRegular,
    SaveEditRegular,
    SaveRegular,
    VideoRecordingRegular,
} from '@fluentui/react-icons';
import React, { ReactElement, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InPortal } from 'react-reverse-portal';
import { CollapsableSplitButton, CollapsableToolbarButton } from './CollapsableToolbarButton';
import { FileSource, useScene, useSceneUndoRedoPossible, useSetSource } from './SceneProvider';
import { StepScreenshotButton } from './StepScreenshotButton';
import { ToolbarContext } from './ToolbarContext';
import { useCollaboration } from './collaboration/CollaborationProvider';
import { saveFile } from './file';
import { OpenDialog, SaveAsDialog } from './file/FileDialog';
import { ShareDialogButton } from './file/ShareDialogButton';
import { downloadScene, getBlobSource } from './file/blob';
import { DialogOpenContext } from './useCloseDialog';
import { useHotkeys } from './useHotkeys';
import { useIsDirty, useSetSavedState } from './useIsDirty';

const useStyles = makeStyles({
    toolbar: {
        paddingLeft: 0,
        paddingRight: 0,
        backgroundColor: 'transparent',
        boxShadow: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        border: 'none',
    },
    collaborationButton: {
        position: 'relative',
    },
    unreadBadge: {
        position: 'absolute',
        top: '0px',
        right: '60px',
        height: '16px',
        minWidth: '16px',
        paddingLeft: '5px',
        paddingRight: '5px',
        borderRadius: '999px',
        backgroundColor: tokens.colorPaletteRedBorderActive,
        color: tokens.colorNeutralForegroundInverted,
        fontSize: tokens.fontSizeBase100,
        lineHeight: '16px',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 1,
    },
});

interface MainToolbarProps {
    showCollaborationPanel?: boolean;
    onToggleCollaborationPanel?: (show: boolean) => void;
    showAnimationPanel?: boolean;
    onToggleAnimationPanel?: (show: boolean) => void;
    showCommunityPanel?: boolean;
    onToggleCommunityPanel?: (show: boolean) => void;
    showCraftBuilderPanel?: boolean;
    onToggleCraftBuilderPanel?: (show: boolean) => void;
}

export const MainToolbar: React.FC<MainToolbarProps> = ({
    showCollaborationPanel = false,
    onToggleCollaborationPanel,
    showAnimationPanel = false,
    onToggleAnimationPanel,
    showCommunityPanel = false,
    onToggleCommunityPanel,
    showCraftBuilderPanel = false,
    onToggleCraftBuilderPanel,
}) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const toolbarNode = useContext(ToolbarContext);
    const { unreadChatCount } = useCollaboration();
    const { dispatch } = useScene();
    const [undoPossible, redoPossible] = useSceneUndoRedoPossible();
    const [openFileOpen, setOpenFileOpen] = useState(false);

    const undo = () => {
        dispatch({ type: 'undo' });
    };
    const redo = () => {
        dispatch({ type: 'redo' });
    };

    useHotkeys(
        'ctrl+o',
        { category: '2.File', help: t('hotkeys.open') },
        (e) => {
            setOpenFileOpen(true);
            e.preventDefault();
        },
        [setOpenFileOpen],
    );

    return (
        <>
            <DialogOpenContext value={setOpenFileOpen}>
                <OpenDialog open={openFileOpen} onOpenChange={(ev, data) => setOpenFileOpen(data.open)} />
            </DialogOpenContext>

            <InPortal node={toolbarNode}>
                <Toolbar className={classes.toolbar}>
                    {/* <CollapsableToolbarButton icon={<NewRegular />}>{t('toolbar.new')}</CollapsableToolbarButton> */}
                    <CollapsableToolbarButton icon={<OpenRegular />} onClick={() => setOpenFileOpen(true)}>
                        {t('toolbar.open')}
                    </CollapsableToolbarButton>

                    <SaveButton />

                    <CollapsableToolbarButton icon={<ArrowUndoRegular />} onClick={undo} disabled={!undoPossible}>
                        {t('toolbar.undo')}
                    </CollapsableToolbarButton>
                    <CollapsableToolbarButton icon={<ArrowRedoRegular />} onClick={redo} disabled={!redoPossible}>
                        {t('toolbar.redo')}
                    </CollapsableToolbarButton>

                    <ToolbarDivider />

                    <ShareDialogButton>{t('toolbar.share')}</ShareDialogButton>

                    <StepScreenshotButton>{t('toolbar.screenshot')}</StepScreenshotButton>

                    <ToolbarDivider />

                    <CollapsableToolbarButton
                        icon={<PeopleRegular />}
                        onClick={() => onToggleCollaborationPanel?.(!showCollaborationPanel)}
                        className={`${classes.collaborationButton}${showCollaborationPanel ? ' active' : ''}`}
                        data-tutorial="collaboration-open"
                        badge={
                            unreadChatCount > 0 ? (
                                <span className={classes.unreadBadge}>
                                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                                </span>
                            ) : undefined
                        }
                    >
                        {t('toolbar.collaboration')}
                    </CollapsableToolbarButton>

                    <CollapsableToolbarButton
                        icon={<VideoRecordingRegular />}
                        onClick={() => onToggleAnimationPanel?.(!showAnimationPanel)}
                        className={showAnimationPanel ? 'active' : undefined}
                        data-tutorial="animation-open"
                    >
                        {t('toolbar.animation', '动画')}
                    </CollapsableToolbarButton>

                    <CollapsableToolbarButton
                        icon={<PeopleTeamRegular />}
                        onClick={() => onToggleCommunityPanel?.(!showCommunityPanel)}
                        className={showCommunityPanel ? 'active' : undefined}
                    >
                        {t('toolbar.community', '社区')}
                    </CollapsableToolbarButton>

                    <CollapsableToolbarButton
                        icon={<Calculator24Regular />}
                        onClick={() => onToggleCraftBuilderPanel?.(!showCraftBuilderPanel)}
                        className={showCraftBuilderPanel ? 'active' : undefined}
                        data-tutorial="craftbuilder-open"
                    >
                        {t('toolbar.craftBuilder', '生产计算器')}
                    </CollapsableToolbarButton>
                </Toolbar>
            </InPortal>
        </>
    );
};

interface SaveButtonState {
    type: 'save' | 'saveas' | 'download';
    text: string;
    icon: ReactElement;
    disabled?: boolean;
}

function getSaveButtonState(
    source: FileSource | undefined,
    isDirty: boolean,
    t: (key: string) => string,
): SaveButtonState {
    if (!source) {
        return { type: 'saveas', text: t('toolbar.saveAs'), icon: <SaveEditRegular /> };
    }

    if (source.type === 'blob') {
        return { type: 'download', text: t('toolbar.download'), icon: <ArrowDownloadRegular /> };
    }

    return { type: 'save', text: t('toolbar.save'), icon: <SaveRegular />, disabled: !isDirty };
}

const SaveButton: React.FC = () => {
    const { t } = useTranslation();
    const isDirty = useIsDirty();
    const setSavedState = useSetSavedState();
    const [saveAsOpen, setSaveAsOpen] = useState(false);
    const { canonicalScene, source } = useScene();
    const setSource = useSetSource();

    const { type, text, icon, disabled } = getSaveButtonState(source, isDirty, t);

    const save = async () => {
        if (!source) {
            setSaveAsOpen(true);
        } else if (isDirty) {
            await saveFile(canonicalScene, source);
            setSavedState(canonicalScene);
        }
    };

    const download = () => {
        downloadScene(canonicalScene, source?.name);
        if (!source) {
            setSource(getBlobSource());
        }
    };

    const handleClick = () => {
        switch (type) {
            case 'save':
                save();
                break;

            case 'saveas':
                setSaveAsOpen(true);
                break;

            case 'download':
                download();
                break;
        }
    };

    useHotkeys(
        'ctrl+s',
        { category: '2.File', help: t('hotkeys.save') },
        (e) => {
            save();
            e.preventDefault();
        },
        [save],
    );
    useHotkeys(
        'ctrl+shift+s',
        { category: '2.File', help: t('hotkeys.saveAs') },
        (e) => {
            setSaveAsOpen(true);
            e.preventDefault();
        },
        [setSaveAsOpen],
    );

    return (
        <>
            <Menu positioning="below-end">
                <MenuTrigger disableButtonEnhancement>
                    {(triggerProps: MenuButtonProps) => (
                        <CollapsableSplitButton
                            menuButton={triggerProps}
                            primaryActionButton={{ onClick: handleClick, disabled }}
                            icon={icon}
                            appearance="subtle"
                        >
                            {text}
                        </CollapsableSplitButton>
                    )}
                </MenuTrigger>
                <MenuPopover>
                    <MenuList>
                        {type !== 'saveas' && (
                            <MenuItem icon={<SaveEditRegular />} onClick={() => setSaveAsOpen(true)}>
                                {t('toolbar.saveAsEllipsis')}
                            </MenuItem>
                        )}
                        {type !== 'download' && (
                            <MenuItem icon={<ArrowDownloadRegular />} onClick={download}>
                                {t('toolbar.download')}
                            </MenuItem>
                        )}
                    </MenuList>
                </MenuPopover>
            </Menu>
            <DialogOpenContext value={setSaveAsOpen}>
                <SaveAsDialog open={saveAsOpen} onOpenChange={(ev, data) => setSaveAsOpen(data.open)} />
            </DialogOpenContext>
        </>
    );
};
