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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    success: {
        color: tokens.colorPaletteGreenForeground1,
        marginTop: tokens.spacingVerticalXS,
    },
    bottomLinks: {
        display: 'flex',
        justifyContent: 'space-between',
    },
});

interface ForgetPasswordDialogProps {
    open: boolean;
    onClose: () => void;
    onBackToLogin?: () => void;
    onSubmitSuccess?: (email: string) => void;
}

export const ForgetPasswordDialog: React.FC<ForgetPasswordDialogProps> = ({
    open,
    onClose,
    onBackToLogin,
    onSubmitSuccess,
}) => {
    const classes = useStyles();
    const { t } = useTranslation();

    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [successMessage, setSuccessMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!email) {
            newErrors.email = t('auth.emailRequired', '邮箱不能为空');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = t('auth.invalidEmailFormat', '邮箱格式不正确');
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
        setErrors({});
        setSuccessMessage('');

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/request-reset-password-code`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email }),
                },
            );

            const data = await response.json();

            if (data.success) {
                // 通知父组件提交成功，由父组件决定下一步操作
                if (onSubmitSuccess) {
                    onSubmitSuccess(email);
                } else {
                    setSuccessMessage(t('auth.resetPasswordCodeSent', '重置密码验证码已发送至您的邮箱，请查收。'));
                    setEmail('');
                }
            } else {
                setErrors({
                    general: data.error || t('auth.failedToSendCode', '发送验证码失败'),
                });
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t('auth.failedToSendCode', '发送验证码失败');
            setErrors({
                general: errorMessage,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackToLogin = () => {
        if (onBackToLogin) {
            onBackToLogin();
        } else {
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(e, data) => !data.open && onClose()}>
            <DialogSurface className={classes.surface}>
                <DialogTitle>{t('auth.forgetPassword', '忘记密码')}</DialogTitle>
                <DialogBody>
                    <DialogContent>
                        {submitting ? (
                            <div className={classes.loading}>
                                <Spinner label={t('auth.sendingCode', '发送验证码中...')} />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className={classes.form}>
                                <Field
                                    label={t('auth.email', '邮箱')}
                                    validationState={errors.email ? 'error' : 'none'}
                                    validationMessage={errors.email}
                                >
                                    <Input
                                        name="email"
                                        placeholder={t('auth.emailPlaceholder', '请输入邮箱地址')}
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            // Clear error when user types
                                            if (errors.email) {
                                                setErrors((prev) => {
                                                    const newErrors = { ...prev };
                                                    delete newErrors.email;
                                                    return newErrors;
                                                });
                                            }
                                        }}
                                        className={classes.input}
                                        required
                                    />
                                </Field>

                                {errors.general && <Text className={classes.error}>{errors.general}</Text>}

                                {successMessage && <Text className={classes.success}>{successMessage}</Text>}

                                <DialogActions className={classes.bottomLinks}>
                                    <Button
                                        type="button"
                                        appearance="transparent"
                                        onClick={handleBackToLogin}
                                        disabled={submitting}
                                    >
                                        {t('auth.backToLogin', '返回登录')}
                                    </Button>
                                    <Button type="submit" appearance="primary" disabled={submitting}>
                                        {t('auth.sendCode', '发送验证码')}
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
