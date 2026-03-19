import { Button, Tooltip } from '@fluentui/react-components';
import { ImageAddRegular } from '@fluentui/react-icons';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth/AuthContext';
import { config } from './config';

interface ImageUploadButtonProps {
    onImageUpload: (url: string) => void;
    className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({ onImageUpload, className }) => {
    const { t } = useTranslation();
    const { state: authState } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!authState.isAuthenticated) {
            alert(t('auth.loginRequired', '请先登录以使用上传功能'));
            event.target.value = '';
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert(t('error.fileTooLarge', '文件太大，最大支持 5MB'));
            event.target.value = '';
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('xivplan_auth_token');
            const response = await fetch(`${config.api.baseUrl}/user-assets/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            const data = await response.json();
            onImageUpload(data.url);
        } catch (err: unknown) {
            console.error('Upload error:', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            alert(t('error.uploadFailed', '上传失败: ') + message);
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const handleClick = () => {
        if (!authState.isAuthenticated) {
            alert(t('auth.loginRequired', '请先登录以使用上传功能'));
            return;
        }
        fileInputRef.current?.click();
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
            />
            <Tooltip content={t('properties.uploadImage', '上传图片')} relationship="label">
                <Button
                    icon={<ImageAddRegular />}
                    onClick={handleClick}
                    className={className}
                    disabled={uploading}
                    aria-label={t('properties.uploadImage', '上传图片')}
                />
            </Tooltip>
        </>
    );
};
