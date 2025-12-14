import React, { PropsWithChildren, useState } from 'react';
import { defaultTutorialState, TutorialContext } from './TutorialContext';

export const TutorialProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const state = useState(defaultTutorialState);

    return <TutorialContext value={state}>{children}</TutorialContext>;
};
