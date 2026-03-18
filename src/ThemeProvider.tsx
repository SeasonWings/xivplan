import { FluentProvider, makeStyles } from '@fluentui/react-components';
import React, { PropsWithChildren, useContext, useEffect } from 'react';
import { useLocalStorage, useMedia } from 'react-use';
import { getFluentTheme, usePanelThemeStyle, useSceneThemeStyle } from './theme';
import { DarkModeContext, ThemePalette, ThemePaletteContext } from './ThemeContext';

export const ThemeProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const prefersDarkMode = useMedia('(prefers-color-scheme: dark)');
    const [darkMode, setDarkMode] = useLocalStorage('darkmode', prefersDarkMode);
    const classes = useStyles();
    const [palette, setPalette] = useLocalStorage<ThemePalette>('themePalette', 'default');

    // TODO: remove this hack once https://github.com/microsoft/fluentui/issues/31211 is implemented.
    useEffect(() => {
        const darkClasses = classes.dark.split(' ').filter(Boolean);
        const lightClasses = classes.light.split(' ').filter(Boolean);
        if (darkMode) {
            document.documentElement.classList.add(...darkClasses);
            document.documentElement.classList.remove(...lightClasses);
        } else {
            document.documentElement.classList.add(...lightClasses);
            document.documentElement.classList.remove(...darkClasses);
        }
    }, [classes, darkMode]);

    return (
        <DarkModeContext value={[!!darkMode, setDarkMode]}>
            <ThemePaletteContext value={[palette ?? 'default', setPalette]}>
                <ThemeProviderInner darkMode={darkMode}>{children}</ThemeProviderInner>
            </ThemePaletteContext>
        </DarkModeContext>
    );
};

interface ThemeProviderInnerProps extends PropsWithChildren {
    darkMode?: boolean;
}

const ThemeProviderInner: React.FC<ThemeProviderInnerProps> = ({ darkMode, children }) => {
    const sceneStyles = useSceneThemeStyle();
    const panelStyles = usePanelThemeStyle();
    const [palette] = useContext(ThemePaletteContext);
    const glassVars: React.CSSProperties = darkMode
        ? {
              '--glass-bg-rgb': '18 24 32',
              '--glass-alpha': '0.22',
              '--glass-blur': '12px',
              '--glass-radius': '12px',
              '--glass-border': 'rgba(255,255,255,0.2)',
              '--glass-shadow': '0 8px 16px rgba(0,0,0,0.35)',
              '--dialog-glass-rgb': '16 28 40',
              '--dialog-glass-alpha': '0.8',
              '--dialog-border-dark': 'rgba(0,0,0,0.7)',
          }
        : {
              '--glass-bg-rgb': '255 255 255',
              '--glass-alpha': '0.18',
              '--glass-blur': '10px',
              '--glass-radius': '12px',
              '--glass-border': 'rgba(255,255,255,0.2)',
              '--glass-shadow': '0 8px 16px rgba(0,0,0,0.12)',
              '--dialog-glass-rgb': '164 190 210',
              '--dialog-glass-alpha': '0.94',
              '--dialog-border-dark': 'rgba(0,0,0,0.5)',
          };
    const candyGlassVars: React.CSSProperties =
        palette === 'candyMint'
            ? {
                  '--glass-bg-rgb': darkMode ? '40 26 33' : '255 240 247',
                  '--dialog-glass-rgb': darkMode ? '44 28 36' : '255 232 244',
              }
            : palette === 'candyGrape'
              ? {
                    '--glass-bg-rgb': darkMode ? '34 26 46' : '248 240 255',
                    '--dialog-glass-rgb': darkMode ? '38 30 52' : '242 232 255',
                }
              : palette === 'candyPeach'
                ? {
                      '--glass-bg-rgb': darkMode ? '44 28 24' : '255 244 239',
                      '--dialog-glass-rgb': darkMode ? '48 30 26' : '255 236 228',
                  }
                : palette === 'candySky'
                  ? {
                        '--glass-bg-rgb': darkMode ? '18 32 28' : '232 255 247',
                        '--dialog-glass-rgb': darkMode ? '20 34 30' : '216 255 242',
                    }
                  : {};
    const candyGradient: React.CSSProperties =
        palette === 'candyMint'
            ? { '--app-gradient-from': '#fff0f7', '--app-gradient-to': '#e8fff7' }
            : palette === 'candyGrape'
              ? { '--app-gradient-from': '#f8f0ff', '--app-gradient-to': '#f0f8ff' }
              : palette === 'candyPeach'
                ? { '--app-gradient-from': '#fff4ef', '--app-gradient-to': '#fff9f0' }
                : palette === 'candySky'
                  ? { '--app-gradient-from': '#e8fff7', '--app-gradient-to': '#f6fffd' }
                  : {};

    return (
        <FluentProvider
            theme={getFluentTheme(darkMode, palette)}
            style={{ ...sceneStyles, ...panelStyles, ...glassVars, ...candyGlassVars, ...candyGradient }}
        >
            {children}
        </FluentProvider>
    );
};

const useStyles = makeStyles({
    dark: {
        colorScheme: 'dark',
        '--app-gradient-from': '#0b1622',
        '--app-gradient-to': '#1a2b3b',
        '--app-glass-tint': '#1b2f44',
    },
    light: {
        colorScheme: 'light',
        '--app-gradient-from': '#bfd5e6',
        '--app-gradient-to': '#ffffff',
        '--app-glass-tint': '#bfd5e6',
    },
});
