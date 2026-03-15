import React, { useContext, useEffect, useRef } from 'react';
import { getCursorCss } from './cursorIcon';
import { DarkModeContext } from './ThemeContext';

export const GlobalCursor: React.FC = () => {
    const [darkMode] = useContext(DarkModeContext);
    const prevRef = useRef<{ body: string; html: string } | null>(null);

    useEffect(() => {
        if (!prevRef.current) {
            prevRef.current = {
                body: document.body.style.cursor,
                html: document.documentElement.style.cursor,
            };
        }

        const set = (value: string) => {
            document.body.style.cursor = value;
            document.documentElement.style.cursor = value;
        };

        const color = darkMode ? '#ffffff' : '#000000';
        const defaultCursor = getCursorCss(color, 10, 6, false);
        const clickCursor = getCursorCss(color, 10, 6, true);

        set(defaultCursor);

        const onContextMenu = (e: MouseEvent) => {
            e.preventDefault();
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                set(clickCursor);
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button === 0) {
                set(defaultCursor);
            }
        };

        const onBlur = () => {
            set(defaultCursor);
        };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onBlur);
        window.addEventListener('contextmenu', onContextMenu, true);
        return () => {
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('contextmenu', onContextMenu, true);
            const prev = prevRef.current;
            if (prev) {
                document.body.style.cursor = prev.body;
                document.documentElement.style.cursor = prev.html;
            }
        };
    }, [darkMode]);

    return null;
};
