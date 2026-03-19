import { Text, makeStyles, tokens } from '@fluentui/react-components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { config } from '../config';
import { ImageUploadButton } from '../ImageUploadButton';
import { CustomAssetIcon } from '../prefabs/CustomAsset';
import { Section } from './Section';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalS,
        padding: tokens.spacingHorizontalS,
    },
    uploadContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalS,
        padding: tokens.spacingVerticalL,
    },
});

interface UserAsset {
    id: number;
    asset_url: string;
    file_name: string;
}

export const CustomAssetsSection: React.FC = () => {
    const { t } = useTranslation();
    const { state: authState } = useAuth();
    const [assets, setAssets] = useState<UserAsset[]>([]);
    const classes = useStyles();

    const fetchAssets = useCallback(async () => {
        if (!authState.isAuthenticated) return;

        try {
            const token = localStorage.getItem('xivplan_auth_token');
            const response = await fetch(`${config.api.baseUrl}/user-assets`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setAssets(data.assets || []);
            }
        } catch (err) {
            console.error('Failed to fetch assets:', err);
        }
    }, [authState.isAuthenticated]);

    const deleteAsset = async (id: number) => {
        if (!window.confirm(t('common.confirmDelete', '确定要删除吗？'))) return;

        try {
            const token = localStorage.getItem('xivplan_auth_token');
            const response = await fetch(`${config.api.baseUrl}/user-assets/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                fetchAssets();
            } else {
                const error = await response.json();
                alert(t('error.deleteFailed', '删除失败: ') + (error.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Failed to delete asset:', err);
            alert(t('error.deleteFailed', '删除失败'));
        }
    };

    useEffect(() => {
        let ignore = false;

        if (authState.isAuthenticated) {
            // Force it to be asynchronous to satisfy the linter and avoid cascading renders
            void Promise.resolve().then(async () => {
                if (!ignore) {
                    await fetchAssets();
                }
            });
        } else {
            // Also force this to be asynchronous to satisfy the linter
            void Promise.resolve().then(() => {
                if (!ignore) {
                    setAssets([]);
                }
            });
        }

        return () => {
            ignore = true;
        };
    }, [authState.isAuthenticated, fetchAssets]);

    if (!authState.isAuthenticated) {
        return (
            <div className={classes.uploadContainer}>
                <Text>{t('auth.loginToUpload', '请登录后上传自定义图案')}</Text>
            </div>
        );
    }

    return (
        <>
            <Section title={t('prefabs.customImages', '自定义图案')}>
                <div className={classes.container}>
                    {assets.map((asset) => (
                        <CustomAssetIcon
                            key={asset.id}
                            url={asset.asset_url}
                            name={asset.file_name}
                            onDelete={() => deleteAsset(asset.id)}
                        />
                    ))}
                    {assets.length < 10 && <ImageUploadButton onImageUpload={() => fetchAssets()} />}
                </div>
                <Text block align="center" size={200}>
                    {t('prefabs.customImagesLimit', '每个人最多上传 10 个图片 ({{count}}/10)', {
                        count: assets.length,
                    })}
                </Text>
            </Section>
        </>
    );
};
