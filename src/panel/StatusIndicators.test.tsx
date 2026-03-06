// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusIndicators } from './StatusIndicators';
import { getDynamicColor } from './colorUtils';

// Mock translation
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, defaultValue: string) => defaultValue,
    }),
}));

afterEach(() => {
    cleanup();
});

describe('getDynamicColor', () => {
    it('should generate consistent colors for the same seed', () => {
        const color1 = getDynamicColor(123);
        const color2 = getDynamicColor(123);
        expect(color1).toEqual(color2);
    });

    it('should generate different colors for different seeds', () => {
        const color1 = getDynamicColor(123);
        const color2 = getDynamicColor(456);
        expect(color1).not.toEqual(color2);
    });

    it('should generate high lightness background for readability', () => {
        const color = getDynamicColor(123);
        // We expect bgLightness to be 92%
        expect(color.background).toContain('92%');
    });
});

describe('StatusIndicators', () => {
    it('should render nothing if neither locked nor target', () => {
        const { container } = render(<StatusIndicators />);
        expect(container.firstChild).toBeNull();
    });

    it('should render locked badge if lockedSeed is provided', () => {
        render(<StatusIndicators lockedSeed={1} />);
        expect(screen.getByText('锁定')).toBeTruthy();
    });

    it('should render target badge if targetSeed is provided', () => {
        render(<StatusIndicators targetSeed={2} />);
        expect(screen.getByText('目标')).toBeTruthy();
    });

    it('should render both badges if both seeds provided', () => {
        render(<StatusIndicators lockedSeed={1} targetSeed={2} />);
        expect(screen.getAllByText('锁定')).toHaveLength(1);
        expect(screen.getAllByText('目标')).toHaveLength(1);
    });

    it('should use dynamic colors based on seeds', () => {
        render(<StatusIndicators lockedSeed={123} />);
        const lockedBadge = screen.getByText('锁定');
        const color1 = lockedBadge.style.backgroundColor;

        // Cleanup and rerender fresh to compare
        cleanup();
        render(<StatusIndicators lockedSeed={456} />);
        const lockedBadge2 = screen.getByText('锁定');
        const color2 = lockedBadge2.style.backgroundColor;

        expect(color1).not.toBe(color2);
    });
});
