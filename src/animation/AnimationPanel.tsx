import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Dropdown,
    Input,
    makeStyles,
    Option,
    Switch,
    Tab,
    TabList,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { Add24Regular, Settings24Regular, VideoRecordingRegular } from '@fluentui/react-icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from './AnimationContext';
import { Animation } from './animationTypes';
import { AnimationTimeline } from './AnimationTimeline';
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
    const { animation, animations, createAnimation, switchAnimation, deleteAnimation, setAnimation } = useAnimation();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'timeline' | 'keyframes'>('timeline');

    // 动画设置表单状态
    const [animationName, setAnimationName] = useState(animation?.name ?? '');
    const [loop, setLoop] = useState(animation?.loop ?? false);

    const handleCreateAnimation = useCallback(() => {
        createAnimation('新动画');
    }, [createAnimation]);

    const handleSwitchAnimation = useCallback(
        (animationId: string) => {
            switchAnimation(animationId);
        },
        [switchAnimation],
    );

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
        if (animation) {
            deleteAnimation(animation.id);
            setSettingsOpen(false);
        }
    }, [animation, deleteAnimation]);

    if (animations.length === 0) {
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
                    {animation ? (
                        <Dropdown
                            value={animation.name || t('animation.untitled', '未命名动画')}
                            selectedOptions={[animation.id]}
                            onOptionSelect={(_, data) => {
                                if (data.optionValue) {
                                    handleSwitchAnimation(data.optionValue);
                                }
                            }}
                            appearance="underline"
                            style={{ minWidth: '150px', border: 'none' }}
                        >
                            {animations.map((anim) => (
                                <Option key={anim.id} value={anim.id}>
                                    {anim.name || t('animation.untitled', '未命名动画')}
                                </Option>
                            ))}
                        </Dropdown>
                    ) : (
                        <span>{t('animation.title', '动画')}</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
                    <Tooltip content={t('animation.createAnimation', '创建新动画')} relationship="label">
                        <Button icon={<Add24Regular />} appearance="subtle" onClick={handleCreateAnimation} />
                    </Tooltip>
                    {animation && (
                        <Tooltip content={t('animation.settings', '动画设置')} relationship="label">
                            <Button
                                icon={<Settings24Regular />}
                                appearance="subtle"
                                onClick={() => setSettingsOpen(true)}
                            />
                        </Tooltip>
                    )}
                </div>
            </div>

            {animation ? (
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
            ) : (
                <div className={classes.noAnimation}>
                    <div style={{ color: tokens.colorNeutralForeground2 }}>
                        {t('animation.selectOrCreate', '请选择或创建一个动画')}
                    </div>
                </div>
            )}

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
                                        {animation?.duration ?? 0} ms ({((animation?.duration ?? 0) / 1000).toFixed(2)}{' '}
                                        s)
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
