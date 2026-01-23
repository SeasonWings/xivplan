import React, { useState } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Input,
    Textarea,
    Field,
    makeStyles,
    tokens,
} from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { useScene } from '../SceneProvider';
import { sceneToText } from '../file';
import { config } from '../config';
import type { UploadPlanData } from './types';
import { CategorySelector } from './CategorySelector';
import { getGameByCategory } from './categoryConfig';
import { useAuth } from '../auth/AuthContext';

const API_BASE = config.api.baseUrl;

interface UploadDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const UploadDialog: React.FC<UploadDialogProps> = ({ open, onClose, onSuccess }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { scene } = useScene();
    const { state: authState } = useAuth();

    // 从认证状态获取用户ID，如果未登录则使用从场景上下文获取的ID作为备选
    const userId = authState.user?.id;

    const [formData, setFormData] = useState<UploadPlanData>({
        title: '',
        description: '',
        author: authState.user?.username || '',
        authorId: authState.user?.id || userId || undefined,
        sceneData: '',
        game: 'ff14',
        category: 'ff14_general',
        dungeonName: '',
        tags: [],
    });

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        // 检查用户是否已登录
        if (!authState.isAuthenticated) {
            setError(t('community.upload.error.notLoggedIn', '请先登录后再分享'));
            return;
        }

        // 验证必填字段
        if (!formData.title) {
            setError(t('community.upload.error.required', '请填写标题'));
            return;
        }

        if (!scene) {
            setError(t('community.upload.error.noScene', '没有可分享的战术板'));
            return;
        }

        setUploading(true);
        setError('');

        try {
            // 将场景数据转换为压缩文本
            const sceneData = sceneToText(scene);

            // TODO: 生成缩略图
            // const thumbnail = await generateThumbnail(scene);

            // 使用认证用户的用户名和ID，而不是从前端传入的author
            const uploadData = {
                ...formData,
                sceneData,
                // 从前端移除author字段，后端会使用认证用户的信息
            };

            // 添加认证头部
            const token = localStorage.getItem('xivplan_auth_token');

            // 添加调试日志
            console.log('Uploading plan with data:', {
                title: uploadData.title,
                game: uploadData.game,
                category: uploadData.category,
                dungeonName: uploadData.dungeonName,
            });

            const response = await fetch(`${API_BASE}/community/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(uploadData),
            });

            const result = await response.json();

            if (result.success) {
                onSuccess?.();
                onClose();
                // 重置表单
                setFormData({
                    title: '',
                    description: '',
                    author: authState.user?.username || '',
                    authorId: authState.user?.id || userId || undefined,
                    sceneData: '',
                    game: 'ff14',
                    category: 'ff14_general',
                    dungeonName: '',
                    tags: [],
                });
            } else {
                setError(result.error || t('community.upload.error.failed', '上传失败'));
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError(t('community.upload.error.network', '网络错误,请稍后重试'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(e, data) => !data.open && onClose()}>
            <DialogSurface className={classes.surface}>
                <DialogBody>
                    <DialogTitle>{t('community.upload.title', '分享战术板到社区')}</DialogTitle>
                    <DialogContent className={classes.content}>
                        <Field label={t('community.upload.titleLabel', '标题')} required>
                            <Input
                                value={formData.title}
                                onChange={(e, data) => setFormData({ ...formData, title: data.value })}
                                placeholder={t('community.upload.titlePlaceholder', '为你的战术板起一个标题')}
                            />
                        </Field>

                        {/*{authState.isAuthenticated && (*/}
                        {/*    <Field label={t('community.upload.author', '作者')}>*/}
                        {/*        <Input*/}
                        {/*            value={authState.user?.username || ''}*/}
                        {/*            readOnly*/}
                        {/*            placeholder={t('community.upload.authorPlaceholder', '你的名字')}*/}
                        {/*        />*/}
                        {/*    </Field>*/}
                        {/*)}*/}

                        <CategorySelector
                            value={formData.category}
                            onChange={(category) => {
                                // 根据分类确定所属游戏
                                const game = getGameByCategory(category);
                                setFormData({
                                    ...formData,
                                    game: game?.value || 'ff14',
                                    category,
                                });
                            }}
                            required
                        />

                        <Field label={t('community.upload.dungeonName', '副本名称')}>
                            <Input
                                value={formData.dungeonName}
                                onChange={(e, data) => setFormData({ ...formData, dungeonName: data.value })}
                                placeholder={t('community.upload.dungeonPlaceholder', '例如:绝龙诗战争')}
                            />
                        </Field>

                        <Field label={t('community.upload.description', '描述')}>
                            <Textarea
                                value={formData.description}
                                onChange={(e, data) => setFormData({ ...formData, description: data.value })}
                                placeholder={t('community.upload.descriptionPlaceholder', '描述这个战术板的用途和特点')}
                                rows={4}
                            />
                        </Field>

                        {error && <div className={classes.error}>{error}</div>}
                    </DialogContent>
                </DialogBody>
                <DialogActions className={classes.bottomButtons}>
                    <Button appearance="secondary" onClick={onClose} disabled={uploading}>
                        {t('community.upload.cancel', '取消')}
                    </Button>
                    <Button appearance="primary" onClick={handleSubmit} disabled={uploading}>
                        {uploading
                            ? t('community.upload.uploading', '上传中...')
                            : t('community.upload.submit', '分享')}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    );
};

const useStyles = makeStyles({
    surface: {
        maxWidth: '600px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        padding: tokens.spacingVerticalS,
        backgroundColor: tokens.colorPaletteRedBackground1,
        borderRadius: tokens.borderRadiusMedium,
    },
    bottomButtons: {
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        paddingTop: '20px',
    },
});
