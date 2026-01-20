import Konva from 'konva';
import React, { useEffect, useRef } from 'react';
import { Group, KonvaNodeEvents } from 'react-konva';
import { useDefaultCursor } from './cursor';
import { useStage } from './render/stage';

export interface CursorGroupProps extends Konva.NodeConfig, KonvaNodeEvents {
    cursor?: string;
}

export const CursorGroup: React.FC<CursorGroupProps> = ({ cursor, children, ...props }) => {
    const [defaultCursor] = useDefaultCursor();
    const stage = useStage();
    const isMouseOverRef = useRef(false);

    const setCursor = (cursor?: string) => {
        if (stage && cursor) {
            stage.container().style.cursor = cursor;
        }
    };

    // 当组件卸载时（如删除元素），如果鼠标在元素上，重置cursor
    useEffect(() => {
        return () => {
            if (isMouseOverRef.current && stage) {
                stage.container().style.cursor = defaultCursor;
            }
        };
    }, [stage, defaultCursor]);

    const handleMouseEnter = () => {
        isMouseOverRef.current = true;
        setCursor(cursor);
    };

    const handleMouseLeave = () => {
        isMouseOverRef.current = false;
        setCursor(defaultCursor);
    };

    return (
        <Group onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
            {children}
        </Group>
    );
};
