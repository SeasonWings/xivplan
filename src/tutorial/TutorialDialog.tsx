import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogProps,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    makeStyles,
    tokens,
    typographyStyles,
} from '@fluentui/react-components';
import { BookRegular, Dismiss24Regular } from '@fluentui/react-icons';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { HotkeyBlockingDialogBody } from '../HotkeyBlockingDialogBody';
import { TutorialContext } from './TutorialContext';
import { groupTutorialSteps } from './model/groupTutorial.ts';

export type TutorialDialogProps = Omit<DialogProps, 'children'>;

const useStyles = makeStyles({
    surface: {
        maxWidth: '600px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        ...typographyStyles.body1,
    },
    tutorialCard: {
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: tokens.colorNeutralStroke1,
        borderRightColor: tokens.colorNeutralStroke1,
        borderBottomColor: tokens.colorNeutralStroke1,
        borderLeftColor: tokens.colorNeutralStroke1,
        cursor: 'pointer',
        transitionProperty: 'all',
        transitionDuration: '0.2s',
        transitionTimingFunction: 'ease-in-out',

        ':hover': {
            backgroundColor: tokens.colorNeutralBackground2Hover,
            borderTopColor: tokens.colorBrandForeground1,
            borderRightColor: tokens.colorBrandForeground1,
            borderBottomColor: tokens.colorBrandForeground1,
            borderLeftColor: tokens.colorBrandForeground1,
        },
    },
    tutorialTitle: {
        ...typographyStyles.subtitle2,
        marginBottom: tokens.spacingVerticalXS,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    tutorialDescription: {
        ...typographyStyles.body1,
        color: tokens.colorNeutralForeground3,
    },
    icon: {
        color: tokens.colorBrandForeground1,
    },
});

export const TutorialDialog: React.FC<TutorialDialogProps> = ({ open, onOpenChange, ...otherProps }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const [, setTutorialState] = useContext(TutorialContext);

    const startGroupTutorial = () => {
        setTutorialState({
            isActive: true,
            currentStepIndex: 0,
            steps: groupTutorialSteps,
        });
        // 关闭教程选择对话框
        if (onOpenChange) {
            const mockEvent = new MouseEvent('click');
            onOpenChange(mockEvent as unknown as React.MouseEvent<HTMLElement>, {
                type: 'triggerClick',
                open: false,
                event: mockEvent as unknown as React.MouseEvent<HTMLElement>,
            });
        }
    };

    return (
        <Dialog {...otherProps} open={open} onOpenChange={onOpenChange}>
            <DialogSurface className={classes.surface}>
                <HotkeyBlockingDialogBody>
                    <DialogTitle
                        action={
                            <DialogTrigger action="close">
                                <Button
                                    appearance="subtle"
                                    aria-label={t('actions.close')}
                                    icon={<Dismiss24Regular />}
                                />
                            </DialogTrigger>
                        }
                    >
                        {t('tutorial.title', '教程')}
                    </DialogTitle>
                    <DialogContent className={classes.content}>
                        <p>{t('tutorial.description', '选择一个教程开始学习')}</p>

                        {/*元素组*/}
                        <div className={classes.tutorialCard} onClick={startGroupTutorial}>
                            <div className={classes.tutorialTitle}>
                                <BookRegular className={classes.icon} />
                                {t('tutorial.groupTutorial.title', '元素组功能教程')}
                            </div>
                            <div className={classes.tutorialDescription}>
                                {t(
                                    'tutorial.groupTutorial.description',
                                    '学习如何使用元素组功能来管理多个元素，包括创建组、选择组、移动组和解散组。',
                                )}
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">{t('actions.close', '关闭')}</Button>
                        </DialogTrigger>
                    </DialogActions>
                </HotkeyBlockingDialogBody>
            </DialogSurface>
        </Dialog>
    );
};

// 用于在帮助菜单中触发教程的按钮
export const TutorialButton: React.FC = () => {
    const { t } = useTranslation();
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <BookRegular /> {t('tutorial.start', '开始教程')}
            </Button>
            <TutorialDialog open={open} onOpenChange={(_, data) => setOpen(data.open)} />
        </>
    );
};
