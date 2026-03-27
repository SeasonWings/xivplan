import Konva from 'konva';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './i18n';
import './index.css';
import { initCosConfig } from './util/cos';

Konva.angleDeg = true;

// 初始化 COS 配置
initCosConfig();

const container = document.getElementById('root');
if (!container) {
    throw new Error('Missing #root element');
}

const root = createRoot(container);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
