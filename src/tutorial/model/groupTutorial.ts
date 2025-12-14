import { TutorialStep, TutorialActionContext } from '../TutorialContext.ts';
import { ObjectType, CircleZone } from '../../scene.ts';
import { selectNone } from '../../selection.ts';

// 演示用的对象ID，从一个较大的数字开始以避免冲突
const DEMO_ID_START = 999900;

// 创建演示对象的辅助函数
const createDemoCircle = (id: number, color: string, x: number, groupId?: string): CircleZone => ({
    id,
    type: ObjectType.Circle,
    color,
    radius: 30,
    x,
    y: 200,
    opacity: 100,
    native: false,
    groupId,
});

// 工具函数：模拟点击按钮
const clickButton = (selector: string) => {
    setTimeout(() => {
        const button = document.querySelector(selector);
        if (button instanceof HTMLElement) {
            button.click();
        }
    }, 500); // 延迟500ms以确保界面渲染完成
};

export const groupTutorialSteps: TutorialStep[] = [
    {
        id: 'group-intro',
        target: '#root',
        title: '元素组功能教程',
        content:
            '欢迎使用元素组功能！通过组功能，你可以将多个元素组合在一起，方便统一管理和操作。让我们开始学习如何使用这个功能。',
        placement: 'bottom',
    },
    {
        id: 'select-objects',
        target: '[data-tutorial="scene-objects-panel"]',
        title: '一：选择多个元素',
        content: '首先，你需要在场景中选择至少两个元素。我们已经在画布上添加了两个演示元素，现在将自动选中它们。',
        placement: 'left',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100),
        ],
        action: (context: TutorialActionContext) => {
            let selection = selectNone();
            selection = context.toggleSelection(selection, DEMO_ID_START);
            selection = context.toggleSelection(selection, DEMO_ID_START + 1);
            context.setSelection(selection);
        },
        autoAction: true,
    },
    {
        id: 'properties-panel',
        target: '[data-tutorial="properties-panel"]',
        title: '二：打开属性面板',
        content: '选中多个元素后，在右侧的属性面板中会显示所有选中元素的共同属性。',
        placement: 'left',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100),
        ],
    },
    {
        id: 'create-group',
        target: '[data-tutorial="group-control"]',
        title: '三：创建组',
        content: '在属性面板中找到“元素组”部分，点击“创建组”按钮将选中的元素组合成一个组。',
        placement: 'left',
        highlightButton: '[data-tutorial="create-group-button"]',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100),
        ],
    },
    {
        id: 'group-indicator',
        target: '[data-tutorial="scene-objects-panel"]',
        title: '四：识别组元素',
        content:
            '点击按钮，成功创建组后，场景对象列表中的组内元素旁边会显示一个彩色的组图标。同一个组的元素会显示相同颜色的图标。',
        placement: 'left',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100, 'demo-group'),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100, 'demo-group'),
        ],
        action: (context: TutorialActionContext) => {
            // TutorialOverlay 已经有延迟，这里直接执行即可
            let selection = selectNone();
            selection = context.toggleSelection(selection, DEMO_ID_START);
            selection = context.toggleSelection(selection, DEMO_ID_START + 1);
            context.setSelection(selection); // 应用最终的选择状态

            // 点击创建组按钮
            clickButton('[data-tutorial="create-group-button"]');

            // 清掉
            context.setSelection(selectNone());
        },
        autoAction: true,
    },
    {
        id: 'click-group-icon',
        target: '[data-tutorial="group-arrow"]',
        title: '五：快速选择整个组',
        content: '点击任意组元素旁边的组图标，可以快速选中该组的所有元素。',
        placement: 'left',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100, 'demo-group'),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100, 'demo-group'),
        ],
    },
    {
        id: 'move-group',
        target: '#root',
        title: '六：移动组元素',
        content: '选中组内的任意元素并拖动，整个组的所有元素都会一起移动。这样可以保持组内元素的相对位置不变。',
        placement: 'bottom',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100, 'demo-group'),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100, 'demo-group'),
        ],
        action: () => {
            // 点击创建组按钮
            clickButton('[data-tutorial="group-arrow"]');
        },
        autoAction: true,
    },
    {
        id: 'ungroup',
        target: '[data-tutorial="group-control"]',
        title: '七：解散组',
        content:
            '如果需要解散组，选中组内的元素，然后在属性面板的“元素组”部分点击“解散组”按钮。我们将自动为你点击该按钮。',
        placement: 'left',
        highlightButton: '[data-tutorial="ungroup-button"]',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100, 'demo-group'),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100, 'demo-group'),
        ],
    },
    {
        id: 'tutorial-complete',
        target: '#root',
        title: '完成！',
        content:
            '恭喜你完成了元素组功能的学习！现在你可以自由使用组功能来管理你的场景元素了。记住：选择多个元素 → 创建组 → 通过组图标快速选择 → 一起移动。',
        placement: 'bottom',
        demoObjects: [
            createDemoCircle(DEMO_ID_START, '#ff6b6b', -100, 'demo-group'),
            createDemoCircle(DEMO_ID_START + 1, '#4ecdc4', 100, 'demo-group'),
        ],
        action: (context: TutorialActionContext) => {
            // TutorialOverlay 已经有延迟，这里直接执行即可
            let selection = selectNone();
            selection = context.toggleSelection(selection, DEMO_ID_START);
            selection = context.toggleSelection(selection, DEMO_ID_START + 1);
            context.setSelection(selection); // 应用最终的选择状态

            // 点击解散组按钮
            clickButton('[data-tutorial="ungroup-button"]');
        },
        autoAction: true,
    },
];
