import React, { createContext, useCallback, useContext, useState } from 'react';

interface AnimationPanelVisibilityContextType {
    isVisible: boolean;
    setIsVisible: (visible: boolean) => void;
    hidePanel: () => void;
    showPanel: () => void;
}

const AnimationPanelVisibilityContext = createContext<AnimationPanelVisibilityContextType | undefined>(undefined);

export const AnimationPanelVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVisible, setIsVisible] = useState(false);

    const hidePanel = useCallback(() => {
        setIsVisible(false);
    }, []);

    const showPanel = useCallback(() => {
        setIsVisible(true);
    }, []);

    return (
        <AnimationPanelVisibilityContext.Provider value={{ isVisible, setIsVisible, hidePanel, showPanel }}>
            {children}
        </AnimationPanelVisibilityContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAnimationPanelVisibility = () => {
    const context = useContext(AnimationPanelVisibilityContext);
    if (context === undefined) {
        throw new Error('useAnimationPanelVisibility must be used within an AnimationPanelVisibilityProvider');
    }
    return context;
};
