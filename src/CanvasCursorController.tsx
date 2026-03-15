import React, { useEffect } from 'react';
import { CANVAS_CLICK_POINTER_CURSOR, CANVAS_POINTER_CURSOR } from './cursorIcon';
import { useStage } from './render/stage';

export const CanvasCursorController: React.FC = () => {
    const stage = useStage();

    useEffect(() => {
        const container = stage?.container();
        if (!container) return;

        if (!container.style.cursor) {
            container.style.cursor = CANVAS_POINTER_CURSOR;
        }

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (container.style.cursor === CANVAS_POINTER_CURSOR) {
                container.style.cursor = CANVAS_CLICK_POINTER_CURSOR;
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (container.style.cursor === CANVAS_CLICK_POINTER_CURSOR) {
                container.style.cursor = CANVAS_POINTER_CURSOR;
            }
        };

        const onBlur = () => {
            if (container.style.cursor === CANVAS_CLICK_POINTER_CURSOR) {
                container.style.cursor = CANVAS_POINTER_CURSOR;
            }
        };

        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onBlur);

        return () => {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onBlur);
        };
    }, [stage]);

    return null;
};
