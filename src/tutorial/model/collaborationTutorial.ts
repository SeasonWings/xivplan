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

// 协作功能教程步骤
export const collaborationTutorialSteps: TutorialStep[] = [
    {
        id: 'collaboration-intro',
        target: '#root',
        title: '协作功能教程',
        content:
            '欢迎使用协作功能！通过协作功能，你可以与他人实时共享和编辑场景。本教程将引导你了解协作功能的基本使用方法。',
        placement: 'bottom',
    },
    {
        id: 'open-collaboration-panel',
        target: '[data-tutorial="collaboration-open"]',
        title: '一：打开协作面板',
        content: '点击工具栏上的协作按钮，打开协作功能面板。',
        placement: 'bottom',
        highlightButton: '[data-tutorial="collaboration-open"]',
        action: (context: TutorialActionContext) => {
            clickButton('[data-tutorial="collaboration-open"]', context.finishAction);
        },
        autoAction: true,
        demoObjects: [],
    },
    {
        id: 'create-room',
        target: '[data-tutorial="collaboration-create-room"]',
        title: '二：创建协作房间',
        content:
            '在协作面板中，点击“创建新房间”按钮来创建一个新的协作房间。创建成功后，你会获得一个房间ID，可以分享给其他人。',
        placement: 'left',
        highlightButton: '[data-tutorial="collaboration-create-room"]',
        action: (context: TutorialActionContext) => {
            clickButton('[data-tutorial="collaboration-create-room"]', context.finishAction);
        },
        autoAction: true,
        demoObjects: [],
    },
    {
        id: 'copy-room-link',
        target: '[data-tutorial="collaboration-copy-link"]',
        title: '三：分享房间链接',
        content: '创建房间后，你可以点击“复制”按钮来复制房间链接，然后将链接分享给想要邀请的协作者。',
        placement: 'left',
        highlightButton: '[data-tutorial="collaboration-copy-link"]',
    },
    {
        id: 'user-list',
        target: '[data-tutorial="collaboration-user-list"]',
        title: '四：查看在线用户',
        content: '在协作面板中，你可以看到当前在线的用户列表。你自己会标记为“(你)”，房主会标记为“(房主)”。',
        placement: 'left',
    },
    {
        id: 'host-functions',
        target: '[data-tutorial="collaboration-host-functions"]',
        title: '五：房主功能',
        content:
            '作为房主，你可以控制其他用户的编辑权限，并可以将房主权限移交给其他用户。只有房主可以看到这些控制选项。',
        placement: 'left',
    },
    {
        id: 'edit-permissions',
        target: '[data-tutorial="collaboration-edit-switch"]',
        title: '六：编辑权限控制',
        content: '房主可以通过切换用户旁边的开关来授予或撤销其他用户的编辑权限。被授予权限的用户会标记为“(可编辑)”。',
        placement: 'left',
        highlightButton: '[data-tutorial="collaboration-edit-switch"]',
    },
    {
        id: 'transfer-host',
        target: '[data-tutorial="collaboration-transfer-host"]',
        title: '七：移交房主权限',
        content: '房主可以点击“移交房主”按钮将房主权限转移给其他用户。移交后，新的房主将拥有相同的控制权限。',
        placement: 'left',
        highlightButton: '[data-tutorial="collaboration-transfer-host"]',
    },
    {
        id: 'chat-feature',
        target: '[data-tutorial="collaboration-chat"]',
        title: '八：协作聊天',
        content: '在协作面板底部，有一个聊天区域。你可以在这里与其他协作者进行实时交流，讨论场景设计等话题。',
        placement: 'left',
    },
    {
        id: 'send-message',
        target: '[data-tutorial="collaboration-send-message"]',
        title: '九：发送消息',
        content: '在聊天输入框中输入消息，然后点击“发送”按钮或按回车键发送消息给房间中的所有协作者。',
        placement: 'left',
        highlightButton: '[data-tutorial="collaboration-send-message"]',
    },
    {
        id: 'leave-room',
        target: '[data-tutorial="collaboration-leave-room"]',
        title: '十：离开房间',
        content: '当你完成协作后，可以点击“离开房间”按钮退出当前的协作房间。退出后，你的更改会被保留。',
        placement: 'left',
        highlightButton: '[data-tutorial="collaboration-leave-room"]',
    },
    {
        id: 'tutorial-complete',
        target: '#root',
        title: '完成！',
        content:
            '恭喜你完成了协作功能的学习！现在你可以与朋友或同事一起协作编辑场景了。记住关键步骤：创建房间 → 分享链接 → 管理权限 → 实时聊天。',
        placement: 'bottom',
    },
];
