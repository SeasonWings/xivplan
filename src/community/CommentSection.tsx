import { Avatar, Button, makeStyles, Spinner, Text, tokens, Textarea } from '@fluentui/react-components';
import { Delete20Regular, Send20Regular } from '@fluentui/react-icons';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { config } from '../config';
import type { Comment, CommentListResponse, CreateCommentData } from './types';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // 占满父容器高度
        gap: tokens.spacingVerticalL,
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusMedium,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${tokens.spacingVerticalL} ${tokens.spacingVerticalL} 0`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingBottom: tokens.spacingVerticalM,
        flexShrink: 0, // 防止压缩
    },
    title: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    commentForm: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        margin: `0 ${tokens.spacingVerticalL}`,
        flexShrink: 0, // 防止压缩
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    inputRow: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        alignItems: 'flex-end',
    },
    textareaWrapper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
    },
    formActions: {
        display: 'flex',
        flexDirection: 'row',
        gap: tokens.spacingHorizontalS,
        alignItems: 'center',
    },
    charCount: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        whiteSpace: 'nowrap',
        minWidth: '45px',
        textAlign: 'right',
    },
    commentList: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        padding: `${tokens.spacingVerticalM} ${tokens.spacingVerticalL} ${tokens.spacingVerticalL}`,
        overflowY: 'auto', // 添加滚动
        flex: 1, // 占据剩余空间
        scrollbarWidth: 'thin',
    },
    comment: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
    },
    commentAvatar: {
        flexShrink: 0,
    },
    commentContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    commentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    commentAuthor: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    commentTime: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    commentText: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
        lineHeight: tokens.lineHeightBase300,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    commentActions: {
        display: 'flex',
        gap: tokens.spacingHorizontalM,
        alignItems: 'center',
    },
    replyButton: {
        minWidth: 'auto',
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    },
    replies: {
        marginLeft: tokens.spacingHorizontalXXXL,
        paddingLeft: tokens.spacingHorizontalL,
        borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    loadMoreButton: {
        alignSelf: 'center',
    },
    emptyState: {
        textAlign: 'center',
        padding: tokens.spacingVerticalXXXL,
        color: tokens.colorNeutralForeground3,
        flexShrink: 0, // 防止压缩
    },
    loginPrompt: {
        textAlign: 'center',
        padding: tokens.spacingVerticalXL,
        margin: `0 ${tokens.spacingVerticalL}`,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        color: tokens.colorNeutralForeground2,
        flexShrink: 0, // 防止压缩
    },
    sortContainer: {
        display: 'flex',
        alignItems: 'center',
        padding: `${tokens.spacingVerticalS} ${tokens.spacingVerticalL}`,
        gap: tokens.spacingHorizontalXS,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    sortLabel: {
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
        marginRight: tokens.spacingHorizontalS,
    },
    sortButton: {
        minWidth: 'auto',
        padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightRegular,
        color: tokens.colorNeutralForeground3,
        '&:hover': {
            color: tokens.colorNeutralForeground2,
        },
    },
    sortButtonActive: {
        color: tokens.colorBrandForeground1,
        fontWeight: tokens.fontWeightSemibold,
        '&:hover': {
            color: tokens.colorBrandForeground1,
        },
    },
    replyIndicator: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorBrandForeground1,
        marginBottom: tokens.spacingVerticalXS,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        backgroundColor: tokens.colorBrandBackground2,
        borderRadius: tokens.borderRadiusSmall,
        width: 'fit-content',
    },
});

interface CommentSectionProps {
    shareId: string;
    onCommentCountChange?: () => void; // 评论数变化的回调
}

export const CommentSection: React.FC<CommentSectionProps> = ({ shareId, onCommentCountChange }) => {
    const classes = useStyles();
    const { state: authState } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [content, setContent] = useState('');
    const [replyTo, setReplyTo] = useState<{ commentId: number; userId: string; userName: string } | null>(null);
    const [loadingReplies, setLoadingReplies] = useState<number | null>(null);
    const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set()); // 追踪展开的评论
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 排序顺序，desc=最新，asc=最早

    // 格式化相对时间（B站风格）
    const formatRelativeTime = (dateString: string): string => {
        const now = new Date();
        const commentDate = new Date(dateString);
        const diffMs = now.getTime() - commentDate.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSeconds < 60) {
            return '刚刚';
        } else if (diffMinutes < 60) {
            return `${diffMinutes}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 30) {
            return `${diffDays}天前`;
        } else if (diffMonths < 12) {
            return `${diffMonths}个月前`;
        } else {
            return `${diffYears}年前`;
        }
    };

    // 加载评论列表
    const loadComments = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${config.api.baseUrl}/community/${shareId}/comments?order=${sortOrder}`);
            const data: CommentListResponse = await response.json();

            if (data.success) {
                setComments(data.data);
            }
        } catch (error) {
            console.error('加载评论失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadComments();
    }, [shareId, sortOrder]); // 添加 sortOrder 依赖

    // 发表评论或回复
    const handleSubmit = async () => {
        console.log('handleSubmit called', {
            content: content.trim(),
            hasToken: !!authState.token,
            isAuthenticated: authState.isAuthenticated,
            user: authState.user,
        });

        if (!content.trim()) {
            alert('评论内容不能为空');
            return;
        }

        if (!authState.token) {
            alert('请先登录');
            return;
        }

        try {
            setSubmitting(true);

            const commentData: CreateCommentData = {
                content: content.trim(),
            };

            if (replyTo) {
                commentData.parentId = replyTo.commentId;
                commentData.replyToUserId = replyTo.userId;
                commentData.replyToUserName = replyTo.userName;
            }

            console.log('Sending comment request', { commentData, token: authState.token });

            const response = await fetch(`${config.api.baseUrl}/community/${shareId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify(commentData),
            });

            const data = await response.json();
            console.log('Comment response', data);

            if (data.success) {
                // 重新加载评论列表
                await loadComments();
                setContent('');
                setReplyTo(null);
                // 通知父组件评论数变化
                onCommentCountChange?.();
            } else {
                alert(data.error || '发表评论失败');
            }
        } catch (error) {
            console.error('发表评论失败:', error);
            alert('发表评论失败，请稍后重试');
        } finally {
            setSubmitting(false);
        }
    };

    // 删除评论
    const handleDelete = async (commentId: number) => {
        if (!authState.token) return;
        if (!confirm('确定要删除这条评论吗？')) return;

        try {
            const response = await fetch(`${config.api.baseUrl}/community/${shareId}/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });

            const data = await response.json();

            if (data.success) {
                // 重新加载评论列表
                await loadComments();
                // 通知父组件评论数变化
                onCommentCountChange?.();
            } else {
                alert(data.error || '删除评论失败');
            }
        } catch (error) {
            console.error('删除评论失败:', error);
            alert('删除评论失败，请稍后重试');
        }
    };

    // 加载更多回复
    const loadMoreReplies = async (commentId: number) => {
        try {
            setLoadingReplies(commentId);
            const response = await fetch(`${config.api.baseUrl}/community/${shareId}/comments/${commentId}/replies`);
            const data: CommentListResponse = await response.json();

            if (data.success) {
                setComments((prevComments) =>
                    prevComments.map((comment) =>
                        comment.id === commentId ? { ...comment, replies: data.data } : comment,
                    ),
                );
                // 标记为已展开
                setExpandedComments((prev) => new Set(prev).add(commentId));
            }
        } catch (error) {
            console.error('加载回复失败:', error);
        } finally {
            setLoadingReplies(null);
        }
    };

    // 收起回复
    const collapseReplies = (commentId: number) => {
        setComments((prevComments) =>
            prevComments.map((comment) =>
                comment.id === commentId ? { ...comment, replies: comment.replies?.slice(0, 1) } : comment,
            ),
        );
        // 移除展开标记
        setExpandedComments((prev) => {
            const newSet = new Set(prev);
            newSet.delete(commentId);
            return newSet;
        });
    };

    // 渲染单个评论
    const renderComment = (comment: Comment, isReply = false, parentCommentId?: number) => (
        <div key={comment.id} className={classes.comment}>
            <Avatar
                className={classes.commentAvatar}
                name={comment.user_name}
                image={{ src: comment.user_avatar }}
                size={isReply ? 32 : 40}
            />
            <div className={classes.commentContent}>
                <div className={classes.commentHeader}>
                    <div>
                        <Text className={classes.commentAuthor}>{comment.user_name}</Text>
                        {comment.reply_to_user_name && (
                            <Text style={{ margin: `0 ${tokens.spacingHorizontalS}` }}>回复</Text>
                        )}
                        {comment.reply_to_user_name && (
                            <Text className={classes.commentAuthor}>@{comment.reply_to_user_name}</Text>
                        )}
                    </div>
                    <Text className={classes.commentTime}>{formatRelativeTime(comment.created_at)}</Text>
                </div>
                <Text className={classes.commentText}>{comment.content}</Text>
                <div className={classes.commentActions}>
                    {authState.isAuthenticated && (
                        <Button
                            appearance="subtle"
                            size="small"
                            className={classes.replyButton}
                            onClick={() =>
                                setReplyTo({
                                    commentId: parentCommentId || comment.id,
                                    userId: comment.user_id,
                                    userName: comment.user_name,
                                })
                            }
                        >
                            回复
                        </Button>
                    )}
                    {authState.user?.id === comment.user_id && (
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<Delete20Regular />}
                            className={classes.replyButton}
                            onClick={() => handleDelete(comment.id)}
                        >
                            删除
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className={classes.container}>
                <div style={{ textAlign: 'center', padding: tokens.spacingVerticalXXL }}>
                    <Spinner label="加载评论中..." />
                </div>
            </div>
        );
    }

    return (
        <div className={classes.container}>
            {/* 评论输入框 */}
            {authState.isAuthenticated ? (
                <div className={classes.commentForm}>
                    {replyTo && (
                        <div className={classes.replyIndicator}>
                            <Text>回复 @{replyTo.userName}</Text>
                            <Button appearance="transparent" size="small" onClick={() => setReplyTo(null)}>
                                取消
                            </Button>
                        </div>
                    )}
                    <div className={classes.inputRow}>
                        <div className={classes.textareaWrapper}>
                            <Textarea
                                placeholder={replyTo ? '写下你的回复...' : '写下你的评论...'}
                                value={content}
                                onChange={(_, data) => setContent(data.value)}
                                resize="none"
                                rows={2}
                                maxLength={100}
                                style={{
                                    borderRadius: tokens.borderRadiusMedium,
                                }}
                            />
                        </div>
                        <div className={classes.formActions}>
                            <Text className={classes.charCount}>{content.length}/100</Text>
                            <Button
                                appearance="primary"
                                icon={<Send20Regular />}
                                disabled={!content.trim() || submitting}
                                onClick={handleSubmit}
                            >
                                {submitting ? '发送中...' : replyTo ? '回复' : '发表'}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={classes.loginPrompt}>
                    <Text>登录后即可发表评论</Text>
                </div>
            )}

            {/* 评论列表 */}
            {comments.length === 0 ? (
                <div className={classes.emptyState}>
                    <Text>还没有评论，快来抢沙发吧！</Text>
                </div>
            ) : (
                <>
                    {/* 排序选择器 - B站风格 */}
                    <div className={classes.sortContainer}>
                        <Button
                            appearance="transparent"
                            size="small"
                            className={`${classes.sortButton} ${sortOrder === 'desc' ? classes.sortButtonActive : ''}`}
                            onClick={() => setSortOrder('desc')}
                        >
                            最近发表
                        </Button>
                        <Text style={{ color: tokens.colorNeutralForeground4 }}>|</Text>
                        <Button
                            appearance="transparent"
                            size="small"
                            className={`${classes.sortButton} ${sortOrder === 'asc' ? classes.sortButtonActive : ''}`}
                            onClick={() => setSortOrder('asc')}
                        >
                            最早发表
                        </Button>
                    </div>
                    <div className={classes.commentList}>
                        {comments.map((comment) => (
                            <div key={comment.id}>
                                {renderComment(comment)}
                                {/* 回复列表 */}
                                {comment.replies && comment.replies.length > 0 && (
                                    <div className={classes.replies}>
                                        {comment.replies.map((reply) => renderComment(reply, true, comment.id))}
                                        {comment.replyCount &&
                                            comment.replyCount > 1 &&
                                            (expandedComments.has(comment.id) ? (
                                                <Button
                                                    appearance="subtle"
                                                    size="small"
                                                    className={classes.loadMoreButton}
                                                    onClick={() => collapseReplies(comment.id)}
                                                >
                                                    收起回复
                                                </Button>
                                            ) : (
                                                <Button
                                                    appearance="subtle"
                                                    size="small"
                                                    className={classes.loadMoreButton}
                                                    disabled={loadingReplies === comment.id}
                                                    onClick={() => loadMoreReplies(comment.id)}
                                                >
                                                    {loadingReplies === comment.id
                                                        ? '加载中...'
                                                        : `查看全部 ${comment.replyCount} 条回复`}
                                                </Button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
