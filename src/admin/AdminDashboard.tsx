import {
    Badge,
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Dropdown,
    Option,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    Textarea,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { config } from '../config';

const useStyles = makeStyles({
    root: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor: tokens.colorNeutralBackground2,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    filterBar: {
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusMedium,
    },
    tableContainer: {
        flex: 1,
        overflow: 'auto',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusMedium,
        padding: '10px',
    },
    actionCell: {
        display: 'flex',
        gap: '5px',
    },
    replyDialog: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
    },
});

interface Feedback {
    id: number;
    user_id: string | null;
    username: string | null;
    content: string;
    contact_info: string | null;
    type: 'suggestion' | 'bug' | 'other';
    status: 'pending' | 'read' | 'resolved' | 'ignored';
    admin_reply: string | null;
    created_at: string;
    updated_at: string;
}

export const AdminDashboard: React.FC = () => {
    const classes = useStyles();
    const { state: authState } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Reply dialog state
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [newStatus, setNewStatus] = useState<string>('read');
    const [replyLoading, setReplyLoading] = useState(false);

    const fetchFeedbacks = React.useCallback(async () => {
        if (!authState.token) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(statusFilter !== 'all' && { status: statusFilter }),
            });

            const response = await fetch(`${config.api.baseUrl}/feedback?${params}`, {
                headers: {
                    Authorization: `Bearer ${authState.token}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setFeedbacks(data.data);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (error) {
            console.error('Failed to fetch feedbacks:', error);
        } finally {
            setLoading(false);
        }
    }, [authState.token, page, statusFilter]);

    useEffect(() => {
        fetchFeedbacks();
    }, [fetchFeedbacks]);

    const handleStatusChange = async (id: number, status: string, reply?: string) => {
        setReplyLoading(true);
        try {
            const response = await fetch(`${config.api.baseUrl}/feedback/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authState.token}`,
                },
                body: JSON.stringify({
                    status,
                    ...(reply && { adminReply: reply }),
                }),
            });

            const data = await response.json();
            if (data.success) {
                fetchFeedbacks();
                setSelectedFeedback(null);
                setReplyContent('');
            }
        } catch (error) {
            console.error('Failed to update feedback:', error);
        } finally {
            setReplyLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'warning';
            case 'read':
                return 'brand';
            case 'resolved':
                return 'success';
            case 'ignored':
                return 'danger';
            default:
                return 'subtle';
        }
    };

    if (!authState.isAuthenticated || authState.user?.role !== 'admin') {
        return (
            <div className={classes.root} style={{ justifyContent: 'center', alignItems: 'center' }}>
                <h2>需要管理员权限</h2>
            </div>
        );
    }

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <h2>用户反馈管理后台</h2>
                <Button onClick={() => fetchFeedbacks()}>刷新</Button>
            </div>

            <div className={classes.filterBar}>
                <span>状态筛选:</span>
                <Dropdown
                    value={statusFilter === 'all' ? '全部' : statusFilter}
                    onOptionSelect={(_, data) => {
                        setStatusFilter(data.optionValue as string);
                        setPage(1);
                    }}
                >
                    <Option value="all">全部</Option>
                    <Option value="pending">待处理</Option>
                    <Option value="read">已读</Option>
                    <Option value="resolved">已解决</Option>
                    <Option value="ignored">已忽略</Option>
                </Dropdown>
            </div>

            <div className={classes.tableContainer}>
                {loading ? (
                    <Spinner />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>ID</TableHeaderCell>
                                <TableHeaderCell>类型</TableHeaderCell>
                                <TableHeaderCell>内容</TableHeaderCell>
                                <TableHeaderCell>用户/联系方式</TableHeaderCell>
                                <TableHeaderCell>状态</TableHeaderCell>
                                <TableHeaderCell>时间</TableHeaderCell>
                                <TableHeaderCell>操作</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {feedbacks.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.id}</TableCell>
                                    <TableCell>
                                        <Badge appearance="outline">{item.type}</Badge>
                                    </TableCell>
                                    <TableCell style={{ maxWidth: '300px', whiteSpace: 'pre-wrap' }}>
                                        {item.content}
                                        {item.admin_reply && (
                                            <div style={{ marginTop: '5px', color: tokens.colorBrandForeground1 }}>
                                                回复: {item.admin_reply}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div>{item.username || '匿名'}</div>
                                        <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>
                                            {item.contact_info}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            appearance="filled"
                                            color={
                                                getStatusColor(item.status) as
                                                    | 'warning'
                                                    | 'brand'
                                                    | 'success'
                                                    | 'danger'
                                                    | 'subtle'
                                            }
                                        >
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                                    <TableCell className={classes.actionCell}>
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setSelectedFeedback(item);
                                                setReplyContent(item.admin_reply || '');
                                                setNewStatus(item.status);
                                            }}
                                        >
                                            处理
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                        上一页
                    </Button>
                    <span>
                        {page} / {totalPages}
                    </span>
                    <Button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                        下一页
                    </Button>
                </div>
            )}

            {/* 处理反馈对话框 */}
            {selectedFeedback && (
                <Dialog open={true} onOpenChange={() => setSelectedFeedback(null)}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>处理反馈 #{selectedFeedback.id}</DialogTitle>
                            <DialogContent className={classes.replyDialog}>
                                <div>
                                    <strong>原始内容:</strong>
                                    <div
                                        style={{
                                            padding: '10px',
                                            background: tokens.colorNeutralBackground3,
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {selectedFeedback.content}
                                    </div>
                                </div>

                                <div>
                                    <label>状态变更:</label>
                                    <Dropdown
                                        value={newStatus}
                                        onOptionSelect={(_, data) => setNewStatus(data.optionValue as string)}
                                        style={{ width: '100%' }}
                                    >
                                        <Option value="pending">待处理</Option>
                                        <Option value="read">已读</Option>
                                        <Option value="resolved">已解决</Option>
                                        <Option value="ignored">已忽略</Option>
                                    </Dropdown>
                                </div>

                                <div>
                                    <label>管理员回复:</label>
                                    <Textarea
                                        value={replyContent}
                                        onChange={(e, data) => setReplyContent(data.value)}
                                        rows={4}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setSelectedFeedback(null)}>
                                    取消
                                </Button>
                                <Button
                                    appearance="primary"
                                    disabled={replyLoading}
                                    onClick={() => handleStatusChange(selectedFeedback.id, newStatus, replyContent)}
                                >
                                    {replyLoading ? <Spinner size="tiny" /> : '保存'}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}
        </div>
    );
};
