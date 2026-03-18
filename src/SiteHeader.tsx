import {
    Avatar,
    Button,
    Link,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Text,
    Tooltip,
    makeStyles,
    mergeClasses,
    tokens,
} from '@fluentui/react-components';
import { LocalLanguageFilled, WeatherMoonFilled, WeatherSunnyFilled } from '@fluentui/react-icons';
import React, { HTMLAttributes, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { OutPortal } from 'react-reverse-portal';
import { AboutDialog } from './AboutDialog';
import { AnnouncementDialog } from './AnnouncementDialog';
import { useAuth } from './auth/AuthContext';
import { ForgetPasswordDialog } from './auth/ForgetPasswordDialog';
import { LoginDialog } from './auth/LoginDialog';
import { RegisterDialog } from './auth/RegisterDialog';
import { ResetPasswordDialog } from './auth/ResetPasswordDialog';
import { UserProfileDialog } from './auth/UserProfileDialog';
import { ExternalLink } from './ExternalLink';
import { FeedbackDialog } from './feedback/FeedbackDialog';
import { glassToolbar } from './glassStyles';
import { HelpContext } from './HelpContext';
import { PANEL_WIDTH } from './panel/PanelStyles';
import { FileSource, useScene } from './SceneProvider';
import { DarkModeContext, ThemePalette, ThemePaletteContext } from './ThemeContext';
import { ToolbarContext } from './ToolbarContext';
import { TutorialDialog } from './tutorial/TutorialDialog';
import { useIsDirty } from './useIsDirty';
import { removeFileExtension } from './util';

import { useNavigate } from 'react-router-dom';

const GAP = tokens.spacingHorizontalL;
const HEADER_HEIGHT = '48px';

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexFlow: 'row',
        alignItems: 'center',
        columnGap: GAP,
        minHeight: HEADER_HEIGHT,
        paddingInlineEnd: tokens.spacingHorizontalS,
        ...glassToolbar,
    },
    title: {
        display: 'flex',
        alignItems: 'baseline',
        boxSizing: 'border-box',
        paddingLeft: tokens.spacingHorizontalM,
        gap: GAP,
        width: `calc(${PANEL_WIDTH}px - ${GAP})`,
        textDecoration: 'none',
    },
    source: {
        display: 'inline-flex',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
    },
    filename: {
        color: tokens.colorNeutralForeground3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    dirty: {
        paddingInlineStart: tokens.spacingHorizontalXS,
    },
    commandBar: {
        flexGrow: 1,
    },
    link: {
        color: tokens.colorNeutralForeground2,
    },
    toggleLabel: {
        color: tokens.colorNeutralForeground2,
        fontWeight: 500,
    },
    iconButton: {
        minWidth: '40px',
        width: '40px',
    },
    buttonGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    activeLanguageItem: {
        color: tokens.colorBrandForeground1,
        fontWeight: 600,
    },
});

