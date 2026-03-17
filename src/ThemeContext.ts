import { createContext, Dispatch } from 'react';

export type DarkModeValue = [boolean, Dispatch<boolean>];

export const DarkModeContext = createContext<DarkModeValue>([false, () => undefined]);

export type ThemePalette = 'default' | 'candyMint' | 'candyGrape' | 'candyPeach' | 'candySky';

export type ThemePaletteValue = [ThemePalette, Dispatch<ThemePalette>];

export const ThemePaletteContext = createContext<ThemePaletteValue>(['default', () => undefined]);
