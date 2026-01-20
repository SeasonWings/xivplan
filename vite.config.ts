import react from '@vitejs/plugin-react';
import { UserConfig, defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import svgr from 'vite-plugin-svgr';

function getModeOptions(mode: string): UserConfig {
    if (mode === 'production') {
        return {};
    }

    return {
        esbuild: {
            minifyIdentifiers: false,
        },
    };
}

function getEnvOptions(mode: string): UserConfig {
    const env = loadEnv(mode, process.cwd());

    if (env.VITE_PROFILE !== '0') {
        return {
            resolve: {
                alias: {
                    'react-dom$': 'react-dom/profiling',
                },
            },
        };
    }

    return {};
}

export default defineConfig(({ mode }) => ({
    ...getModeOptions(mode),
    ...getEnvOptions(mode),
    plugins: [
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        svgr({
            svgrOptions: {
                plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
                svgoConfig: {
                    floatPrecision: 2,
                    plugins: [
                        {
                            name: 'preset-default',
                            params: {
                                overrides: {
                                    removeViewBox: false,
                                },
                            },
                        },
                        'prefixIds',
                    ],
                },
            },
        }),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'robots.txt'],
            manifest: {
                name: 'FFXIV Raid Planner',
                short_name: 'XIVPlan',
                description: 'A tool for diagramming raid strategies for Final Fantasy XIV',
                theme_color: '#1e1e1e',
                background_color: '#1e1e1e',
                display: 'standalone',
                orientation: 'any',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: '/pwa-64x64.png',
                        sizes: '64x64',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
                categories: ['games', 'utilities'],
            },
            workbox: {
                // 允许缓存最大 5 MiB 的文件（单位：字节）
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                            },
                        },
                    },
                ],
            },
            devOptions: {
                enabled: true,
            },
        }),
    ],
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                // Group large vendor libraries into separate chunks to improve caching and reduce the size of the initial application chunk.
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
                    fluentui: [
                        '@fluentui/react-components',
                        '@fluentui/react-icons',
                        '@fluentui/react-icons-mdl2',
                        '@fluentui-contrib/react-virtualizer',
                    ],
                    konva: ['konva', 'react-konva', 'react-konva-utils'],
                },
            },
        },
    },
}));
