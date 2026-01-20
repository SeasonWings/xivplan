// PWA类型定义
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

interface Navigator {
    standalone?: boolean; // iOS Safari
}

interface Window {
    // 添加可能需要的PWA相关属性
    deferredPrompt?: BeforeInstallPromptEvent;
}
