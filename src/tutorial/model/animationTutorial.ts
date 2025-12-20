import { TutorialStep, TutorialActionContext } from '../TutorialContext.ts';

// 工具函数：模拟点击按钮
const clickButton = (selector: string, onFinish?: () => void) => {
    setTimeout(() => {
        const button = document.querySelector(selector);
        if (button instanceof HTMLElement) {
            button.click();
        }
        // 如果提供了完成回调，则调用它
        if (onFinish) {
            onFinish();
        }
    }, 500); // 延迟500ms以确保界面渲染完成
};

// 动画功能教程步骤
export const animationTutorialSteps: TutorialStep[] = [
    {
        id: 'animation-intro',
        target: '#root',
        title: '动画功能教程',
        content:
            '欢迎使用动画功能！通过动画功能，你可以为场景中的元素创建生动的动画效果。本教程将引导你了解动画功能的基本使用方法。',
        placement: 'bottom',
    },
    {
        id: 'open-animation-panel',
        target: '[data-tutorial="animation-open"]',
        title: '一：打开动画面板',
        content: '点击工具栏上的动画按钮，打开动画功能面板。',
        placement: 'bottom',
        highlightButton: '[data-tutorial="animation-open"]',
        demoObjects: [],
        action: (context: TutorialActionContext) => {
            clickButton('[data-tutorial="animation-open"]', context.finishAction);
        },
        autoAction: true,
    },
    {
        id: 'create-animation',
        target: '[data-tutorial="animation-create"]',
        title: '二：创建动画',
        content: '在动画面板中，点击“创建动画”按钮来创建一个新的动画。',
        placement: 'left',
        highlightButton: '[data-tutorial="animation-create"]',
        demoObjects: [],
        action: (context: TutorialActionContext) => {
            setTimeout(() => {
                // 模拟点击"创建动画"按钮
                clickButton('[data-tutorial="animation-create"]', context.finishAction);
                setTimeout(() => {
                    // 更新高亮区域到"创建动画"按钮
                    if (context.updateSpotlight) {
                        context.updateSpotlight('[data-tutorial="animation-create"]');
                    }
                }, 500);
            }, 2000);
        },
        autoAction: true,
    },
    {
        id: 'animation-settings',
        target: '[data-tutorial="animation-settings"]',
        title: '三：动画设置',
        content: '点击动画设置按钮可以修改动画名称和循环播放选项。',
        placement: 'left',
        highlightButton: '[data-tutorial="animation-settings"]',
    },
    {
        id: 'add-keyframe',
        target: '[data-tutorial="tab-keyframe"]',
        title: '四：添加关键帧',
        content:
            '在关键帧面板中，点击“添加关键帧”按钮来添加一个新的关键帧。关键帧用于定义动画中元素在特定时间点的状态。',
        placement: 'left',
        highlightButton: '[data-tutorial="tab-keyframe"]',
        demoObjects: [],
        action: (context: TutorialActionContext) => {
            setTimeout(() => {
                clickButton('[data-tutorial="tab-keyframe"]');
                setTimeout(() => {
                    if (context.updateSpotlight) {
                        context.updateSpotlight('[data-tutorial="animation-add-keyframe"]');
                    }
                    clickButton('[data-tutorial="animation-add-keyframe"]', context.finishAction);
                }, 3000);
            }, 50);
        },
        autoAction: true,
    },
    {
        id: 'keyframe-list',
        target: '[data-tutorial="animation-keyframe-list"]',
        title: '五：关键帧列表',
        content: '添加关键帧后，你可以在列表中看到所有关键帧。每个关键帧都有时间、名称和对象数量信息。',
        placement: 'left',
    },
    {
        id: 'edit-keyframe',
        target: '[data-tutorial="animation-edit-keyframe"]',
        title: '六：编辑关键帧',
        content: '点击关键帧旁边的菜单按钮，选择“编辑此帧”来编辑关键帧中元素的状态。编辑完成后记得保存。',
        placement: 'left',
        highlightButton: '[data-tutorial="animation-edit-keyframe"]',
    },
    {
        id: 'timeline-controls',
        target: '[data-tutorial="tab-timeline"]',
        title: '七：时间轴控制',
        content: '切换到时间轴面板，你可以通过播放、暂停、停止按钮控制动画播放，也可以拖动进度条跳转到指定时间点。',
        placement: 'left',
        demoObjects: [],
        action: (context: TutorialActionContext) => {
            setTimeout(() => {
                clickButton('[data-tutorial="tab-timeline"]');
                setTimeout(() => {
                    if (context.updateSpotlight) {
                        context.updateSpotlight('[data-tutorial="animation-timeline"]');
                    }
                    clickButton('[data-tutorial="animation-timeline"]', context.finishAction);
                }, 3000);
            }, 50);
        },
        autoAction: true,
    },
    {
        id: 'playback-speed',
        target: '[data-tutorial="animation-speed-control"]',
        title: '八：播放速度',
        content: '在时间轴面板中，你可以调整动画的播放速度，支持0.5x到3.0x的速度调节。',
        placement: 'left',
    },
    {
        id: 'tutorial-complete',
        target: '#root',
        title: '完成！',
        content:
            '恭喜你完成了动画功能的学习！现在你可以为场景中的元素创建丰富的动画效果了。记住关键步骤：创建动画 → 添加关键帧 → 编辑关键帧状态 → 控制播放。',
        placement: 'bottom',
    },
];
