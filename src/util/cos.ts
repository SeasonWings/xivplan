import config from '../config';

export interface CosConfig {
    baseUrl: string;
    enabled: boolean;
}

// 初始配置为禁用状态
let currentCosConfig: CosConfig = {
    baseUrl: '',
    enabled: false,
};

/**
 * 初始化 COS 配置
 * 仅从后端获取配置，如果失败则不启用 COS 替换
 */
export async function initCosConfig(): Promise<void> {
    try {
        const response = await fetch(`${config.api.baseUrl}/config/cos`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.baseUrl) {
                currentCosConfig = data;
                console.log('COS configuration loaded from backend:', currentCosConfig);
                return;
            }
        }
    } catch (error) {
        console.warn('Failed to fetch COS config from backend:', error);
    }
}

/**
 * 获取当前 COS 配置
 */
export function getCosConfig(): CosConfig {
    return currentCosConfig;
}

/**
 * 重置 COS 配置（仅用于测试）
 */
export function _resetCosConfig(): void {
    currentCosConfig = {
        baseUrl: '',
        enabled: false,
    };
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
