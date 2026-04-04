import Konva from 'konva';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';
import './index.css';
import { initCosConfig } from './util/cos';

Konva.angleDeg = true;

const container = document.getElementById('root');
if (!container) {
    throw new Error('Missing #root element');
}

const root = createRoot(container);

// 初始化 COS 配置并等待结果，确保首次加载时也能正确使用 COS
initCosConfig().finally(() => {
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
});
