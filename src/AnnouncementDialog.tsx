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
