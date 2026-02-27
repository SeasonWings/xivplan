import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    Input,
    makeStyles,
    Spinner,
    Text,
    tokens,
} from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';

const useStyles = makeStyles({
    surface: {
        maxWidth: '500px',
        width: '90%',
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
    verificationSection: {
        display: 'flex',
        flexDirection: 'row',
        gap: tokens.spacingHorizontalXS,
        alignItems: 'center',
    },
    verificationInput: {
        flex: 1,
    },
    verificationButton: {
        minWidth: 'fit-content',
    },
    bottomLinks: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    bottomButtons: {
        display: 'flex',
        justifyContent: 'center',
    },
});

interface RegisterDialogProps {
    open: boolean;
    onClose: () => void;
    onSwitchToLogin?: () => void;
}

export const RegisterDialog: React.FC<RegisterDialogProps> = ({ open, onClose, onSwitchToLogin }) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { register } = useAuth();

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        verificationCode: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.username) {
            newErrors.username = t('auth.usernameRequired', '用户名不能为空');
        } else if (formData.username.length < 3) {
            newErrors.username = t('auth.usernameTooShort', '用户名至少需要3个字符');
        } else if (formData.username.length > 20) {
            newErrors.username = t('auth.usernameTooLong', '用户名不能超过20个字符');
        }

        if (!formData.email) {
            newErrors.email = t('auth.emailRequired', '邮箱不能为空');
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = t('auth.invalidEmailFormat', '邮箱格式不正确');
        }

        if (!formData.password) {
            newErrors.password = t('auth.passwordRequired', '密码不能为空');
        } else if (formData.password.length < 6) {
            newErrors.password = t('auth.passwordTooShort', '密码至少需要6个字符');
        }

        if (!formData.verificationCode) {
            newErrors.verificationCode = t('auth.verificationCodeRequired', '验证码不能为空');
        } else if (formData.verificationCode.length !== 6) {
            newErrors.verificationCode = t('auth.invalidVerificationCode', '验证码应为6位数字');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSendCode = async () => {
        if (!formData.email) {
            setErrors({
                ...errors,
                email: t('auth.emailRequired', '邮箱不能为空'),
            });
            return;
        }

        if (!/\S+@\S+\.\S+/.test(formData.email)) {
            setErrors({
                ...errors,
                email: t('auth.invalidEmailFormat', '邮箱格式不正确'),
            });
            return;
        }

        setSendingCode(true);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/request-register-code`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: formData.email }),
                },
            );

            const data = await response.json();

            if (data.success) {
                setCodeSent(true);
                setCountdown(60); // 60秒倒计时

                // 开始倒计时
                const timer = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);

                setErrors({});
            } else {
                setErrors({
                    verificationCode: data.error || t('auth.failedToSendCode', '发送验证码失败'),
                });
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t('auth.failedToSendCode', '发送验证码失败');
            setErrors({
                verificationCode: errorMessage,
            });
        } finally {
            setSendingCode(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSubmitting(true);
        try {
            await register(formData.username, formData.email, formData.password, formData.verificationCode);
            // 重置表单状态后再关闭
            setTimeout(() => {
                setFormData({
                    username: '',
                    email: '',
                    password: '',
                    verificationCode: '',
                });
                setErrors({});
                setCodeSent(false);
                setCountdown(0);
                onClose();
            }, 0);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t('auth.registrationFailed', '注册失败');
            setErrors({
                general: errorMessage,
            });
            setSubmitting(false);
        }
    };

    // 当对话框打开时，确保状态被重置
    useEffect(() => {
        if (open) {
            // 对话框打开时，重置所有状态
            setErrors({});
            setSubmitting(false);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(e, data) => !data.open && onClose()}>
            <DialogSurface className={classes.surface}>
                <DialogTitle>{t('auth.register', '注册')}</DialogTitle>
                <DialogBody>
                    <DialogContent>
                        {submitting ? (
                            <div className={classes.loading}>
                                <Spinner label={t('auth.registering', '注册中...')} />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className={classes.form}>
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

                                <Field
                                    validationState={errors.email ? 'error' : 'none'}
                                    validationMessage={errors.email}
                                >
                                    <Input
                                        name="email"
                                        type="email"
                                        placeholder={t('auth.emailPlaceholder', '请输入邮箱')}
                                        value={formData.email}
                                        onChange={handleChange}
                                        className={classes.input}
                                        required
                                    />
                                </Field>

                                <div className={classes.verificationSection}>
                                    <Field
                                        validationState={errors.verificationCode ? 'error' : 'none'}
                                        validationMessage={errors.verificationCode}
                                    >
                                        <Input
                                            name="verificationCode"
                                            placeholder={t('auth.verificationCodePlaceholder', '请输入验证码')}
                                            value={formData.verificationCode}
                                            onChange={handleChange}
                                            className={classes.verificationInput}
                                            required
                                        />
                                    </Field>
                                    <Button
                                        className={classes.verificationButton}
                                        onClick={handleSendCode}
                                        disabled={sendingCode || countdown > 0 || !formData.email}
                                    >
                                        {countdown > 0
                                            ? `${countdown}s`
                                            : sendingCode
                                              ? t('auth.sending', '发送中...')
                                              : codeSent
                                                ? t('auth.resend', '重新发送')
                                                : t('auth.sendCode', '发送验证码')}
                                    </Button>
                                </div>

                                <Field
                                    validationState={errors.password ? 'error' : 'none'}
                                    validationMessage={errors.password}
                                >
                                    <Input
                                        name="password"
                                        type="password"
                                        placeholder={t('auth.passwordPlaceholder', '请输入密码')}
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={classes.input}
                                        required
                                    />
                                </Field>

                                {errors.general && <Text className={classes.error}>{errors.general}</Text>}

                                <DialogActions className={classes.bottomLinks}>
                                    <Button
                                        type="button"
                                        appearance="transparent"
                                        onClick={() => {
                                            if (onSwitchToLogin) {
                                                onSwitchToLogin();
                                            } else {
                                                onClose();
                                            }
                                        }}
                                        disabled={submitting}
                                    >
                                        {t('auth.switchToLogin', '去登录')}
                                    </Button>
                                </DialogActions>

                                <DialogActions className={classes.bottomButtons}>
                                    <Button
                                        type="button"
                                        appearance="secondary"
                                        onClick={onClose}
                                        disabled={submitting}
                                    >
                                        {t('common.cancel', '取消')}
                                    </Button>
                                    <Button type="submit" appearance="primary" disabled={submitting}>
                                        {t('auth.register', '注册')}
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
