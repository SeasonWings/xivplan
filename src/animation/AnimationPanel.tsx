import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Input,
    makeStyles,
    Switch,
    Tab,
    TabList,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { Settings24Regular, VideoRecordingRegular } from '@fluentui/react-icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from './AnimationContext';
import { AnimationTimeline } from './AnimationTimeline';
import { Animation, EasingType } from './animationTypes';
import { KeyframePanel } from './KeyframePanel';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: tokens.colorNeutralBackground1,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: tokens.spacingVerticalM,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    tabContent: {
        flex: 1,
        overflow: 'hidden',
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    formField: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    label: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    noAnimation: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacingVerticalL,
        padding: tokens.spacingVerticalXXL,
        textAlign: 'center',
        color: tokens.colorNeutralForeground3,
    },
});

export const AnimationPanel: React.FC = () => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { animation, setAnimation } = useAnimation();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'timeline' | 'keyframes'>('timeline');

    // 动画设置表单状态
    const [animationName, setAnimationName] = useState(animation?.name ?? '');
    const [loop, setLoop] = useState(animation?.loop ?? false);

    const handleCreateAnimation = useCallback(() => {
        const newAnimation: Animation = {
            name: '新动画',
            keyframes: [],
            duration: 0, // 初始为 0，添加关键帧后自动计算
            loop: false,
            easing: EasingType.Linear,
        };
        setAnimation(newAnimation);
        setAnimationName(newAnimation.name ?? '');
        setLoop(newAnimation.loop);
    }, [setAnimation]);

    const handleSaveSettings = useCallback(() => {
        if (!animation) {
            return;
        }

        const updatedAnimation: Animation = {
            ...animation,
            name: animationName || undefined,
            loop,
            // duration 由关键帧自动计算，不需要手动设置
        };

        setAnimation(updatedAnimation);
        setSettingsOpen(false);
    }, [animation, animationName, loop, setAnimation]);

    const handleDeleteAnimation = useCallback(() => {
        setAnimation(null);
        setSettingsOpen(false);
    }, [setAnimation]);

    if (!animation) {
        return (
            <div className={classes.container}>
                <div className={classes.header}>
                    <div className={classes.title}>
                        <VideoRecordingRegular />
                        {t('animation.title', '动画')}
                    </div>
                </div>
                <div className={classes.noAnimation}>
                    <div>
                        <div style={{ fontSize: tokens.fontSizeBase500, marginBottom: tokens.spacingVerticalM }}>
                            {t('animation.noAnimationCreated', '暂未创建动画')}
                        </div>
                        <div style={{ color: tokens.colorNeutralForeground2 }}>
                            {t('animation.createAnimationTip', '创建动画后，可以为对象设置不同时间点的位置')}
                        </div>
                    </div>
                    <Button appearance="primary" onClick={handleCreateAnimation}>
                        {t('animation.createAnimation', '创建动画')}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={classes.container}>
            <div className={classes.header}>
                <div className={classes.title}>
                    <VideoRecordingRegular />
                    {animation.name || t('animation.untitled', '未命名动画')}
                </div>
                <Tooltip content={t('animation.settings', '动画设置')} relationship="label">
                    <Button icon={<Settings24Regular />} appearance="subtle" onClick={() => setSettingsOpen(true)} />
                </Tooltip>
            </div>

            <div className={classes.content}>
                <TabList
                    selectedValue={activeTab}
                    onTabSelect={(_, data) => setActiveTab(data.value as 'timeline' | 'keyframes')}
                >
                    <Tab value="timeline">{t('animation.timeline', '时间轴')}</Tab>
                    <Tab value="keyframes">{t('animation.keyframes', '关键帧')}</Tab>
                </TabList>

                <div className={classes.tabContent}>
                    {activeTab === 'timeline' && <AnimationTimeline />}
                    {activeTab === 'keyframes' && <KeyframePanel />}
                </div>
            </div>

            {/* 设置对话框 */}
            <Dialog open={settingsOpen} onOpenChange={(_, data) => setSettingsOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>{t('animation.animationSettings', '动画设置')}</DialogTitle>
                        <DialogContent>
                            <div className={classes.dialogContent}>
                                <div className={classes.formField}>
                                    <label className={classes.label}>{t('animation.name', '动画名称')}</label>
                                    <Input
                                        value={animationName}
                                        onChange={(e, data) => setAnimationName(data.value)}
                                        placeholder={t('animation.namePlaceholder', '输入动画名称')}
                                    />
                                </div>

                                <div className={classes.formField}>
                                    <label className={classes.label}>{t('animation.duration', '总时长')}</label>
                                    <div style={{ padding: '8px 12px', color: tokens.colorNeutralForeground2 }}>
                                        {animation.duration} ms ({(animation.duration / 1000).toFixed(2)} s)
                                        <div style={{ fontSize: tokens.fontSizeBase200, marginTop: '4px' }}>
                                            {t('animation.autoCalculated', '自动根据关键帧计算')}
                                        </div>
                                    </div>
                                </div>

                                <div className={classes.formField}>
                                    <Switch
                                        checked={loop}
                                        onChange={(e, data) => setLoop(data.checked)}
                                        label={t('animation.loop', '循环播放')}
                                    />
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={handleDeleteAnimation}>
                                {t('animation.deleteAnimation', '删除动画')}
                            </Button>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary">{t('animation.cancel', '取消')}</Button>
                            </DialogTrigger>
                            <Button appearance="primary" onClick={handleSaveSettings}>
                                {t('animation.saveSettings', '保存')}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
