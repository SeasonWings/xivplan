import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Link,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles({
    link: {
        color: tokens.colorNeutralForeground2,
        cursor: 'pointer',
        '&:hover': {
            color: tokens.colorNeutralForeground1,
        },
    },
    dialogSurface: {
        maxHeight: '80vh',
        maxWidth: '600px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        maxHeight: 'calc(80vh - 180px)', // 减去标题和按钮的高度
        overflowY: 'auto',
    },
    announcement: {
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    },
    date: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        marginBottom: tokens.spacingVerticalS,
    },
    title: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        marginBottom: tokens.spacingVerticalS,
    },
    body: {
        fontSize: tokens.fontSizeBase300,
        lineHeight: tokens.lineHeightBase300,
        color: tokens.colorNeutralForeground2,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
});

interface AnnouncementItem {
    id: string;
    date: string;
    title: string;
    content: string;
}

// 公告数据
const announcements: AnnouncementItem[] = [
    {
        id: '7',
        date: '2026-03-16',
        title: 'v2.2.0 更新日志',
        content:
            '1. UI 视效重构，统一为透明毛玻璃卡片风格\n2. 新增图层功能，元素属性栏新增胶囊选择图层\n3. 协作功能2.0：现在可以实时看到队友的光标及状态，UI更加现代\n4.新增诛仙世界风格的场标元素\n5.新增锁定元素相对角度功能，选中两个元素后点击锁定旋转点来使用',
    },
    {
        id: '6',
        date: '2026-02-28',
        title: 'v2.1.0 更新日志',
        content:
            '1. 动画引擎完全重构，欢迎体验V2版本动画编辑器\n2. 诛仙世界选项新增殇，惧，剑，距离衰减元素\n3. 新增炎烬锁锋刃地图支持\n4. 新增建议反馈功能，欢迎给本站提出建议捏',
    },
    {
        id: '5',
        date: '2026-01-23',
        title: 'v2.0.0 更新日志',
        content:
            '1. 社区功能上线！你可以自由分享你的战术板构想给大家，也可以自由查阅他人的分享！ \n2. 修复了组元素在旋转其一时不会同步旋转的问题',
    },
    {
        id: '4',
        date: '2025-12-31',
        title: 'v1.0.3 更新日志',
        content:
            "1. 现在可以查看部分探索功能的引导了,单击右上角'引导'按钮学习使用！\n2. 为旋转元素添加了动画\n3.添加关键帧时的步长不再是固定100，现在可以自由调节了\n4.动画设置里新增动画播放时元素移动速度曲线选择\n5.新增了天音阁元素",
    },
    {
        id: '3',
        date: '2025-12-09',
        title: 'v1.0.2 更新日志',
        content: '1. 优化了直线分摊&圆形分摊的动画\n2. 为各种击退&距离衰减添加了动画',
    },
    {
        id: '2',
        date: '2025-12-08',
        title: 'v1.0.1 更新日志',
        content: '1. 修复了缩放/旋转时鼠标框选被错误触发的问题\n2. 为分摊&直线分摊添加了动画',
    },
    {
        id: '1',
        date: '2025-12-03',
        title: 'v1.0.0 更新日志',
        content:
            '1. 修复了跳转到有元素改动的帧后差异元素未正常加载的问题\n2. 修复鼠标框选在拖拽元素时也会生效的问题\n3. 修复了连线在播放动画时未正确更新长度的问题\n4. 现在你可以创建多个动画了\n5. 新增编辑帧功能',
    },
];

interface AnnouncementDialogProps {
    className?: string;
}

export const AnnouncementDialog: React.FC<AnnouncementDialogProps> = ({ className }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Link className={className || classes.link}>{t('header.announcement', '公告')}</Link>
            </DialogTrigger>
            <DialogSurface className={classes.dialogSurface}>
                <DialogBody>
                    <DialogTitle>{t('announcement.title', '系统公告')}</DialogTitle>
                    <DialogContent>
                        <div className={classes.content}>
                            {announcements.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: tokens.spacingVerticalXXL,
                                        color: tokens.colorNeutralForeground3,
                                    }}
                                >
                                    {t('announcement.empty', '暂无公告')}
                                </div>
                            ) : (
                                announcements.map((announcement) => (
                                    <div key={announcement.id} className={classes.announcement}>
                                        <div className={classes.date}>{announcement.date}</div>
                                        <div className={classes.title}>{announcement.title}</div>
                                        <div className={classes.body}>{announcement.content}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="primary">{t('announcement.close', '关闭')}</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
