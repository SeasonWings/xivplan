/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

/**
 * 环境变量类型定义
 */
interface ImportMetaEnv {
    /** API基础URL */
    readonly VITE_API_URL: string;
    /** WebSocket基础URL */
    readonly VITE_WS_URL: string;
    /** 应用标题 */
    readonly VITE_APP_TITLE: string;
    /** 应用版本 */
    readonly VITE_APP_VERSION: string;
    /** 性能分析开关 */
    readonly VITE_PROFILE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
