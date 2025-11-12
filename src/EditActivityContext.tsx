import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

interface EditActivityContextType {
    isActiveEdit: boolean;
    setActiveEdit: (active: boolean) => void;
    startEditActivity: () => void;
    endEditActivity: () => void;
}

const EditActivityContext = createContext<EditActivityContextType | undefined>(undefined);

export const useEditActivity = () => {
    const context = useContext(EditActivityContext);
    if (context === undefined) {
        throw new Error('useEditActivity must be used within an EditActivityProvider');
    }
    return context;
};

interface EditActivityProviderProps {
    children: ReactNode;
}

export const EditActivityProvider: React.FC<EditActivityProviderProps> = ({ children }) => {
    // 初始状态设为false，避免组件首次加载时意外发送更新
    const [isActiveEdit, setActiveEdit] = useState(false);

    // 开始编辑活动
    const startEditActivity = useCallback(() => {
        console.log('[编辑活动] 开始编辑操作');
        setActiveEdit(true);
    }, []);

    // 结束编辑活动
    const endEditActivity = useCallback(() => {
        console.log('[编辑活动] 结束编辑操作');
        setActiveEdit(false);
    }, []);

    const value = {
        isActiveEdit,
        setActiveEdit,
        startEditActivity,
        endEditActivity,
    };

    return <EditActivityContext.Provider value={value}>{children}</EditActivityContext.Provider>;
};
