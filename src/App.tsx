import { makeStyles, Spinner, Toaster, tokens } from '@fluentui/react-components';
import React, { PropsWithChildren, Suspense, useEffect } from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import {
    createBrowserRouter,
    createRoutesFromElements,
    Outlet,
    Route,
    RouterProvider,
    useSearchParams,
} from 'react-router-dom';
import { DirtyProvider } from './DirtyProvider';
import { useSceneFromUrl } from './file/share';
import { FileOpenPage } from './FileOpenPage';
import { HelpProvider } from './HelpProvider';
import { MainPage } from './MainPage';
import { SceneProvider } from './SceneProvider';
import { SiteHeader } from './SiteHeader';
import { ThemeProvider } from './ThemeProvider';
import { useFileLoaderDropTarget } from './useFileLoader';
import { HotkeyScopes } from './useHotkeys';
import { CollaborationProvider, useCollaboration } from './collaboration/CollaborationProvider';

const useStyles = makeStyles({
    root: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'grid',
        gridTemplateColumns: `auto minmax(400px, auto) 1fr`,
        gridTemplateRows: `min-content min-content 1fr`,
        gridTemplateAreas: `
                "header     header  header"
                "left-panel steps   right-panel"
                "left-panel content right-panel"
            `,

        background: tokens.colorNeutralBackground3,
    },
    header: {
        gridArea: 'header',
    },

    loading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: tokens.colorNeutralBackground3,
    },
});

const BaseProviders: React.FC<PropsWithChildren> = ({ children }) => {
    const sceneFromUrl = useSceneFromUrl();

    return (
        <HotkeysProvider initiallyActiveScopes={[HotkeyScopes.Default, HotkeyScopes.AlwaysEnabled]}>
            <HelpProvider>
                <SceneProvider initialScene={sceneFromUrl}>
                    <CollaborationProvider>
                        <RoomParamsHandler>
                            <DirtyProvider>{children}</DirtyProvider>
                        </RoomParamsHandler>
                    </CollaborationProvider>
                </SceneProvider>
            </HelpProvider>
        </HotkeysProvider>
    );
};

// 处理URL中的房间参数
const RoomParamsHandler: React.FC<PropsWithChildren> = ({ children }) => {
    const [searchParams] = useSearchParams();
    const { joinRoom } = useCollaboration();
    const roomId = searchParams.get('room');

    useEffect(() => {
        if (roomId) {
            joinRoom(roomId).catch((error) => {
                console.error('自动加入房间失败:', error);
            });
        }
    }, [roomId, joinRoom]);

    return <>{children}</>;
};

const LoadingFallback: React.FC = () => {
    const classes = useStyles();

    return (
        <div className={classes.loading}>
            <p>Fetching plan</p>
            <Spinner />
        </div>
    );
};

const Layout: React.FC = () => {
    return (
        <ThemeProvider>
            <Suspense fallback={<LoadingFallback />}>
                <BaseProviders>
                    <Root />
                </BaseProviders>
            </Suspense>
        </ThemeProvider>
    );
};

const Root: React.FC = () => {
    const classes = useStyles();
    const { onDragOver, onDrop, renderModal } = useFileLoaderDropTarget();

    return (
        <>
            <div className={classes.root} onDragOver={onDragOver} onDrop={onDrop}>
                <Toaster position="top" />
                <SiteHeader className={classes.header} />
                <Outlet />
            </div>
            {renderModal()}
        </>
    );
};

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<Layout />}>
            <Route index element={<MainPage />} />
            <Route path="open" element={<FileOpenPage />} />
        </Route>,
    ),
);

export const App: React.FC = () => {
    return <RouterProvider router={router} />;
};
