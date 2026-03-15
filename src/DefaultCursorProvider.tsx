import { PropsWithChildren, useState } from 'react';
import { DefaultCursorContext } from './DefaultCursorContext';
import { CANVAS_POINTER_CURSOR } from './cursorIcon';

export const DefaultCursorProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const state = useState(CANVAS_POINTER_CURSOR);

    return <DefaultCursorContext value={state}>{children}</DefaultCursorContext>;
};
