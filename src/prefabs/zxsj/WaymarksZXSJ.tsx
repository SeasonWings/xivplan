import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDragOffset } from '../../DropHandler';
import { ObjectType } from '../../scene';
import { DEFAULT_MARKER_OPACITY } from '../../theme';
import { usePanelDrag } from '../../usePanelDrag';
import { wrapImageUrl } from '../../util/cos';
import { PrefabIcon } from '../PrefabIcon';

async function loadImage(url: string): Promise<HTMLImageElement> {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) {
            throw new Error(`Failed to fetch image: ${res.status}`);
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(objectUrl);
                reject(e);
            };
            img.src = objectUrl;
        });
    } catch {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    }
}

function cropByAlpha(img: HTMLImageElement) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return { img, sx: 0, sy: 0, sw: w, sh: h };
    }
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const a = data[(y * w + x) * 4 + 3] ?? 0;
            if (a > 8) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX || maxY < minY) {
        return { img, sx: 0, sy: 0, sw: w, sh: h };
    }
    const pad = Math.floor(Math.min(w, h) * 0.02);
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);
    return { img, sx, sy, sw, sh };
}

async function composeDigitsImage(digits: number[]) {
    if (digits.length === 0) {
        return '';
    }
    const urls = digits.map((d) => wrapImageUrl(`/marker/zxsj/waymark/T_d_shuzi_${d}.png`));
    const imgs = await Promise.all(urls.map((u) => loadImage(u)));
    const crops = imgs.map((img) => cropByAlpha(img));

    const outSize = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return urls[0] ?? '';
    }

    const gap = outSize * 0.04;
    const maxH = Math.max(...crops.map((c) => c.sh));
    const sumW = crops.reduce((acc, c) => acc + c.sw, 0);
    const scale = Math.min((outSize * 0.86) / (sumW + gap * (crops.length - 1)), (outSize * 0.86) / maxH);
    const totalW = sumW * scale + gap * (crops.length - 1);
    let x = (outSize - totalW) / 2;
    for (const c of crops) {
        const dw = c.sw * scale;
        const dh = c.sh * scale;
        const y = (outSize - dh) / 2;
        ctx.drawImage(c.img, c.sx, c.sy, c.sw, c.sh, x, y, dw, dh);
        x += dw + gap;
    }
    return canvas.toDataURL('image/png');
}

function makeZxsjWaymark(n: number, digit: number, menuIcon: string, defaultColor: string, compositeDigits?: number[]) {
    const Component: React.FC = () => {
        const { t } = useTranslation();
        const [, setDragObject] = usePanelDrag();
        const defaultNameKey = `objects.zxsjWaymark${n}`;
        const name = t(defaultNameKey, { defaultValue: `ZXSJ Waymark ${n}` });
        const iconUrl = wrapImageUrl(`/marker/zxsj/waymark/T_d_shuzi_${digit}.png`);
        const menuIconUrl = wrapImageUrl(`/marker/zxsj/waymark/icon/${menuIcon}`);
        const [compositeUrl, setCompositeUrl] = useState<string | null>(null);

        const digits = useMemo(() => compositeDigits ?? null, []);

        useEffect(() => {
            if (!digits) return;
            let cancelled = false;
            composeDigitsImage(digits)
                .then((url) => {
                    if (cancelled) return;
                    setCompositeUrl(url);
                })
                .catch(() => {
                    if (cancelled) return;
                    setCompositeUrl(null);
                });
            return () => {
                cancelled = true;
            };
        }, [digits]);

        const displayIcon = compositeUrl ?? iconUrl;

        return (
            <PrefabIcon
                draggable
                name={name}
                icon={menuIconUrl}
                onDragStart={(e) => {
                    setDragObject({
                        object: {
                            type: ObjectType.Marker,
                            image: displayIcon,
                            defaultNameKey,
                            color: defaultColor,
                            shape: 'circle',
                            opacity: DEFAULT_MARKER_OPACITY,
                            width: 42,
                            height: 42,
                            rotation: 0,
                        },
                        offset: getDragOffset(e),
                    });
                }}
            />
        );
    };

    return Component;
}

export const ZxsjWaymark1 = makeZxsjWaymark(1, 1, 'UI_CB_SignRed_Normal.png', '#fc7d6a');
export const ZxsjWaymark2 = makeZxsjWaymark(2, 2, 'UI_CB_SignYellow_Normal.png', '#f3cb55');
export const ZxsjWaymark3 = makeZxsjWaymark(3, 3, 'UI_CB_SignGreen_Normal.png', '#8cec63');
export const ZxsjWaymark4 = makeZxsjWaymark(4, 4, 'UI_CB_SignPurple_Normal.png', '#df80f4');
export const ZxsjWaymark5 = makeZxsjWaymark(5, 5, 'UI_CB_SignBlue_Normal.png', '#6da8ff');
export const ZxsjWaymark6 = makeZxsjWaymark(6, 6, 'UI_CB_Sign06_Normal.png', '#ff81cb');
export const ZxsjWaymark7 = makeZxsjWaymark(7, 7, 'UI_CB_Sign07_Normal.png', '#66f0c1');
export const ZxsjWaymark8 = makeZxsjWaymark(8, 8, 'UI_CB_Sign08_Normal.png', '#b8a6ff');
export const ZxsjWaymark9 = makeZxsjWaymark(9, 9, 'UI_CB_Sign09_Normal.png', '#feb167');
export const ZxsjWaymark10 = makeZxsjWaymark(10, 0, 'UI_CB_Sign10_Normal.png', '#5bebfc', [1, 0]);
