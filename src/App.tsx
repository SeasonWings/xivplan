import { makeStyles, Spinner, Toaster, tokens } from '@fluentui/react-components';
import React, { PropsWithChildren, Suspense } from 'react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { createBrowserRouter, createRoutesFromElements, Outlet, Route, RouterProvider } from 'react-router-dom';
import { AdminDashboard } from './admin/AdminDashboard';
import { AnimationProvider } from './animation/AnimationContext';
import { AnimationV2Provider } from './animation/AnimationV2Context';
import { AuthProvider } from './auth/AuthContext';
import { CollaborationProvider } from './collaboration/CollaborationProvider';
import { DirtyProvider } from './DirtyProvider';
import { EditActivityProvider } from './EditActivityContext';
import { useSceneFromUrl } from './file/share';
import { FileOpenPage } from './FileOpenPage';
import { HelpProvider } from './HelpProvider';
import { MainPage } from './MainPage';
import { SceneProvider } from './SceneProvider';
import { SiteHeader } from './SiteHeader';
import { ThemeProvider } from './ThemeProvider';
import { TutorialProvider } from './tutorial/TutorialProvider';
import { useFileLoaderDropTarget } from './useFileLoader';
import { HotkeyScopes } from './useHotkeys';

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
        <AuthProvider>
            <HotkeysProvider initiallyActiveScopes={[HotkeyScopes.Default, HotkeyScopes.AlwaysEnabled]}>
                <HelpProvider>
                    <TutorialProvider>
                        <SceneProvider initialScene={sceneFromUrl}>
                            <EditActivityProvider>
                                <CollaborationProvider>
                                    <AnimationProvider>
                                        <AnimationV2Provider>
                                            <DirtyProvider>{children}</DirtyProvider>
                                        </AnimationV2Provider>
                                    </AnimationProvider>
                                </CollaborationProvider>
                            </EditActivityProvider>
                        </SceneProvider>
                    </TutorialProvider>
                </HelpProvider>
            </HotkeysProvider>
        </AuthProvider>
    );
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
            <Route path="admin" element={<AdminDashboard />} />
        </Route>,
    ),
);

export const App: React.FC = () => {
    return <RouterProvider router={router} />;
};
