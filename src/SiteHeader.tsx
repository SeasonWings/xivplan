import {
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
import React, { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { OutPortal } from 'react-reverse-portal';
import { AboutDialog } from './AboutDialog';
import { AnnouncementDialog } from './AnnouncementDialog';
import { ExternalLink } from './ExternalLink';
import { HelpContext } from './HelpContext';
import { PANEL_WIDTH } from './panel/PanelStyles';
import { FileSource, useScene } from './SceneProvider';
import { DarkModeContext } from './ThemeContext';
import { ToolbarContext } from './ToolbarContext';
import { useIsDirty } from './useIsDirty';
import { removeFileExtension } from './util';
import { TutorialDialog } from './tutorial/TutorialDialog';

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
        overflow: 'hidden',
    },
    title: {
        display: 'flex',
        alignItems: 'baseline',
        boxSizing: 'border-box',
        paddingLeft: tokens.spacingHorizontalM,
        gap: GAP,
        width: `calc(${PANEL_WIDTH}px - ${GAP})`,
        textDecoration: 'none',
        flexShrink: 0,
    },
    titlePWA: {
        display: 'flex',
        alignItems: 'baseline',
        boxSizing: 'border-box',
        paddingLeft: tokens.spacingHorizontalM,
        gap: GAP,
        textDecoration: 'none',
        flexShrink: 0,
        maxWidth: '200px', // 在PWA模式下限制标题宽度
        minWidth: '100px', // 确保最小宽度
        overflow: 'hidden',
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
        minWidth: 0,
        overflow: 'hidden',
    },
    link: {
        color: tokens.colorNeutralForeground2,
        flexShrink: 0,
    },
    toggleLabel: {
        color: tokens.colorNeutralForeground2,
        fontWeight: 500,
    },
    iconButton: {
        minWidth: '40px',
        width: '40px',
        flexShrink: 0,
    },
    buttonGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        flexShrink: 0,
    },
    activeLanguageItem: {
        color: tokens.colorBrandForeground1,
        fontWeight: 600,
    },
    hideOnSmall: {
        '@media (max-width: 760px)': {
            display: 'none',
        },
    },
});

interface SiteHeaderProps extends HTMLAttributes<HTMLElement> {
    isPWA?: boolean;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({ className, isPWA = false, ...props }) => {
    const classes = useStyles();
    const { source } = useScene();
    const toolbarNode = React.useContext(ToolbarContext);
    const [, setHelpOpen] = React.useContext(HelpContext);
    const [tutorialOpen, setTutorialOpen] = React.useState(false);
    const [darkMode, setDarkMode] = React.useContext(DarkModeContext);
    const { t, i18n } = useTranslation();

    const titleSize = source ? 400 : 500;

    return (
        <header className={mergeClasses(classes.root, className)} {...props}>
            <div className={isPWA ? classes.titlePWA : classes.title}>
                <Text size={titleSize} weight="semibold">
                    XIVPlan
                </Text>
                {source && <SourceIndicator source={source} />}
            </div>
            <div className={classes.commandBar}>
                <OutPortal node={toolbarNode} />
            </div>

            <Link onClick={() => setHelpOpen(true)} className={mergeClasses(classes.link, classes.hideOnSmall)}>
                {t('header.help')}
            </Link>
            <Link onClick={() => setTutorialOpen(true)} className={mergeClasses(classes.link, classes.hideOnSmall)}>
                {t('tutorial.title', '使用教程')}
            </Link>
            <AnnouncementDialog className={mergeClasses(classes.link, classes.hideOnSmall)} />
            <AboutDialog className={mergeClasses(classes.link, classes.hideOnSmall)} />
            <ExternalLink
                className={mergeClasses(classes.link, classes.hideOnSmall)}
                href="https://github.com/SeasonWings/xivplan"
                noIcon
            >
                {t('header.github')}
            </ExternalLink>
            <div className={classes.buttonGroup}>
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
                    onClick={() => setDarkMode(!darkMode)}
                />
            </div>

            <TutorialDialog open={tutorialOpen} onOpenChange={(_, data) => setTutorialOpen(data.open)} />
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
