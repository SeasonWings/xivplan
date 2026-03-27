/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCosConfig, getCosConfig, initCosConfig, wrapImageUrl } from './cos';

// 模拟 global.fetch
global.fetch = vi.fn();
const mockFetch = vi.mocked(global.fetch);

describe('COS Utility', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        _resetCosConfig();
    });

    it('should not wrap URLs when COS is disabled', () => {
        const url = '/actor/DRK.png';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe(url);
    });

    it('should wrap image URLs with the COS base URL when enabled', async () => {
        const mockConfig = { baseUrl: 'https://my-cos.com', enabled: true };
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockConfig,
        } as Response);

        await initCosConfig();

        const url = '/actor/DRK.png';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe('https://my-cos.com/actor/DRK.png');
    });

    it('should not wrap absolute URLs', () => {
        const url = 'https://example.com/image.png';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe(url);
    });

    it('should not wrap data URLs', () => {
        const url = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe(url);
    });

    it('should handle URLs without leading slash when enabled', async () => {
        const mockConfig = { baseUrl: 'https://my-cos.com', enabled: true };
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockConfig,
        } as Response);

        await initCosConfig();

        const url = 'actor/DRK.png';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe('https://my-cos.com/actor/DRK.png');
    });

    it('should stay disabled when fetch fails', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        await initCosConfig();

        const config = getCosConfig();
        expect(config.enabled).toBe(false);

        const url = '/actor/DRK.png';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe(url);
    });

    it('should handle trailing slashes in baseUrl', async () => {
        const mockConfig = { baseUrl: 'https://my-custom-cos.com/', enabled: true };
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockConfig,
        } as Response);

        await initCosConfig();

        const url = '/actor/DRK.png';
        const wrapped = wrapImageUrl(url);
        expect(wrapped).toBe('https://my-custom-cos.com/actor/DRK.png');
    });
});
