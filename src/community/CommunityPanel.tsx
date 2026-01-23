import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Spinner, Text, Card, makeStyles, tokens, Badge } from '@fluentui/react-components';
import {
    ArrowUploadFilled,
    ArrowDownloadFilled,
    HeartFilled,
    HeartRegular,
    EyeFilled,
    SearchFilled,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useLoadScene } from '../SceneProvider';
import { textToScene } from '../file';
import { config } from '../config';
import { useAuth } from '../auth/AuthContext';
import { UploadDialog } from './UploadDialog';
import { PlanDetailDialog } from './PlanDetailDialog';
import type { CommunityPlan } from './types';
import { GAME_CATEGORIES, getCategoryByValue, getGameByValue } from './categoryConfig';

const API_BASE = config.api.baseUrl;

interface CommunityPanelProps {
    onDownloadSuccess?: () => void;
}

export const CommunityPanel: React.FC<CommunityPanelProps> = ({ onDownloadSuccess }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { state: authState } = useAuth();
    const loadScene = useLoadScene();

    // 从认证状态获取用户ID，如果未登录则使用匿名标识
    const userId = authState.user?.id || 'anonymous';

    const [plans, setPlans] = useState<CommunityPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedGame, setSelectedGame] = useState('all');
    const [category, setCategory] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<CommunityPlan | null>(null);

    // 获取战术板列表
    const fetchPlans = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: '12',
                sortBy,
                order: 'DESC',
                ...(selectedGame !== 'all' && { game: selectedGame }),
                ...(category !== 'all' && { category }),
                ...(searchQuery && { search: searchQuery }),
            });

            // 添加调试日志
            console.log('Fetching plans with params:', { page, selectedGame, category, searchQuery });
            console.log('API URL:', `${API_BASE}/community/list?${params}`);

            const response = await fetch(`${API_BASE}/community/list?${params}`);
            const data = await response.json();

            if (data.success) {
                const plansData = data.data;

                // 批量获取点赞状态
                const plansWithLikeStatus = await Promise.all(
                    plansData.map(async (plan: CommunityPlan) => {
                        try {
                            const likeResponse = await fetch(`${API_BASE}/community/${plan.share_id}/like/${userId}`);
                            const likeData = await likeResponse.json();
                            return {
                                ...plan,
                                user_liked: likeData.success ? likeData.liked : false,
                            };
                        } catch (error) {
                            console.error('Failed to fetch like status:', error);
                            return { ...plan, user_liked: false };
                        }
                    }),
                );

                setPlans(plansWithLikeStatus);
                setTotal(data.pagination.total);
            }
        } catch (error) {
            console.error('Failed to fetch plans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, [page, selectedGame, category, sortBy]);

    const handleSearch = () => {
        setPage(1);
        fetchPlans();
    };

    const handleLike = async (shareId: string) => {
        try {
            const response = await fetch(`${API_BASE}/community/${shareId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId || 'anonymous' }),
            });

            const data = await response.json();
            if (data.success) {
                // 更新本地点赞状态
                setPlans((prev) =>
                    prev.map((p) =>
                        p.share_id === shareId
                            ? {
                                  ...p,
                                  like_count: data.liked ? p.like_count + 1 : p.like_count - 1,
                                  user_liked: data.liked,
                              }
                            : p,
                    ),
                );
            }
        } catch (error) {
            console.error('Failed to toggle like:', error);
        }
    };

    const handleDownload = async (plan: CommunityPlan) => {
        try {
            // 先获取完整的战术板数据(包括scene_data)
            const detailResponse = await fetch(`${API_BASE}/community/${plan.share_id}`);
            const detailData = await detailResponse.json();

            if (!detailData.success || !detailData.data) {
                throw new Error('Failed to fetch plan details');
            }

            const fullPlan = detailData.data;

            // 记录下载次数
            await fetch(`${API_BASE}/community/${plan.share_id}/download`, { method: 'POST' });
            console.log(fullPlan.scene_data);
            // 导入场景数据
            if (fullPlan.scene_data) {
                try {
                    // 将压缩后的文本转换为场景对象
                    const importedScene = textToScene(fullPlan.scene_data);

                    // 加载场景
                    loadScene(importedScene);

                    // 显示成功消息
                    console.log('战术板导入成功:', plan.title);

                    // 关闭弹窗
                    onDownloadSuccess?.();
                } catch (parseError) {
                    console.error('Failed to parse scene data:', parseError);
                    alert(t('community.error.parseError', '数据解析失败,请稍后重试'));
                }
            } else {
                alert(t('community.error.noSceneData', '战术板数据不存在'));
            }
        } catch (error) {
            console.error('Failed to download plan:', error);
            alert(t('community.error.downloadError', '下载失败,请稍后重试'));
        }
    };

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <Text size={500} weight="semibold">
                    {t('community.title', '社区战术板')}
                </Text>
                <Button appearance="primary" icon={<ArrowUploadFilled />} onClick={() => setUploadOpen(true)}>
                    {t('community.share', '分享战术板')}
                </Button>
            </div>

            <div className={classes.filters}>
                <div className={classes.searchBox}>
                    <Input
                        placeholder={t('community.search', '搜索战术板...')}
                        value={searchQuery}
                        onChange={(e, data) => setSearchQuery(data.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button icon={<SearchFilled />} onClick={handleSearch}>
                        {t('community.searchBtn', '搜索')}
                    </Button>
                </div>

                <Select
                    value={selectedGame}
                    onChange={(e, data) => {
                        const game = data.value;
                        setSelectedGame(game);
                        // 切换游戏时重置分类为“全部”
                        setCategory('all');
                        setPage(1);
                    }}
                >
                    <option value="all">{t('community.game.all', '全部游戏')}</option>
                    {GAME_CATEGORIES.map((game) => (
                        <option key={game.value} value={game.value}>
                            {game.label}
                        </option>
                    ))}
                </Select>

                <Select
                    value={category}
                    onChange={(e, data) => {
                        setCategory(data.value);
                        setPage(1);
                    }}
                >
                    <option value="all">{t('community.category.all', '全部分类')}</option>
                    {selectedGame === 'all'
                        ? // 全部游戏：显示所有分类，带游戏名前缀
                          GAME_CATEGORIES.flatMap((game) =>
                              game.children.map((cat) => (
                                  <option key={cat.value} value={cat.value}>
                                      {game.label} - {cat.label}
                                  </option>
                              )),
                          )
                        : // 特定游戏：只显示该游戏的分类
                          GAME_CATEGORIES.find((g) => g.value === selectedGame)?.children.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                  {cat.label}
                              </option>
                          ))}
                </Select>

                <Select value={sortBy} onChange={(e, data) => setSortBy(data.value)}>
                    <option value="created_at">{t('community.sort.latest', '最新')}</option>
                    <option value="view_count">{t('community.sort.popular', '最热')}</option>
                    <option value="download_count">{t('community.sort.downloads', '下载最多')}</option>
                    <option value="like_count">{t('community.sort.likes', '点赞最多')}</option>
                </Select>
            </div>

            <div className={classes.content}>
                {loading ? (
                    <div className={classes.loading}>
                        <Spinner label={t('community.loading', '加载中...')} />
                    </div>
                ) : (
                    <div className={classes.grid}>
                        {plans.map((plan) => (
                            <Card
                                key={plan.share_id}
                                className={classes.card}
                                onClick={() => setSelectedPlan(plan)}
                                appearance="subtle"
                            >
                                {plan.thumbnail && (
                                    <div className={classes.thumbnailWrapper}>
                                        <img src={plan.thumbnail} alt={plan.title} className={classes.thumbnail} />
                                    </div>
                                )}

                                <div className={classes.cardContent}>
                                    <div className={classes.cardHeaderSection}>
                                        <Text weight="semibold" className={classes.cardTitle}>
                                            {plan.title}
                                        </Text>
                                        <div className={classes.metaRow}>
                                            <div className={classes.badges}>
                                                <Badge appearance="outline" size="small">
                                                    {getGameByValue(plan.game)?.label || plan.game}
                                                </Badge>
                                                <Badge appearance="tint" size="small">
                                                    {getCategoryByValue(plan.category)?.label || plan.category}
                                                </Badge>
                                            </div>
                                            <div className={classes.cardAuthorContainer}>
                                                {plan.author_avatar ? (
                                                    <img
                                                        src={plan.author_avatar}
                                                        alt={plan.author}
                                                        className={classes.avatarImage}
                                                    />
                                                ) : (
                                                    <div className={classes.avatarPlaceholder}>
                                                        {plan.author.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <Text size={200} className={classes.cardAuthor}>
                                                    {plan.author}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={classes.statsRow}>
                                        <div className={classes.stat}>
                                            <EyeFilled fontSize={16} />
                                            <Text size={200}>{plan.view_count}</Text>
                                        </div>
                                        <div className={classes.stat}>
                                            <ArrowDownloadFilled fontSize={16} />
                                            <Text size={200}>{plan.download_count}</Text>
                                        </div>
                                        <div className={classes.stat}>
                                            <HeartFilled fontSize={16} />
                                            <Text size={200}>{plan.like_count}</Text>
                                        </div>
                                    </div>

                                    <div className={classes.actions}>
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={plan.user_liked ? <HeartFilled /> : <HeartRegular />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLike(plan.share_id);
                                            }}
                                        >
                                            {t('community.like', '点赞')}
                                        </Button>
                                        <Button
                                            size="small"
                                            appearance="primary"
                                            icon={<ArrowDownloadFilled />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(plan);
                                            }}
                                        >
                                            {t('community.download', '下载')}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {!loading && plans.length === 0 && (
                    <div className={classes.empty}>
                        <Text>{t('community.empty', '暂无战术板')}</Text>
                    </div>
                )}
            </div>

            {total > 0 && (
                <div className={classes.pagination}>
                    <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
                        {t('community.prev', '上一页')}
                    </Button>
                    <Text>
                        {page} / {Math.ceil(total / 12)}
                    </Text>
                    <Button disabled={page >= Math.ceil(total / 12)} onClick={() => setPage(page + 1)}>
                        {t('community.next', '下一页')}
                    </Button>
                </div>
            )}

            <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={fetchPlans} />

            {selectedPlan && (
                <PlanDetailDialog
                    plan={selectedPlan}
                    onClose={() => setSelectedPlan(null)}
                    onDownload={handleDownload}
                />
            )}
        </div>
    );
};

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusXLarge,
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXL}`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingLeft: '20px',
        backgroundColor: tokens.colorNeutralBackground1,
    },
    filters: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
        flexWrap: 'wrap',
        alignItems: 'center',
        backgroundColor: tokens.colorNeutralBackground2,
    },
    searchBox: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        flex: '1 1 300px',
        minWidth: '250px',
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: tokens.spacingHorizontalXL,
        paddingTop: tokens.spacingVerticalL,
        paddingBottom: tokens.spacingVerticalL,
        scrollbarWidth: 'thin',
        minHeight: 0,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: tokens.spacingVerticalXXL,
        '@media (max-width: 1200px)': {
            gridTemplateColumns: 'repeat(3, 1fr)',
        },
        '@media (max-width: 900px)': {
            gridTemplateColumns: 'repeat(2, 1fr)',
        },
        '@media (max-width: 600px)': {
            gridTemplateColumns: 'repeat(1, 1fr)',
        },
    },
    card: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        borderRadius: tokens.borderRadiusLarge,
        overflow: 'hidden',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: `0 2px 8px rgba(0, 0, 0, 0.08)`,
        ':hover': {
            transform: 'translateY(-6px)',
            boxShadow: `0 12px 24px rgba(0, 0, 0, 0.15)`,
        },
    },
    thumbnailWrapper: {
        width: '100%',
        height: '180px',
        overflow: 'hidden',
        backgroundColor: tokens.colorNeutralBackground3,
        flexShrink: 0,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        padding: tokens.spacingHorizontalL,
        flex: 1,
    },
    cardHeaderSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    cardTitle: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        lineHeight: '1.4',
        color: tokens.colorNeutralForeground1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: '2',
        WebkitBoxOrient: 'vertical',
    },
    metaRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    badges: {
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
        flexWrap: 'wrap',
    },
    cardAuthorContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    cardAuthor: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        lineHeight: '1.4',
    },
    avatarImage: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        objectFit: 'cover',
        border: `2px solid ${tokens.colorNeutralStroke2}`,
    },
    avatarPlaceholder: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundInverted,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${tokens.colorBrandStroke1}`,
    },
    statsRow: {
        display: 'flex',
        gap: tokens.spacingHorizontalL,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderRadius: tokens.borderRadiusMedium,
        justifyContent: 'space-around',
    },
    stat: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXXS,
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase200,
    },
    actions: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        justifyContent: 'space-between',
        marginTop: 'auto',
    },
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
    },
    empty: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase400,
    },
    pagination: {
        display: 'flex',
        justifyContent: 'right',
        alignItems: 'center',
        gap: tokens.spacingHorizontalL,
        padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground1,
        flexShrink: 0,
    },
});
