import React, { useState } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Button,
    Input,
    makeStyles,
    tokens,
    Spinner,
    Text,
    Field,
} from '@fluentui/react-components';
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

interface ResetPasswordDialogProps {
    open: boolean;
    onClose: () => void;
    onBackToLogin?: () => void;
    email: string;
}

export const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({ open, onClose, onBackToLogin, email }) => {
    const classes = useStyles();
    const { t } = useTranslation();

    const [step, setStep] = useState<'verify' | 'reset'>('verify'); // 两步：验证验证码和重置密码
    const [verificationCode, setVerificationCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const validateVerificationForm = () => {
        const newErrors: Record<string, string> = {};

        if (!verificationCode) {
            newErrors.code = t('auth.codeRequired', '验证码不能为空');
        } else if (verificationCode.length !== 6) {
            newErrors.code = t('auth.invalidCodeLength', '验证码应为6位数字');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateResetForm = () => {
        const newErrors: Record<string, string> = {};

        if (!newPassword) {
            newErrors.newPassword = t('auth.passwordRequired', '新密码不能为空');
        } else if (newPassword.length < 6) {
            newErrors.newPassword = t('auth.passwordTooShort', '密码至少需要6个字符');
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = t('auth.confirmPasswordRequired', '请确认新密码');
        } else if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = t('auth.passwordMismatch', '两次输入的密码不一致');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateVerificationForm()) {
            return;
        }

        setSubmitting(true);
        setErrors({});

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/verify-reset-password-code`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, code: verificationCode }),
                },
            );

            const data = await response.json();

            if (data.success) {
                setStep('reset'); // 跳转到重置密码步骤
            } else {
                setErrors({
                    general: data.error || t('auth.invalidCode', '验证码无效或已过期'),
                });
            }
        } catch (error: any) {
            setErrors({
                general: error.message || t('auth.verificationFailed', '验证失败'),
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateResetForm()) {
            return;
        }

        setSubmitting(true);
        setErrors({});

        try {
            // 确保所有字段都有值
            if (!email || !verificationCode || !newPassword) {
                setErrors({
                    general: t('auth.missingFields', '必要字段缺失，请重试'),
                });
                setSubmitting(false);
                return;
            }

            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/reset-password`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email,
                        code: verificationCode,
                        newPassword,
                    }),
                },
            );

            const data = await response.json();

            if (data.success) {
                alert(t('auth.passwordResetSuccess', '密码重置成功！'));
                if (onBackToLogin) {
                    onBackToLogin();
                } else {
                    onClose();
                }
            } else {
                setErrors({
                    general: data.error || t('auth.resetFailed', '密码重置失败'),
                });
            }
        } catch (error: any) {
            setErrors({
                general: error.message || t('auth.resetFailed', '密码重置失败'),
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
                <DialogTitle>
                    {step === 'verify' ? t('auth.verifyCode', '验证验证码') : t('auth.resetPassword', '重置密码')}
                </DialogTitle>
                <DialogBody>
                    <DialogContent>
                        {submitting ? (
                            <div className={classes.loading}>
                                <Spinner
                                    label={
                                        step === 'verify'
                                            ? t('auth.verifyingCode', '验证中...')
                                            : t('auth.resettingPassword', '重置密码中...')
                                    }
                                />
                            </div>
                        ) : (
                            <>
                                {step === 'verify' ? (
                                    <form onSubmit={handleVerifyCode} className={classes.form}>
                                        <Field label={t('auth.email', '邮箱')} validationState="none">
                                            <Input name="email" value={email} readOnly className={classes.input} />
                                        </Field>

                                        <Field
                                            label={t('auth.verificationCode', '验证码')}
                                            validationState={errors.code ? 'error' : 'none'}
                                            validationMessage={errors.code}
                                        >
                                            <Input
                                                name="verificationCode"
                                                placeholder={t('auth.codePlaceholder', '请输入6位验证码')}
                                                value={verificationCode}
                                                onChange={(e) => {
                                                    setVerificationCode(e.target.value);
                                                    // Clear error when user types
                                                    if (errors.code) {
                                                        setErrors((prev) => {
                                                            const newErrors = { ...prev };
                                                            delete newErrors.code;
                                                            return newErrors;
                                                        });
                                                    }
                                                }}
                                                className={classes.input}
                                                maxLength={6}
                                                required
                                            />
                                        </Field>

                                        {errors.general && <Text className={classes.error}>{errors.general}</Text>}

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
                                                {t('auth.verify', '验证')}
                                            </Button>
                                        </DialogActions>
                                    </form>
                                ) : (
                                    <form onSubmit={handleResetPassword} className={classes.form}>
                                        <Field
                                            label={t('auth.newPassword', '新密码')}
                                            validationState={errors.newPassword ? 'error' : 'none'}
                                            validationMessage={errors.newPassword}
                                        >
                                            <Input
                                                name="newPassword"
                                                type="password"
                                                placeholder={t('auth.newPasswordPlaceholder', '请输入新密码')}
                                                value={newPassword}
                                                onChange={(e) => {
                                                    setNewPassword(e.target.value);
                                                    // Clear error when user types
                                                    if (errors.newPassword) {
                                                        setErrors((prev) => {
                                                            const newErrors = { ...prev };
                                                            delete newErrors.newPassword;
                                                            return newErrors;
                                                        });
                                                    }
                                                }}
                                                className={classes.input}
                                                required
                                            />
                                        </Field>

                                        <Field
                                            label={t('auth.confirmPassword', '确认密码')}
                                            validationState={errors.confirmPassword ? 'error' : 'none'}
                                            validationMessage={errors.confirmPassword}
                                        >
                                            <Input
                                                name="confirmPassword"
                                                type="password"
                                                placeholder={t('auth.confirmPasswordPlaceholder', '请再次输入新密码')}
                                                value={confirmPassword}
                                                onChange={(e) => {
                                                    setConfirmPassword(e.target.value);
                                                    // Clear error when user types
                                                    if (errors.confirmPassword) {
                                                        setErrors((prev) => {
                                                            const newErrors = { ...prev };
                                                            delete newErrors.confirmPassword;
                                                            return newErrors;
                                                        });
                                                    }
                                                }}
                                                className={classes.input}
                                                required
                                            />
                                        </Field>

                                        {errors.general && <Text className={classes.error}>{errors.general}</Text>}

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
                                                {t('auth.resetPassword', '重置密码')}
                                            </Button>
                                        </DialogActions>
                                    </form>
                                )}
                            </>
                        )}
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
