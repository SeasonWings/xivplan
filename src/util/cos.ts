import { useEffect, useState } from 'react';
import config from '../config';

export interface CosConfig {
    baseUrl: string;
    enabled: boolean;
}

const COS_CONFIG_KEY = 'xivplan_cos_config';

// 尝试从 localStorage 加载初始配置，以便在页面刷新时能立即使用上次的配置
function loadInitialConfig(): CosConfig {
    try {
        const saved = localStorage.getItem(COS_CONFIG_KEY);
        if (saved) {
            const config = JSON.parse(saved);
            if (config && config.baseUrl) {
                return config;
            }
        }
    } catch (e) {
        console.warn('Failed to load COS config from localStorage', e);
    }
    return {
        baseUrl: '',
        enabled: false,
    };
}

// 初始配置
let currentCosConfig: CosConfig = loadInitialConfig();

type Listener = (config: CosConfig) => void;
const listeners = new Set<Listener>();

function notify() {
    for (const listener of listeners) {
        listener(currentCosConfig);
    }
}

/**
 * 初始化 COS 配置
 * 仅从后端获取配置，如果失败则不启用 COS 替换
 */
export async function initCosConfig(): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

    try {
        const response = await fetch(`${config.api.baseUrl}/config/cos`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data && data.baseUrl) {
                currentCosConfig = data;
                // 将最新配置同步到 localStorage
                localStorage.setItem(COS_CONFIG_KEY, JSON.stringify(data));
                console.log('COS configuration loaded from backend and persisted:', currentCosConfig);
                notify();
                return;
            }
        }
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn('COS config fetch timed out');
        } else {
            console.warn('Failed to fetch COS config from backend:', error);
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 获取当前 COS 配置
 */
export function getCosConfig(): CosConfig {
    return currentCosConfig;
}

/**
 * React Hook for using COS config, automatically re-renders when config changes.
 */
export function useCosConfig(): CosConfig {
    const [cfg, setCfg] = useState(currentCosConfig);

    useEffect(() => {
        const listener: Listener = (newCfg) => setCfg({ ...newCfg });
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return cfg;
}

/**
 * 重置 COS 配置（仅用于测试）
 */
export function _resetCosConfig(): void {
    currentCosConfig = {
        baseUrl: '',
        enabled: false,
    };
    notify();
}

/**
 * 将相对路径或本地路径替换为 COS URL
 * @param url 图片原始路径，如 /actor/DRK.png
 * @returns 替换后的 URL
 */
export function wrapImageUrl(url: string | undefined): string {
    if (!url) return '';

    // 如果 URL 已经是完整路径（以 http://, https://, data: 或 blob: 开头），则不处理
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }

    // 如果 COS 未启用或 baseUrl 为空，直接返回原路径
    if (!currentCosConfig.enabled || !currentCosConfig.baseUrl) {
        return url;
    }

    // 去掉开头的 / 以免拼接出两个 /
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    const cleanBaseUrl = currentCosConfig.baseUrl.endsWith('/')
        ? currentCosConfig.baseUrl.substring(0, currentCosConfig.baseUrl.length - 1)
        : currentCosConfig.baseUrl;

    return `${cleanBaseUrl}/${cleanUrl}`;
}
