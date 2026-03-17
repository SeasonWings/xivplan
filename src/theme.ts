import { ColorSwatchProps, Theme, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { ShapeConfig } from 'konva/lib/Shape';
import { CSSProperties, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { DarkModeContext, ThemePalette, ThemePaletteContext } from './ThemeContext';
import { cssPropertiesToStyleString, themeToCssProperties, themeToCssVars, themeToTokensObject } from './themeUtil';

export const MIN_STAGE_WIDTH = '400px';

/**
 * Radius of a dot to display when editing an object that is centered on a point.
 */
export const CENTER_DOT_RADIUS = 3;

export const COLOR_RED = '#ff0000';
export const COLOR_ORANGE = '#fc972b';
export const COLOR_YELLOW = '#ffc800';
export const COLOR_GREEN = '#00e622';
export const COLOR_CYAN = '#00d5e8';
export const COLOR_BLUE = '#0066ff';
export const COLOR_VIOLET = '#8b57fa'; // violet
export const COLOR_PINK = '#f269ff'; // pink
export const COLOR_FUSCHIA = '#bf00ff'; // fuschia
export const COLOR_BLUE_WHITE = '#bae3ff'; // blue-white
export const COLOR_DARK_PURPLE = '#20052e'; // dark purple
export const COLOR_WHITE = '#ffffff'; // white
export const COLOR_BLACK = '#000000'; // black

export const COLOR_MARKER_RED = '#f13b66';
export const COLOR_MARKER_YELLOW = '#e1dc5d';
export const COLOR_MARKER_BLUE = '#65b3ea';
export const COLOR_MARKER_PURPLE = '#e291e6';
export const DEFAULT_MARKER_OPACITY = 100;

export const DEFAULT_PARTY_OPACITY = 100;

export const DEFAULT_IMAGE_OPACITY = 100;

export const DEFAULT_AOE_COLOR = COLOR_ORANGE;
export const DEFAULT_AOE_OPACITY = 35;

export const DEFAULT_ENEMY_COLOR = COLOR_RED;
export const DEFAULT_ENEMY_OPACITY = 65;

export const HIGHLIGHT_COLOR = '#ffffff';
export const SPOTLIGHT_COLOR = '#ffc800';
export const HIGHLIGHT_WIDTH = 1.5;

export const SELECTED_PROPS: ShapeConfig = {
    fillEnabled: false,
    listening: false,
    stroke: HIGHLIGHT_COLOR,
    strokeWidth: HIGHLIGHT_WIDTH,
    shadowColor: '#0066ff',
    shadowBlur: 4,
    opacity: 0.75,
};

export const SPOTLIGHT_PROPS: ShapeConfig = {
    fillEnabled: false,
    listening: false,
    stroke: SPOTLIGHT_COLOR,
    strokeWidth: HIGHLIGHT_WIDTH,
    shadowColor: '#ffff00',
    shadowBlur: 4,
    opacity: 0.75,
};

export interface SceneTheme {
    colorBackground: string;
    colorArena: string;
    colorArenaLight: string;
    colorArenaDark: string;
    colorGrid: string;
    colorBorder: string;
    colorBorderTickMajor: string;
    colorBorderTickMinor: string;
    colorEnemyText: string;
}

const defaultSceneTheme: SceneTheme = {
    colorBackground: '#292929',
    colorArena: '#40352c', // var(--xiv-colorArena, #40352c)
    colorArenaLight: '#4c4034', // var(--xiv-colorArenaLight, #4c4034)
    colorArenaDark: '#352b21', // var(--xiv-colorArenaDark, #352b21)
    colorGrid: '#6f5a48', // var(--xiv-colorGrid, #6f5a48)
    colorBorder: '#6f5a48', // var(--xiv-colorBorder, #6f5a48)
    colorBorderTickMajor: 'rgb(186 227 255)',
    colorBorderTickMinor: 'rgb(186 227 255 / 67%)',
    colorEnemyText: '#ffffff',
};

function getCandySceneTheme(palette: ThemePalette): SceneTheme {
    switch (palette) {
        case 'candyMint':
            return {
                colorBackground: '#fff6fb',
                colorArena: '#ffe0ef',
                colorArenaLight: '#ffd4e9',
                colorArenaDark: '#ffc6e2',
                colorGrid: '#ff9ac6',
                colorBorder: '#ff9ac6',
                colorBorderTickMajor: '#6fd8c9',
                colorBorderTickMinor: 'rgba(111,216,201,0.67)',
                colorEnemyText: '#3a3a3a',
            };
        case 'candyGrape':
            return {
                colorBackground: '#fbf3ff',
                colorArena: '#f2dcff',
                colorArenaLight: '#ead0ff',
                colorArenaDark: '#e2c3ff',
                colorGrid: '#c79aff',
                colorBorder: '#c79aff',
                colorBorderTickMajor: '#ffb8de',
                colorBorderTickMinor: 'rgba(255,184,222,0.67)',
                colorEnemyText: '#3a3a3a',
            };
        case 'candyPeach':
            return {
                colorBackground: '#fff8f2',
                colorArena: '#ffe4d6',
                colorArenaLight: '#ffd9c6',
                colorArenaDark: '#ffccb5',
                colorGrid: '#ffa98c',
                colorBorder: '#ffa98c',
                colorBorderTickMajor: '#6fc3ff',
                colorBorderTickMinor: 'rgba(111,195,255,0.67)',
                colorEnemyText: '#3a3a3a',
            };
        case 'candySky':
            return {
                colorBackground: '#f2fffb',
                colorArena: '#d6fff3',
                colorArenaLight: '#c6ffee',
                colorArenaDark: '#b5ffe8',
                colorGrid: '#2bd4a6',
                colorBorder: '#2bd4a6',
                colorBorderTickMajor: '#ff7ab6',
                colorBorderTickMinor: 'rgba(255,122,182,0.67)',
                colorEnemyText: '#1f2a2a',
            };
        case 'default':
        default:
            return defaultSceneTheme;
    }
}

export const sceneVars = themeToCssVars(defaultSceneTheme);
export const sceneTokens = themeToTokensObject(defaultSceneTheme);

export function useSceneTheme(): SceneTheme {
    const [palette] = useContext(ThemePaletteContext);
    return getCandySceneTheme(palette);
}

/**
 * Gets the CSS variable definitions for the scene theme
 */
export function useSceneThemeStyle(): CSSProperties {
    const theme = useSceneTheme();
    return themeToCssProperties(theme);
}

/**
 * Gets the CSS variable definitions for the scene theme as a string that can be inserted in an HTML stylesheet.
 */
export function useSceneThemeHtmlStyle(selector = ':root'): string {
    const styles = useSceneThemeStyle();
    return cssPropertiesToStyleString(selector, styles);
}

export function getArenaShapeConfig(theme: SceneTheme): ShapeConfig {
    return {
        fill: theme.colorArena,
        stroke: theme.colorBorder,
        strokeWidth: 1,
    };
}

export function getGridShapeConfig(theme: SceneTheme): ShapeConfig {
    return {
        stroke: theme.colorGrid,
        strokeWidth: 1,
    };
}

export function getEnemyTextConfig(theme: SceneTheme): ShapeConfig {
    return {
        fill: theme.colorEnemyText,
        stroke: theme.colorArena,
    };
}

export interface PanelTheme {
    colorZoneOrange: string;
    colorZoneBlue: string;
    colorZoneEye: string;
    colorMagnetPlus: string;
    colorMagnetPlusSymbol: string;
    colorMagnetMinus: string;
    colorMagnetMinusSymbol: string;
}

const darkPanelTheme: PanelTheme = {
    colorZoneOrange: '#ffa700',
    colorZoneBlue: '#0058ff',
    colorZoneEye: '#ff1200',
    colorMagnetPlus: '#c68200',
    colorMagnetPlusSymbol: '#000000',
    colorMagnetMinus: '#0057f8',
    colorMagnetMinusSymbol: '#ffffff',
};

const lightPanelTheme: PanelTheme = {
    colorZoneOrange: '#f07900',
    colorZoneBlue: '#0046ff',
    colorZoneEye: '#ff0000',
    colorMagnetPlus: '#c06100',
    colorMagnetPlusSymbol: '#ffffff',
    colorMagnetMinus: '#0047ff',
    colorMagnetMinusSymbol: '#ffffff',
};

export const panelVars = themeToCssVars(darkPanelTheme);
export const panelTokens = themeToTokensObject(darkPanelTheme);

export function usePanelTheme() {
    const darkMode = useContext(DarkModeContext);

    return darkMode ? darkPanelTheme : lightPanelTheme;
}

/**
 * Gets the CSS variable definitions for the panel theme
 */
export function usePanelThemeStyle(): CSSProperties {
    const theme = usePanelTheme();
    return themeToCssProperties(theme);
}

export function makeColorSwatch(color: string, label: string): ColorSwatchProps {
    return { color, value: color, 'aria-label': label };
}

export function useColorSwatches(): ColorSwatchProps[] {
    const { t } = useTranslation();
    const theme = useSceneTheme();

    return [
        makeColorSwatch(COLOR_RED, t('colors.red')),
        makeColorSwatch(COLOR_ORANGE, t('colors.orange')),
        makeColorSwatch(COLOR_YELLOW, t('colors.yellow')),
        makeColorSwatch(COLOR_GREEN, t('colors.green')),
        makeColorSwatch(COLOR_CYAN, t('colors.cyan')),
        makeColorSwatch(COLOR_BLUE, t('colors.blue')),
        makeColorSwatch(COLOR_VIOLET, t('colors.violet')),
        makeColorSwatch(COLOR_PINK, t('colors.pink')),
        makeColorSwatch(COLOR_FUSCHIA, t('colors.fuschia')),
        makeColorSwatch(COLOR_BLUE_WHITE, t('colors.blueish-white')),
        makeColorSwatch(COLOR_DARK_PURPLE, t('colors.dark-purple')),
        makeColorSwatch(COLOR_WHITE, t('colors.white')),
        makeColorSwatch(COLOR_BLACK, t('colors.black')),
        makeColorSwatch(theme.colorGrid, t('colors.grid')),
        makeColorSwatch(theme.colorArena, t('colors.arena')),
        makeColorSwatch(theme.colorBackground, t('colors.background')),
    ];
}

// ==== Fluent UI themes ====

const darkTheme: Theme = {
    ...webDarkTheme,
    colorNeutralBackground1: '#0e1722',
    colorNeutralBackground2: '#0b1622',
    colorNeutralBackground3: '#101f2d',
    colorNeutralBackground1Hover: '#122133',
    colorNeutralBackground1Pressed: '#16293d',
    colorNeutralBackground1Selected: '#122133',
    colorNeutralBackground3Hover: '#14283a',
    colorNeutralBackground3Pressed: '#16293d',
    colorNeutralBackground3Selected: '#14283a',
    colorNeutralBackground6: '#122133',
    colorNeutralBackgroundDisabled: '#0b1622',
    colorNeutralStroke1: '#2a3f55',
    colorNeutralStroke3: '#1e3246',
    colorSubtleBackgroundHover: '#14283a',
    colorSubtleBackgroundSelected: '#16293d',
    colorNeutralBackgroundAlpha: 'rgb(14 23 34 / 0.55)',
};

// Colors adjusted to a more sepia tone that's easier on the eyes and is similar
// to a clean, cool light theme.
const lightTheme: Theme = {
    ...webLightTheme,
    colorNeutralBackground1: '#ffffff',
    colorNeutralBackground2: '#f7fbff',
    colorNeutralBackground3: '#ffffff',
    colorNeutralBackground1Hover: '#eef6fb',
    colorNeutralBackground1Pressed: '#e2eff8',
    colorNeutralBackground1Selected: '#eef6fb',
    colorNeutralBackground3Hover: '#f7fbff',
    colorNeutralBackground3Pressed: '#eef6fb',
    colorNeutralBackground3Selected: '#eef6fb',
    colorNeutralBackground6: '#eef6fb',
    colorNeutralBackgroundDisabled: '#f3f8fc',
    colorNeutralStencil1: '#e2eff8',
    colorNeutralStroke1: '#b6cde0',
    colorNeutralStroke3: '#d7e5f0',
    colorSubtleBackgroundHover: '#e2eff8',
    colorSubtleBackgroundSelected: '#d7e5f0',
    colorNeutralBackgroundAlpha: 'rgb(255 255 255 / 0.55)',
};

function applyCandyBrand(theme: Theme, palette: ThemePalette): Theme {
    const brand =
        palette === 'candyMint'
            ? '#ff4fa0'
            : palette === 'candyGrape'
              ? '#9b6bff'
              : palette === 'candyPeach'
                ? '#ff7a45'
                : palette === 'candySky'
                  ? '#2bd4a6'
                  : theme.colorBrandStroke1;

    return {
        ...theme,
        colorBrandBackground: brand,
        colorBrandBackgroundHover: brand,
        colorBrandBackgroundPressed: brand,
        colorBrandBackgroundSelected: brand,
        colorBrandForeground1: brand,
        colorBrandForeground2: brand,
        colorBrandStroke1: brand,
        colorBrandStroke2: brand,
        colorCompoundBrandBackground: brand,
        colorCompoundBrandForeground1: '#ffffff',
        colorCompoundBrandStroke: brand,
    };
}

function applyCandyNeutrals(theme: Theme, palette: ThemePalette, darkMode: boolean | undefined): Theme {
    if (palette === 'default') {
        return theme;
    }

    const light =
        palette === 'candyMint'
            ? {
                  bg1: '#fff7fb',
                  bg2: '#fff0f7',
                  bg3: '#ffffff',
                  bg6: '#fff0f7',
                  stroke1: '#ffd1e3',
                  stroke3: '#ffe0ee',
                  subtleHover: '#ffedf6',
                  subtleSelected: '#ffe2f1',
              }
            : palette === 'candyGrape'
              ? {
                    bg1: '#fcf8ff',
                    bg2: '#f6efff',
                    bg3: '#ffffff',
                    bg6: '#f6efff',
                    stroke1: '#e2d3ff',
                    stroke3: '#efe6ff',
                    subtleHover: '#f3ebff',
                    subtleSelected: '#ebe0ff',
                }
              : palette === 'candyPeach'
                ? {
                      bg1: '#fff8f4',
                      bg2: '#fff1ea',
                      bg3: '#ffffff',
                      bg6: '#fff1ea',
                      stroke1: '#ffd6c7',
                      stroke3: '#ffe6dd',
                      subtleHover: '#ffefe7',
                      subtleSelected: '#ffe3d7',
                  }
                : {
                      bg1: '#f3fffb',
                      bg2: '#e8fff7',
                      bg3: '#ffffff',
                      bg6: '#e8fff7',
                      stroke1: '#b9f3e5',
                      stroke3: '#d7fbf2',
                      subtleHover: '#ddfff5',
                      subtleSelected: '#ccfff0',
                  };

    const dark =
        palette === 'candyMint'
            ? {
                  bg1: '#141018',
                  bg2: '#120e15',
                  bg3: '#191220',
                  bg6: '#15101c',
                  stroke1: '#3a2a3b',
                  stroke3: '#2e2230',
                  subtleHover: '#201728',
                  subtleSelected: '#241b2d',
              }
            : palette === 'candyGrape'
              ? {
                    bg1: '#12101a',
                    bg2: '#100e16',
                    bg3: '#171223',
                    bg6: '#14101f',
                    stroke1: '#2f2946',
                    stroke3: '#251f36',
                    subtleHover: '#1e1730',
                    subtleSelected: '#221a36',
                }
              : palette === 'candyPeach'
                ? {
                      bg1: '#161112',
                      bg2: '#130f10',
                      bg3: '#1c1416',
                      bg6: '#171114',
                      stroke1: '#3c2a2a',
                      stroke3: '#2f2121',
                      subtleHover: '#23181a',
                      subtleSelected: '#281c1f',
                  }
                : {
                      bg1: '#0e1414',
                      bg2: '#0b1111',
                      bg3: '#111b1b',
                      bg6: '#0f1717',
                      stroke1: '#1f3d37',
                      stroke3: '#18332d',
                      subtleHover: '#142322',
                      subtleSelected: '#162726',
                  };

    const t = darkMode ? dark : light;

    return {
        ...theme,
        colorNeutralBackground1: t.bg1,
        colorNeutralBackground2: t.bg2,
        colorNeutralBackground3: t.bg3,
        colorNeutralBackground6: t.bg6,
        colorNeutralStroke1: t.stroke1,
        colorNeutralStroke3: t.stroke3,
        colorSubtleBackgroundHover: t.subtleHover,
        colorSubtleBackgroundSelected: t.subtleSelected,
    };
}

export function getFluentTheme(darkMode: boolean | undefined, palette: ThemePalette) {
    const base = darkMode ? darkTheme : lightTheme;
    return applyCandyNeutrals(applyCandyBrand(base, palette), palette, darkMode);
}
