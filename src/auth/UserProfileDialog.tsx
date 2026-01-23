import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogContent,
    DialogActions,
    Button,
    Input,
    Textarea,
    Avatar,
    makeStyles,
    tokens,
    Spinner,
    Text,
    Field,
} from '@fluentui/react-components';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

const useStyles = makeStyles({
    surface: {
        maxWidth: '500px',
        width: '90%',
    },
    profileHeader: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: tokens.spacingVerticalL,
    },
    avatar: {
        width: '80px',
        height: '80px',
        marginBottom: tokens.spacingVerticalM,
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    input: {
        width: '100%',
    },
    error: {
        color: tokens.colorPaletteRedForeground1,
        marginTop: tokens.spacingVerticalXS,
    },
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacingVerticalL,
    },
    avatarSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalM,
        marginBottom: tokens.spacingVerticalM,
    },
    avatarUpload: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalS,
    },
    bottomButtons: {
        display: 'flex',
        justifyContent: 'center',
        gap: tokens.spacingHorizontalM,
    },
});

interface UserProfileDialogProps {
    open: boolean;
    onClose: () => void;
}

export const UserProfileDialog: React.FC<UserProfileDialogProps> = ({ open, onClose }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { state, updateUserProfile } = useAuth();

    const [formData, setFormData] = useState({
        username: '',
        avatar: '',
        bio: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);
    const errorsRef = useRef(errors);

    // 重置表单数据到用户初始状态的函数
    const resetFormToUserData = () => {
        if (state.user) {
            setFormData({
                username: state.user.username || '',
                avatar: state.user.avatar || '',
                bio: state.user.bio || '',
            });
            setAvatarPreview(state.user.avatar || null);
            setAvatarFile(null);
        }
    };

    // 初始化表单数据
    useEffect(() => {
        if (open && state.user) {
            // 仅在对话框打开时初始化表单数据
            resetFormToUserData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, state.user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        // Clear error when user types
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // 验证文件类型
            if (!file.type.match('image.*')) {
                setErrors({
                    ...errors,
                    avatar: t('auth.invalidImageFormat', '请选择有效的图片格式'),
                });
                return;
            }

            setAvatarFile(file);

            // 创建预览图片
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
                // 显示裁剪界面
                setShowCropper(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username) {
            newErrors.username = t('auth.usernameRequired', '用户名不能为空');
        } else if (formData.username.length < 3) {
            newErrors.username = t('auth.usernameTooShort', '用户名至少需要3个字符');
        } else if (formData.username.length > 20) {
            newErrors.username = t('auth.usernameTooLong', '用户名不能超过20个字符');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            const updatedFormData = { ...formData };

            // 如果有新的头像文件，先处理头像
            if (avatarFile) {
                let base64String: string;

                if (croppedImage) {
                    // 使用裁剪后的图像
                    base64String = croppedImage;
                } else {
                    // 将文件转换为base64
                    base64String = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(avatarFile);
                    });
                }

                // 检查文件大小，如果超过限制则压缩
                const base64Data = base64String.split(',')[1];
                if (base64Data) {
                    const byteLength = new Blob([atob(base64Data)]).size;
                    if (byteLength > 100 * 1024) {
                        base64String = await compressImage(base64String);
                    }
                }

                updatedFormData.avatar = base64String;
            }

            // 更新用户资料
            await updateUserProfile(updatedFormData);
            // 重置表单状态后再关闭
            if (Object.keys(errorsRef.current).length > 0) {
                setErrors({});
            }
            setTimeout(() => {
                onClose();
            }, 0);
        } catch (error) {
            setErrors({
                general: error instanceof Error ? error.message : t('auth.profileUpdateFailed', '资料更新失败'),
            });
            setSubmitting(false);
        }
    };

    // 当对话框打开状态改变时，重置错误状态
    useEffect(() => {
        if (!open) {
            // 对话框关闭时重置状态，避免下次打开时显示旧错误
            const timer = setTimeout(() => {
                setErrors({});
                setSubmitting(false);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // 图像压缩函数
    const compressImage = (base64: string, quality: number = 0.8): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 设置画布尺寸
                canvas.width = img.width;
                canvas.height = img.height;

                // 绘制图像
                ctx?.drawImage(img, 0, 0);

                // 压缩图像
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

                // 如果仍然太大，递归压缩
                if (compressedBase64.length > 100 * 1024 && quality > 0.1) {
                    resolve(compressImage(compressedBase64, quality - 0.1));
                } else {
                    resolve(compressedBase64);
                }
            };
        });
    };

    // 裁剪区域变更回调
    const onCropComplete = useCallback(
        (
            _: { x: number; y: number; width: number; height: number },
            croppedAreaPixels: { x: number; y: number; width: number; height: number },
        ) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        [],
    );

    // 裁剪图像函数
    const cropImage = async (): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!avatarPreview) {
                reject(new Error('No image to crop'));
                return;
            }

            const image = new Image();
            image.src = avatarPreview;

            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx || !croppedAreaPixels) {
                    reject(new Error('Canvas context or crop area not available'));
                    return;
                }

                // 设置画布尺寸为裁剪区域的尺寸
                canvas.width = croppedAreaPixels.width;
                canvas.height = croppedAreaPixels.height;

                // 绘制裁剪区域
                ctx.drawImage(
                    image,
                    croppedAreaPixels.x,
                    croppedAreaPixels.y,
                    croppedAreaPixels.width,
                    croppedAreaPixels.height,
                    0,
                    0,
                    croppedAreaPixels.width,
                    croppedAreaPixels.height,
                );

                // 获取裁剪后的图像数据
                const croppedBase64 = canvas.toDataURL('image/jpeg', 1.0);
                resolve(croppedBase64);
            };

            image.onerror = () => {
                reject(new Error('Failed to load image'));
            };
        });
    };

    const handleCancel = () => {
        // 重置表单数据
        resetFormToUserData();
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(e, data) => !data.open && handleCancel()}>
            <DialogSurface className={classes.surface}>
                {/*<DialogTitle */}
                {/*  action={*/}
                {/*    <Button */}
                {/*      appearance="subtle" */}
                {/*      icon={<DismissRegular />} */}
                {/*      onClick={handleCancel} */}
                {/*    />*/}
                {/*  }*/}
                {/*>*/}
                {/*  {t('auth.editProfile', '编辑资料')}*/}
                {/*</DialogTitle>*/}
                <DialogBody>
                    <DialogContent>
                        {state.isLoading && !submitting ? (
                            <div className={classes.loading}>
                                <Spinner label={t('auth.loading', '加载中...')} />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className={classes.form}>
                                <div className={classes.profileHeader}>
                                    <div className={classes.avatarSection}>
                                        {showCropper && avatarPreview ? (
                                            <div
                                                style={{
                                                    position: 'relative',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        position: 'relative',
                                                        width: '300px',
                                                        height: '300px',
                                                        margin: '0 auto',
                                                    }}
                                                >
                                                    <Cropper
                                                        image={avatarPreview}
                                                        crop={crop}
                                                        zoom={zoom}
                                                        aspect={1}
                                                        onCropChange={setCrop}
                                                        onZoomChange={setZoom}
                                                        onCropComplete={onCropComplete}
                                                        cropShape="round"
                                                        showGrid={false}
                                                        objectFit="contain"
                                                    />
                                                </div>
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: '10px',
                                                        marginTop: '10px',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <span>缩放:</span>
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="3"
                                                        step="0.1"
                                                        value={zoom}
                                                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                                                        style={{ width: '100px' }}
                                                    />
                                                    <Button
                                                        appearance="primary"
                                                        onClick={async () => {
                                                            try {
                                                                const cropped = await cropImage();
                                                                setCroppedImage(cropped);
                                                                setAvatarPreview(cropped); // 更新预览
                                                                setShowCropper(false);
                                                            } catch (error) {
                                                                console.error('裁剪图像失败:', error);
                                                                setErrors({
                                                                    ...errors,
                                                                    avatar: t('auth.avatarCropFailed', '头像裁剪失败'),
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        {t('auth.confirmCrop', '确认裁剪')}
                                                    </Button>
                                                    <Button
                                                        appearance="secondary"
                                                        onClick={() => {
                                                            setShowCropper(false);
                                                            setAvatarPreview(null);
                                                            setAvatarFile(null);
                                                        }}
                                                    >
                                                        {t('common.cancel', '取消')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Avatar
                                                    className={classes.avatar}
                                                    image={{ src: avatarPreview || undefined }}
                                                    name={formData.username || state.user?.username || ''}
                                                    badge={{ status: 'available' }}
                                                />
                                                <div className={classes.avatarUpload}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleAvatarChange}
                                                        style={{ display: 'none' }}
                                                        id="avatar-upload"
                                                    />
                                                    <Button
                                                        appearance="secondary"
                                                        tabIndex={0}
                                                        onClick={() => {
                                                            const fileInput = document.getElementById(
                                                                'avatar-upload',
                                                            ) as HTMLInputElement;
                                                            if (fileInput) {
                                                                fileInput.click();
                                                            }
                                                        }}
                                                    >
                                                        {t('auth.changeAvatar', '更换头像')}
                                                    </Button>
                                                    {/*<Text size={200} color="neutralSecondary">*/}
                                                    {/*  {t('auth.supportedImageFormats', '支持 JPG, PNG, GIF 格式')}*/}
                                                    {/*</Text>*/}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <Field
                                        validationState={errors.username ? 'error' : 'none'}
                                        validationMessage={errors.username}
                                    >
                                        <Input
                                            name="username"
                                            placeholder={t('auth.usernamePlaceholder', '请输入用户名')}
                                            value={formData.username}
                                            onChange={handleChange}
                                            className={classes.input}
                                            required
                                        />
                                    </Field>
                                </div>

                                <Textarea
                                    name="bio"
                                    placeholder={t('auth.bioPlaceholder', '请输入个人简介')}
                                    value={formData.bio}
                                    onChange={handleChange}
                                    className={classes.input}
                                    resize="vertical"
                                    rows={4}
                                />

                                {errors.general && <Text className={classes.error}>{errors.general}</Text>}

                                <DialogActions className={classes.bottomButtons}>
                                    <Button
                                        type="button"
                                        appearance="secondary"
                                        onClick={handleCancel}
                                        disabled={submitting}
                                    >
                                        {t('common.cancel', '取消')}
                                    </Button>
                                    <Button type="submit" appearance="primary" disabled={submitting}>
                                        {submitting ? <Spinner size="tiny" /> : t('auth.saveChanges', '保存更改')}
                                    </Button>
                                </DialogActions>
                            </form>
                        )}
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
