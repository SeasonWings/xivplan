import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Dropdown,
    Input,
    Label,
    Option,
    Spinner,
    Textarea,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { config } from '../config';

const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'XIVPlan';

const useStyles = makeStyles({
    dialogSurface: {
        maxWidth: '800px', // 增加宽度以容纳左右布局
        width: '100%',
    },
    content: {
        display: 'flex',
        flexDirection: 'row', // 改为水平布局
        gap: tokens.spacingHorizontalL,
        alignItems: 'flex-start',
    },
    formContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        minWidth: '300px', // 确保表单有最小宽度
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    groupSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalM,
        paddingLeft: tokens.spacingHorizontalL,
        borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
        width: '176px', // 固定右侧宽度
        flexShrink: 0,
    },
    groupImage: {
        width: '100%',
        height: 'auto',
        maxHeight: '232px', // 限制图片高度
        objectFit: 'contain',
        borderRadius: tokens.borderRadiusMedium,
        boxShadow: tokens.shadow4,
    },
});

interface FeedbackDialogProps {
    open: boolean;
    onClose: () => void;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ open, onClose }) => {
    const classes = useStyles();
    const { state: authState } = useAuth();

    const [content, setContent] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [type, setType] = useState('suggestion');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim()) {
            setError('请输入反馈内容');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const API_BASE = config.api.baseUrl;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // 如果用户已登录，添加认证头
            if (authState.token) {
                headers['Authorization'] = `Bearer ${authState.token}`;
            }

            const response = await fetch(`${API_BASE}/feedback`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    content,
                    contactInfo,
                    type,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
                setTimeout(() => {
                    handleClose();
                }, 1500);
            } else {
                setError(data.error || '提交失败，请稍后重试');
            }
        } catch (err) {
            console.error('Submit feedback error:', err);
            setError('提交失败，请检查网络连接');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        // 重置状态
        setTimeout(() => {
            setContent('');
            setContactInfo('');
            setType('suggestion');
            setError(null);
            setSuccess(false);
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={(e, data) => !data.open && handleClose()}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>意见反馈</DialogTitle>
                    <DialogContent>
                        {success ? (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                <h3>感谢您的反馈！</h3>
                                <p>我们会认真阅读每一条建议。</p>
                            </div>
                        ) : (
                            <div className={classes.content}>
                                <div className={classes.formContainer}>
                                    <div className={classes.field}>
                                        <Label required>反馈类型</Label>
                                        <Dropdown
                                            value={
                                                type === 'suggestion' ? '功能建议' : type === 'bug' ? 'Bug反馈' : '其他'
                                            }
                                            onOptionSelect={(_, data) => setType(data.optionValue as string)}
                                        >
                                            <Option value="suggestion">功能建议</Option>
                                            <Option value="bug">Bug反馈</Option>
                                            <Option value="other">其他</Option>
                                        </Dropdown>
                                    </div>

                                    <div className={classes.field}>
                                        <Label required>反馈内容</Label>
                                        <Textarea
                                            value={content}
                                            onChange={(e, data) => setContent(data.value)}
                                            rows={5}
                                            placeholder="请详细描述您的问题或建议..."
                                        />
                                    </div>

                                    <div className={classes.field}>
                                        <Label>联系方式 (选填)</Label>
                                        <Input
                                            value={contactInfo}
                                            onChange={(e, data) => setContactInfo(data.value)}
                                            placeholder="邮箱或QQ，方便我们联系您"
                                        />
                                    </div>

                                    {error && <div style={{ color: tokens.colorPaletteRedForeground1 }}>{error}</div>}
                                </div>

                                <div className={classes.groupSection}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                            加入 {APP_TITLE} 交流群
                                        </div>
                                        <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>
                                            群号: 662560323
                                        </div>
                                    </div>
                                    <img src="/QQ/qq.jpg" alt={`${APP_TITLE} 交流群`} className={classes.groupImage} />
                                </div>
                            </div>
                        )}
                    </DialogContent>
                    {!success && (
                        <DialogActions>
                            <Button appearance="secondary" onClick={handleClose} disabled={loading}>
                                取消
                            </Button>
                            <Button appearance="primary" onClick={handleSubmit} disabled={loading}>
                                {loading ? <Spinner size="tiny" /> : '提交反馈'}
                            </Button>
                        </DialogActions>
                    )}
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