export const SiteHeader: React.FC<HTMLAttributes<HTMLElement>> = ({ className, ...props }) => {
    const classes = useStyles();
    const { source } = useScene();
    const toolbarNode = useContext(ToolbarContext);
    const [, setHelpOpen] = useContext(HelpContext);
    const [tutorialOpen, setTutorialOpen] = React.useState(false);
    const [darkMode, setDarkMode] = useContext(DarkModeContext);
    const { t, i18n } = useTranslation();
    const { state: authState, logout } = useAuth();
    const navigate = useNavigate();
    const [paletteValue, setPalette] = useContext(ThemePaletteContext);
    const paletteItems = [
        {
            value: 'default' as ThemePalette,
            gradient: 'linear-gradient(135deg, #55b0ffff, #b7deffff, #ffffffff)',
        },
        {
            value: 'candyMint' as ThemePalette,
            gradient: 'linear-gradient(135deg, #ffe0ef, #ff9ac6, #6fd8c9)',
        },
        {
            value: 'candyGrape' as ThemePalette,
            gradient: 'linear-gradient(135deg, #f2dcff, #c79aff, #ffb8de)',
        },
        {
            value: 'candyPeach' as ThemePalette,
            gradient: 'linear-gradient(135deg, #ffe4d6, #ffa98c, #6fc3ff)',
        },
        {
            value: 'candySky' as ThemePalette,
            gradient: 'linear-gradient(135deg, #d6fff3, #2bd4a6, #ff7ab6)',
        },
    ];
    const activeGradient =
        paletteItems.find((x) => x.value === paletteValue)?.gradient ??
        'linear-gradient(135deg, #40352c, #6f5a48, #292929)';

    // 认证对话框状态
    const [showLoginDialog, setShowLoginDialog] = React.useState(false);
    const [showRegisterDialog, setShowRegisterDialog] = React.useState(false);
    const [showProfileDialog, setShowProfileDialog] = React.useState(false);
    const [showForgetPasswordDialog, setShowForgetPasswordDialog] = React.useState(false);
    const [showResetPasswordDialog, setShowResetPasswordDialog] = React.useState(false);
    const [forgetPasswordEmail, setForgetPasswordEmail] = React.useState('');
    const [showFeedbackDialog, setShowFeedbackDialog] = React.useState(false);

    const handleLogout = async () => {
        await logout();
    };

    const toggleThemeWithTransition = (
        e: React.MouseEvent | React.KeyboardEvent,
        callback: () => void,
        isShrinking = false,
    ) => {
        const x = 'clientX' in e ? e.clientX : window.innerWidth / 2;
        const y = 'clientY' in e ? e.clientY : window.innerHeight / 2;

        const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

        if (!document.startViewTransition) {
            callback();
            return;
        }

        if (isShrinking) {
            document.documentElement.classList.add('theme-transition-shrinking');
        }

        const transition = document.startViewTransition(callback);

        transition.finished.finally(() => {
            document.documentElement.classList.remove('theme-transition-shrinking');
        });

        transition.ready.then(() => {
            const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

            document.documentElement.animate(
                {
                    clipPath: isShrinking ? [...clipPath].reverse() : clipPath,
                },
                {
                    duration: 400,
                    easing: 'ease-in-out',
                    fill: 'both',
                    pseudoElement: isShrinking ? '::view-transition-old(root)' : '::view-transition-new(root)',
                },
            );
        });
    };

    const titleSize = source ? 400 : 500;

    return (
        <header className={mergeClasses(classes.root, className)} {...props}>
            <div className={classes.title}>
                <Text size={titleSize} weight="semibold">
                    {import.meta.env.VITE_APP_TITLE || 'XIVPlan'}
                </Text>
                {source && <SourceIndicator source={source} />}
            </div>
            <div className={classes.commandBar}>
                <OutPortal node={toolbarNode} />
            </div>

            <Link onClick={() => setHelpOpen(true)} className={classes.link}>
                {t('header.help')}
            </Link>
            <Link onClick={() => setTutorialOpen(true)} className={classes.link}>
                {t('tutorial.title', '使用教程')}
            </Link>
            <Link onClick={() => setShowFeedbackDialog(true)} className={classes.link}>
                {t('header.feedback', '意见反馈')}
            </Link>
            <AnnouncementDialog className={classes.link} />
            <AboutDialog className={classes.link} />
            <ExternalLink className={classes.link} href="https://github.com/SeasonWings/xivplan" noIcon>
                {t('header.github')}
            </ExternalLink>
            <div className={classes.buttonGroup}>
                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        <Button
                            appearance="subtle"
                            className={classes.iconButton}
                            icon={
                                <span
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '999px',
                                        backgroundImage: activeGradient,
                                        border: `1px solid ${tokens.colorNeutralStroke2}`,
                                        display: 'inline-block',
                                    }}
                                />
                            }
                        />
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList>
                            {paletteItems.map((item) => (
                                <MenuItem
                                    key={item.value}
                                    onClick={(e) => toggleThemeWithTransition(e, () => setPalette(item.value))}
                                    aria-label={item.value}
                                >
                                    <div
                                        style={{
                                            width: '72px',
                                            height: '20px',
                                            borderRadius: '999px',
                                            backgroundImage: item.gradient,
                                            border:
                                                paletteValue === item.value
                                                    ? `2px solid ${tokens.colorBrandStroke1}`
                                                    : `1px solid ${tokens.colorNeutralStroke2}`,
                                        }}
                                    />
                                </MenuItem>
                            ))}
                        </MenuList>
                    </MenuPopover>
                </Menu>
                <Menu>
                    <MenuTrigger disableButtonEnhancement>
                        <Button appearance="subtle" className={classes.iconButton} icon={<LocalLanguageFilled />} />
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList>
                            <MenuItem
                                onClick={() => i18n.changeLanguage('zh')}
                                className={i18n.language === 'zh' ? classes.activeLanguageItem : undefined}
                            >
                                {t('header.language_zh')}
                            </MenuItem>
                            <MenuItem
                                onClick={() => i18n.changeLanguage('en')}
                                className={i18n.language === 'en' ? classes.activeLanguageItem : undefined}
                            >
                                {t('header.language_en')}
                            </MenuItem>
                        </MenuList>
                    </MenuPopover>
                </Menu>
                <Button
                    appearance="subtle"
                    className={classes.iconButton}
                    icon={darkMode ? <WeatherSunnyFilled /> : <WeatherMoonFilled />}
                    onClick={(e) => toggleThemeWithTransition(e, () => setDarkMode(!darkMode), darkMode)}
                />
                {/* 用户菜单 - 放在暗黑模式切换按钮右侧 */}
                <Menu positioning="below-end">
                    <MenuTrigger disableButtonEnhancement>
                        <Button
                            appearance="subtle"
                            icon={
                                authState.isAuthenticated ? (
                                    <Avatar
                                        image={{ src: authState.user?.avatar || undefined }}
                                        initials={authState.user?.username?.charAt(0).toUpperCase() || '?'}
                                        name={authState.user?.username || 'Guest'}
                                    />
                                ) : undefined
                            }
                        >
                            {!authState.isAuthenticated && t('toolbar.signIn', '登录')}
                        </Button>
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList>
                            {!authState.isAuthenticated ? (
                                <>
                                    <MenuItem
                                        onClick={() => {
                                            setShowLoginDialog(true);
                                        }}
                                    >
                                        {t('toolbar.signIn', '登录')}
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => {
                                            setShowRegisterDialog(true);
                                        }}
                                    >
                                        {t('toolbar.signUp', '注册')}
                                    </MenuItem>
                                </>
                            ) : (
                                <>
                                    {authState.user?.role === 'admin' && (
                                        <MenuItem onClick={() => navigate('/admin')}>
                                            {t('toolbar.admin', '后台管理')}
                                        </MenuItem>
                                    )}
                                    <MenuItem onClick={() => setShowProfileDialog(true)}>
                                        {t('toolbar.profile', '个人资料')}
                                    </MenuItem>
                                    <MenuItem onClick={handleLogout}>{t('toolbar.signOut', '退出登录')}</MenuItem>
                                </>
                            )}
                        </MenuList>
                    </MenuPopover>
                </Menu>
            </div>

            <TutorialDialog open={tutorialOpen} onOpenChange={(_, data) => setTutorialOpen(data.open)} />

            {/* 认证对话框 */}
            <LoginDialog
                open={showLoginDialog}
                onClose={() => setShowLoginDialog(false)}
                onSwitchToRegister={() => {
                    setShowLoginDialog(false);
                    setShowRegisterDialog(true);
                }}
                onShowForgetPassword={() => {
                    setShowLoginDialog(false);
                    setShowForgetPasswordDialog(true);
                }}
            />
            <RegisterDialog
                open={showRegisterDialog}
                onClose={() => setShowRegisterDialog(false)}
                onSwitchToLogin={() => {
                    setShowRegisterDialog(false);
                    setShowLoginDialog(true);
                }}
            />
            <UserProfileDialog open={showProfileDialog} onClose={() => setShowProfileDialog(false)} />

            {/* 忘记密码对话框 */}
            <ForgetPasswordDialog
                open={showForgetPasswordDialog}
                onClose={() => {
                    setShowForgetPasswordDialog(false);
                    setForgetPasswordEmail('');
                }}
                onBackToLogin={() => {
                    setShowForgetPasswordDialog(false);
                    setShowLoginDialog(true);
                    setForgetPasswordEmail('');
                }}
                onSubmitSuccess={(email) => {
                    setForgetPasswordEmail(email);
                    setShowForgetPasswordDialog(false);
                    setShowResetPasswordDialog(true);
                }}
            />

            {/* 重置密码对话框 */}
            <ResetPasswordDialog
                open={showResetPasswordDialog}
                onClose={() => {
                    setShowResetPasswordDialog(false);
                    setForgetPasswordEmail('');
                }}
                onBackToLogin={() => {
                    setShowResetPasswordDialog(false);
                    setShowLoginDialog(true);
                    setForgetPasswordEmail('');
                }}
                email={forgetPasswordEmail}
            />

            {/* 反馈对话框 */}
            <FeedbackDialog open={showFeedbackDialog} onClose={() => setShowFeedbackDialog(false)} />
        </header>
    );
};

interface SourceIndicatorProps {
    source: FileSource;
}

const SourceIndicator: React.FC<SourceIndicatorProps> = ({ source }) => {
    const classes = useStyles();
    const isDirty = useIsDirty();
    const { t } = useTranslation();
    const tooltip = isDirty ? t('header.unsavedChangesTooltip', { name: source.name }) : source.name;

    return (
        <Tooltip content={tooltip} relationship="description">
            <span className={classes.source}>
                <Text className={classes.filename}>{removeFileExtension(source.name)}</Text>
                {isDirty && <Text className={classes.dirty}>●</Text>}
            </span>
        </Tooltip>
    );
};
