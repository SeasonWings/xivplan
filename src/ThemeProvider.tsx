import { FluentProvider, makeStyles } from '@fluentui/react-components';
import React, { PropsWithChildren, useEffect } from 'react';
import { useLocalStorage, useMedia } from 'react-use';
import { getFluentTheme, usePanelThemeStyle, useSceneThemeStyle } from './theme';
import { DarkModeContext } from './ThemeContext';

export const ThemeProvider: React.FC<PropsWithChildren> = ({ children }) => {
    const prefersDarkMode = useMedia('(prefers-color-scheme: dark)');
    const [darkMode, setDarkMode] = useLocalStorage('darkmode', prefersDarkMode);
    const classes = useStyles();

    // TODO: remove this hack once https://github.com/microsoft/fluentui/issues/31211 is implemented.
    useEffect(() => {
        document.documentElement.className = darkMode ? classes.dark : classes.light;
    }, [classes, darkMode]);

    return (
        <DarkModeContext value={[!!darkMode, setDarkMode]}>
            <ThemeProviderInner darkMode={darkMode}>{children}</ThemeProviderInner>
        </DarkModeContext>
    );
};

interface ThemeProviderInnerProps extends PropsWithChildren {
    darkMode?: boolean;
}

const ThemeProviderInner: React.FC<ThemeProviderInnerProps> = ({ darkMode, children }) => {
    const sceneStyles = useSceneThemeStyle();
    const panelStyles = usePanelThemeStyle();
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

    return (
        <FluentProvider theme={getFluentTheme(darkMode)} style={{ ...sceneStyles, ...panelStyles, ...glassVars }}>
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
