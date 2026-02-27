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
    bottomLinks: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    bottomButtons: {
        display: 'flex',
        justifyContent: 'center',
        gap: tokens.spacingHorizontalM,
    },
    link_register: {
        minWidth: 'auto',
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    },
    link_forget: {
        minWidth: 'auto',
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    },
});

interface LoginDialogProps {
    open: boolean;
    onClose: () => void;
    onSwitchToRegister?: () => void;
    onShowForgetPassword?: () => void;
}

export const LoginDialog: React.FC<LoginDialogProps> = ({
    open,
    onClose,
    onSwitchToRegister,
    onShowForgetPassword,
}) => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { login } = useAuth();

    const [formData, setFormData] = useState({
        identifier: '', // 可以是用户名或邮箱
        password: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

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

        if (!formData.identifier) {
            newErrors.identifier = t('auth.identifierRequired', '用户名或邮箱不能为空');
        }

        if (!formData.password) {
            newErrors.password = t('auth.passwordRequired', '密码不能为空');
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
            await login(formData.identifier, formData.password);
            // 重置表单状态后再关闭
            setTimeout(() => {
                setFormData({
                    identifier: '',
                    password: '',
                });
                setErrors({});
                onClose();
            }, 0);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t('auth.loginFailed', '登录失败');
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
            // 使用 setTimeout 避免在 effect 中同步调用 setState 导致的警告
            const timer = setTimeout(() => {
                setErrors({});
                setSubmitting(false);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(e, data) => !data.open && onClose()}>
            <DialogSurface className={classes.surface}>
                <DialogTitle>{t('auth.login', '登录')}</DialogTitle>
                <DialogBody>
                    <DialogContent>
                        {submitting ? (
                            <div className={classes.loading}>
                                <Spinner label={t('auth.loggingIn', '登录中...')} />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className={classes.form}>
                                <Field
                                    validationState={errors.identifier ? 'error' : 'none'}
                                    validationMessage={errors.identifier}
                                >
                                    <Input
                                        name="identifier"
                                        placeholder={t('auth.identifierPlaceholder', '请输入用户名或邮箱')}
                                        value={formData.identifier}
                                        onChange={handleChange}
                                        className={classes.input}
                                        required
                                    />
                                </Field>

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
                                    <div className={classes.bottomButtons}>
                                        <Button
                                            className={classes.link_register}
                                            type="button"
                                            appearance="transparent"
                                            onClick={() => {
                                                if (onSwitchToRegister) {
                                                    onSwitchToRegister();
                                                } else {
                                                    onClose();
                                                }
                                            }}
                                            disabled={submitting}
                                        >
                                            {t('auth.switchToRegister', '去注册')}
                                        </Button>
                                        <Button
                                            className={classes.link_forget}
                                            type="button"
                                            appearance="transparent"
                                            onClick={() => {
                                                if (onShowForgetPassword) {
                                                    onShowForgetPassword();
                                                }
                                            }}
                                            disabled={submitting}
                                        >
                                            {t('auth.forgetPassword', '忘记密码')}
                                        </Button>
                                    </div>
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
                                        {t('auth.login', '登录')}
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
