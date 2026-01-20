import { useEffect, useState } from 'react';

/**
 * Check if app is running in PWA mode (synchronous)
 */
export function isPWAMode(): boolean {
    if (typeof window === 'undefined') return false;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    const isAndroidStandalone = document.referrer.includes('android-app://');

    return isStandalone || isIOSStandalone || isAndroidStandalone;
}

/**
 * Hook to detect if the app is running in PWA mode
 * @returns boolean indicating if app is in standalone/PWA mode
 */
export function usePWA(): boolean {
    // 使用同步检测初始化,避免首次渲染时值不正确
    const [isPWA, setIsPWA] = useState(() => isPWAMode());

    useEffect(() => {
        // 确保状态与实际模式同步
        const currentMode = isPWAMode();
        if (currentMode !== isPWA) {
            setIsPWA(currentMode);
        }

        // 监听显示模式变化
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = () => {
            setIsPWA(isPWAMode());
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [isPWA]);

    return isPWA;
}
