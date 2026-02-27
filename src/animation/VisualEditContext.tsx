import React, { createContext, useCallback, useContext, useState } from 'react';

interface VisualEditContextType {
    isVisualEditing: boolean;
    editingObjectId: number | null; // 当前编辑的对象ID
    startVisualEdit: (onSave?: () => void, onCancel?: () => void, objectId?: number) => void;
    endVisualEdit: () => void;
    saveVisualEdit: () => void;
    cancelVisualEdit: () => void;
    // 控制效果编辑弹窗和时间线弹窗的显隐
    shouldRestoreDialogs: boolean;
    setShouldRestoreDialogs: (value: boolean) => void;
    pickCallback: ((point: { x: number; y: number }) => void) | null;
    setPickCallback: (cb: ((point: { x: number; y: number }) => void) | null) => void;
    lastPickedPoint: { x: number; y: number } | null;
    setLastPickedPoint: (point: { x: number; y: number } | null) => void;
}

const VisualEditContext = createContext<VisualEditContextType | undefined>(undefined);

export const VisualEditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVisualEditing, setIsVisualEditing] = useState(false);
    const [editingObjectId, setEditingObjectId] = useState<number | null>(null);
    const [onSaveCallback, setOnSaveCallback] = useState<(() => void) | null>(null);
    const [onCancelCallback, setOnCancelCallback] = useState<(() => void) | null>(null);
    // 标记是否需要恢复弹窗（用于在悬浮窗关闭后恢复效果编辑弹窗和时间线）
    const [shouldRestoreDialogs, setShouldRestoreDialogs] = useState(false);
    const [pickCallback, setPickCallbackState] = useState<((point: { x: number; y: number }) => void) | null>(null);
    const [lastPickedPoint, setLastPickedPointState] = useState<{ x: number; y: number } | null>(null);

    const startVisualEdit = useCallback((onSave?: () => void, onCancel?: () => void, objectId?: number) => {
        setIsVisualEditing(true);
        setEditingObjectId(objectId ?? null);
        setShouldRestoreDialogs(true);
        setOnSaveCallback(() => onSave || null);
        setOnCancelCallback(() => onCancel || null);
    }, []);

    const endVisualEdit = useCallback(() => {
        setIsVisualEditing(false);
        setEditingObjectId(null);
        // 注意：这里不重置 shouldRestoreDialogs，让调用方决定何时重置
        setOnSaveCallback(null);
        setOnCancelCallback(null);
    }, []);

    const saveVisualEdit = useCallback(() => {
        onSaveCallback?.();
        endVisualEdit();
    }, [onSaveCallback, endVisualEdit]);

    const cancelVisualEdit = useCallback(() => {
        onCancelCallback?.();
        endVisualEdit();
    }, [onCancelCallback, endVisualEdit]);

    const setPickCallback = useCallback((cb: ((point: { x: number; y: number }) => void) | null) => {
        setPickCallbackState(() => cb);
    }, []);

    const setLastPickedPoint = useCallback((point: { x: number; y: number } | null) => {
        setLastPickedPointState(point);
    }, []);

    return (
        <VisualEditContext.Provider
            value={{
                isVisualEditing,
                editingObjectId,
                startVisualEdit,
                endVisualEdit,
                saveVisualEdit,
                cancelVisualEdit,
                shouldRestoreDialogs,
                setShouldRestoreDialogs,
                pickCallback,
                setPickCallback,
                lastPickedPoint,
                setLastPickedPoint,
            }}
        >
            {children}
        </VisualEditContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useVisualEdit = () => {
    const context = useContext(VisualEditContext);
    if (context === undefined) {
        throw new Error('useVisualEdit must be used within a VisualEditProvider');
    }
    return context;
};
