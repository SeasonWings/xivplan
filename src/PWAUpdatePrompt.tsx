import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button, Toast, ToastTitle, Toaster, useToastController, useId } from '@fluentui/react-components';
import { ArrowSyncRegular } from '@fluentui/react-icons';

/**
 * PWA Update Prompt Component
 * Shows a toast notification when a new version is available
 */
export function PWAUpdatePrompt() {
    const toasterId = useId('pwa-toaster');
    const { dispatchToast } = useToastController(toasterId);
    const [, setShowReload] = useState(false);

    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            setShowReload(true);
            dispatchToast(
                <Toast>
                    <ToastTitle
                        action={
                            <Button
                                appearance="primary"
                                icon={<ArrowSyncRegular />}
                                onClick={() => {
                                    updateServiceWorker(true);
                                }}
                            >
                                更新
                            </Button>
                        }
                    >
                        发现新版本,点击更新以获取最新功能
                    </ToastTitle>
                </Toast>,
                { intent: 'info', timeout: -1 },
            );
        }
    }, [needRefresh, dispatchToast, updateServiceWorker]);

    return <Toaster toasterId={toasterId} position="bottom-end" />;
}
