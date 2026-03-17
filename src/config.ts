/**
 * 应用配置
 * 从环境变量(.env文件)中读取配置项
 * Vite环境变量需要以VITE_前缀开头才能被暴露到客户端代码
 */

/**
 * 根据当前页面协议动态生成 API 基础 URL
 * 如果环境变量中配置的 URL 以 // 开头，则自动使用当前页面的协议
 */
function getApiBaseUrl(): string {
    const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    // 如果 URL 以 // 开头，自动使用当前页面的协议
    if (envUrl.startsWith('//')) {
        const protocol = window.location.protocol; // 'http:' 或 'https:'
        return `${protocol}${envUrl}`;
    }

    // 否则直接使用配置的 URL
    return envUrl;
}

function getNumberEnv(key: string, fallback: number): number {
    const raw = (import.meta.env as Record<string, unknown>)[key];
    if (typeof raw !== 'string') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

export const config = {
    // WebSocket相关配置
    websocket: {
        baseUrl: import.meta.env.VITE_WS_URL || '//localhost:9000',
    },
    // API相关配置
    api: {
        // 后端API基础URL，支持动态协议
        baseUrl: getApiBaseUrl(),
    },
    // 应用配置
    app: {
        title: import.meta.env.VITE_APP_TITLE || 'XIVPlan',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    },
    collaboration: {
        hostSnapshotIntervalMs: getNumberEnv('VITE_COLLAB_HOST_SNAPSHOT_INTERVAL_MS', 2000),
    },
};

export default config;
