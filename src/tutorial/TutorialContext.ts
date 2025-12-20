import { createContext, Dispatch, SetStateAction } from 'react';
import { SceneObject } from '../scene';
import { SceneSelection } from '../SelectionContext';

export interface TutorialActionContext {
    getSceneObjects: () => readonly SceneObject[]; // 添加获取场景对象的方法
    setSelection: (selection: SceneSelection) => void; // 设置选择状态的方法
    toggleSelection: (selection: SceneSelection, id: number) => SceneSelection; // 切换选择状态的方法
    finishAction?: () => void; // 可选的完成回调，用于异步操作完成后通知
    updateSpotlight?: (selector: string) => void; // 可选的更新高亮元素范围方法
}

export interface TutorialStep {
    id: string;
    target: string; // CSS选择器或元素ID
    title: string;
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    action?: (context: TutorialActionContext) => void;
    demoObjects?: SceneObject[]; // 该步骤需要展示的演示对象
    highlightButton?: string; // 需要高亮的按钮选择器
    autoAction?: boolean; // 是否自动执行 action（默认 false）
}

export interface TutorialState {
    isActive: boolean;
    currentStepIndex: number;
    steps: TutorialStep[];
}

export type TutorialContextValue = [TutorialState, Dispatch<SetStateAction<TutorialState>>];

export const defaultTutorialState: TutorialState = {
    isActive: false,
    currentStepIndex: 0,
    steps: [],
};

export const TutorialContext = createContext<TutorialContextValue>([defaultTutorialState, () => {}]);
