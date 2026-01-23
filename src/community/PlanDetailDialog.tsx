import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Text,
    Badge,
    makeStyles,
    tokens,
    Spinner,
    Tab,
    TabList,
} from '@fluentui/react-components';
import { ArrowDownloadFilled, EyeFilled, HeartFilled, CommentMultipleFilled } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import type { CommunityPlan } from './types';
import { getCategoryByValue, getGameByValue } from './categoryConfig';
import { textToScene } from '../file';
import { ScenePreview } from '../render/SceneRenderer';
import { getCanvasSize } from '../coord';
import { config } from '../config';
import { AnimationProvider } from '../animation/AnimationContext';
import { CommentSection } from './CommentSection';
import type { Scene } from '../scene';

const API_BASE = config.api.baseUrl;

interface PlanDetailDialogProps {
    plan: CommunityPlan;
    onClose: () => void;
    onDownload: (plan: CommunityPlan) => void;
}

export const PlanDetailDialog: React.FC<PlanDetailDialogProps> = ({ plan, onClose, onDownload }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState<string>('info');
    const [fullPlan, setFullPlan] = useState<CommunityPlan | null>(null);
    const [previewScene, setPreviewScene] = useState<Scene | null>(null);
    const [loading, setLoading] = useState(true);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    const hasFetchedRef = React.useRef<Record<string, boolean>>({}); // 记录每个 share_id 的获取状态

    // 获取完整的战术板数据（包括 scene_data）
    useEffect(() => {
        const shareId = plan.share_id;

        // 如果已经获取过这个 share_id，直接返回
        if (hasFetchedRef.current[shareId]) {
            return;
        }

        hasFetchedRef.current[shareId] = true;

        const fetchFullPlan = async () => {
            setLoading(true);

            try {
                const response = await fetch(`${API_BASE}/community/${plan.share_id}`);
                const data = await response.json();

                if (data.success && data.data) {
                    setFullPlan(data.data);

                    // 解析scene_data
                    if (data.data.scene_data) {
                        try {
                            const scene = textToScene(data.data.scene_data);
                            setPreviewScene(scene);

                            // 计算预览尺寸，缩放到适合大小
                            const canvasSize = getCanvasSize(scene);
                            const maxWidth = 750; // 最大宽度
                            const maxHeight = 500; // 最大高度

                            const scaleX = maxWidth / canvasSize.width;
                            const scaleY = maxHeight / canvasSize.height;
                            const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

                            setPreviewSize({
                                width: canvasSize.width * scale,
                                height: canvasSize.height * scale,
                            });
                        } catch (error) {
                            console.error('Failed to parse scene data:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch full plan:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFullPlan();
    }, [plan.share_id]);

    const handleDownload = () => {
        if (fullPlan) {
            onDownload(fullPlan);
        }
        onClose();
    };

    // 处理评论数变化，重新获取战术板数据
    const handleCommentCountChange = async () => {
        try {
            const response = await fetch(`${API_BASE}/community/${plan.share_id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setFullPlan((prev) => (prev ? { ...prev, comment_count: data.data.comment_count } : null));
            }
        } catch (error) {
            console.error('Failed to refresh comment count:', error);
        }
    };

    return (
        <Dialog open onOpenChange={(e, data) => !data.open && onClose()}>
            <DialogSurface className={classes.surface}>
                <DialogBody>
                    <DialogTitle>{plan.title}</DialogTitle>
                    <DialogContent className={classes.content}>
                        {/* 头部信息 */}
                        <div className={classes.meta}>
                            <Badge appearance="outline">{getGameByValue(plan.game)?.label || plan.game}</Badge>
                            <Badge appearance="tint">{getCategoryByValue(plan.category)?.label || plan.category}</Badge>
                            <div className={classes.authorInfo}>
                                {plan.author_avatar ? (
                                    <img src={plan.author_avatar} alt={plan.author} className={classes.avatarImage} />
                                ) : (
                                    <div className={classes.avatarPlaceholder}>
                                        {plan.author.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <Text size={300}>
                                    {t('community.by', '作者')}: {plan.author}
                                </Text>
                            </div>
                            <Text size={200} className={classes.date}>
                                {new Date(plan.created_at).toLocaleDateString()}
                            </Text>
                        </div>

                        {/* 标签页 */}
                        <TabList
                            selectedValue={selectedTab}
                            onTabSelect={(e, data) => setSelectedTab(data.value as string)}
                        >
                            <Tab value="info">{t('community.detail.info', '详细信息')}</Tab>
                            <Tab value="preview">{t('community.detail.preview', '战术板预览')}</Tab>
                            <Tab value="comments">
                                {t('community.detail.comments', '评论')} ({fullPlan?.comment_count || 0})
                            </Tab>
                        </TabList>

                        {loading ? (
                            <div className={classes.loading}>
                                <Spinner label={t('community.loading', '加载中...')} />
                            </div>
                        ) : (
                            <>
                                {/* 详细信息标签页 */}
                                {selectedTab === 'info' && (
                                    <div className={classes.tabContent}>
                                        {fullPlan?.dungeon_name && (
                                            <div>
                                                <Text weight="semibold">{t('community.dungeonName', '副本')}: </Text>
                                                <Text>{fullPlan.dungeon_name}</Text>
                                            </div>
                                        )}

                                        {fullPlan?.description && (
                                            <div>
                                                <Text weight="semibold">{t('community.description', '描述')}</Text>
                                                <Text className={classes.description}>{fullPlan.description}</Text>
                                            </div>
                                        )}

                                        <div className={classes.stats}>
                                            <div className={classes.stat}>
                                                <EyeFilled fontSize={20} />
                                                <Text>{plan.view_count}</Text>
                                                <Text size={200}>{t('community.views', '浏览')}</Text>
                                            </div>
                                            <div className={classes.stat}>
                                                <ArrowDownloadFilled fontSize={20} />
                                                <Text>{plan.download_count}</Text>
                                                <Text size={200}>{t('community.downloads', '下载')}</Text>
                                            </div>
                                            <div className={classes.stat}>
                                                <HeartFilled fontSize={20} />
                                                <Text>{plan.like_count}</Text>
                                                <Text size={200}>{t('community.likes', '点赞')}</Text>
                                            </div>
                                            <div className={classes.stat}>
                                                <CommentMultipleFilled fontSize={20} />
                                                <Text>{fullPlan?.comment_count || 0}</Text>
                                                <Text size={200}>{t('community.comments', '评论')}</Text>
                                            </div>
                                        </div>

                                        {fullPlan?.tags && fullPlan.tags.length > 0 && (
                                            <div className={classes.tags}>
                                                {fullPlan.tags.map((tag, index) => (
                                                    <Badge key={index} size="small">
                                                        {tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 预览标签页 */}
                                {selectedTab === 'preview' && (
                                    <div className={classes.tabContent}>
                                        {previewScene && previewSize.width > 0 ? (
                                            <div className={classes.previewContainer}>
                                                <div className={classes.previewWrapper}>
                                                    <AnimationProvider>
                                                        <ScenePreview
                                                            scene={previewScene}
                                                            width={previewSize.width}
                                                            height={previewSize.height}
                                                            simple={false}
                                                        />
                                                    </AnimationProvider>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={classes.noPreview}>
                                                <Text>{t('community.detail.noPreview', '无法预览该战术板')}</Text>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 评论标签页 */}
                                {selectedTab === 'comments' && (
                                    <div className={classes.tabContent}>
                                        <CommentSection
                                            shareId={plan.share_id}
                                            onCommentCountChange={handleCommentCountChange}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </DialogContent>
                </DialogBody>
                <DialogActions className={classes.bottomButtons}>
                    <Button appearance="secondary" onClick={onClose}>
                        {t('community.close', '关闭')}
                    </Button>
                    <Button
                        appearance="primary"
                        icon={<ArrowDownloadFilled />}
                        onClick={handleDownload}
                        disabled={loading || !fullPlan}
                    >
                        {t('community.download', '下载并导入')}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    );
};

const useStyles = makeStyles({
    surface: {
        maxWidth: '900px',
        maxHeight: '90vh',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        overflow: 'hidden', // 防止内部元素溢出
    },
    meta: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    authorInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    avatarImage: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        objectFit: 'cover',
        verticalAlign: 'middle',
    },
    avatarPlaceholder: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundInverted,
        fontSize: tokens.fontSizeBase200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
    },
    date: {
        color: tokens.colorNeutralForeground3,
    },
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacingVerticalXXXL,
    },
    tabContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        maxHeight: '50vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: `${tokens.spacingVerticalS} 0`,
        // 自定义滚动条样式
        '::-webkit-scrollbar': {
            width: '6px',
        },
        '::-webkit-scrollbar-track': {
            backgroundColor: tokens.colorNeutralBackground3,
            borderRadius: '3px',
        },
        '::-webkit-scrollbar-thumb': {
            backgroundColor: tokens.colorNeutralStroke1,
            borderRadius: '3px',
            ':hover': {
                backgroundColor: tokens.colorNeutralStroke2,
            },
        },
    },
    description: {
        display: 'block',
        marginTop: tokens.spacingVerticalS,
        whiteSpace: 'pre-wrap',
        lineHeight: '1.6',
    },
    stats: {
        display: 'flex',
        gap: tokens.spacingHorizontalXXL,
        padding: tokens.spacingVerticalL,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
    },
    stat: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalXS,
    },
    tags: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    previewContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxHeight: '60vh',
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        overflow: 'hidden', // 隐藏滚动条，展示全貌
        padding: tokens.spacingVerticalL,
        // 自定义滚动条样式
        '::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
        },
        '::-webkit-scrollbar-track': {
            backgroundColor: tokens.colorNeutralBackground3,
            borderRadius: '3px',
        },
        '::-webkit-scrollbar-thumb': {
            backgroundColor: tokens.colorNeutralStroke1,
            borderRadius: '3px',
            ':hover': {
                backgroundColor: tokens.colorNeutralStroke2,
            },
        },
    },
    previewWrapper: {
        maxWidth: '100%',
        maxHeight: 'calc(60vh - 32px)', // 减去内边距
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noPreview: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacingVerticalXXXL,
        color: tokens.colorNeutralForeground3,
    },
    bottomButtons: {
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        paddingTop: '20px',
    },
});
