import { Button, Dialog, DialogBody, DialogSurface, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { Calculator24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface CraftBuilderDialogProps {
    open: boolean;
    onClose: () => void;
}

const POS_KEY = 'xivplan_craftbuilder_dialog_pos';

function loadPos(): { x: number; y: number } | null {
    try {
        const raw = localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
        const x = typeof parsed.x === 'number' ? parsed.x : null;
        const y = typeof parsed.y === 'number' ? parsed.y : null;
        if (x === null || y === null) return null;
        return { x, y };
    } catch {
        return null;
    }
}

function savePos(pos: { x: number; y: number }) {
    try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
        return;
    }
}

export const CraftBuilderDialog: React.FC<CraftBuilderDialogProps> = ({ open, onClose }) => {
    const classes = useStyles();
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const animRef = useRef<Animation | null>(null);
    const [internalOpen, setInternalOpen] = useState(open);

    const initialPos = useMemo(() => loadPos(), []);
    const [{ x, y }, setPos] = useState<{ x: number; y: number }>(() => initialPos ?? { x: 100, y: 100 });
    const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });
    const [isDragging, setIsDragging] = useState(false);

    const prefersReducedMotion = useMemo(() => {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch {
            return false;
        }
    }, []);

    const getSourceRect = () => {
        const el = document.querySelector('[data-tutorial="craftbuilder-open"]');
        if (!(el instanceof HTMLElement)) return null;
        return el.getBoundingClientRect();
    };

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const animateSurface = useCallback(
        (dir: 'in' | 'out'): { animation: Animation; scale: number } | null => {
            const el = surfaceRef.current;
            if (!el || prefersReducedMotion) return null;
            const toRect = el.getBoundingClientRect();
            const fromRect = getSourceRect();
            const fromCx = (fromRect?.left ?? toRect.left) + (fromRect?.width ?? toRect.width) / 2;
            const fromCy = (fromRect?.top ?? toRect.top) + (fromRect?.height ?? toRect.height) / 2;
            const rawScale = fromRect ? Math.min(fromRect.width / toRect.width, fromRect.height / toRect.height) : 0.35;
            const s = clamp(rawScale, 0.15, 0.6);

            animRef.current?.cancel();
            el.style.transformOrigin = `${fromCx - toRect.left}px ${fromCy - toRect.top}px`;

            const keyframes =
                dir === 'in'
                    ? [
                          { transform: `scale(${s})`, opacity: 0.15 },
                          { transform: 'scale(1)', opacity: 1 },
                      ]
                    : [
                          { transform: 'scale(1)', opacity: 1 },
                          { transform: `scale(${s})`, opacity: 0 },
                      ];

            const animation = el.animate(keyframes, {
                duration: 260,
                easing: dir === 'in' ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
                fill: 'forwards',
            });
            animRef.current = animation;
            return { animation, scale: s };
        },
        [prefersReducedMotion],
    );

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => setInternalOpen(true));
        } else if (internalOpen) {
            if (prefersReducedMotion) {
                setInternalOpen(false);
            } else {
                requestAnimationFrame(() => {
                    const result = animateSurface('out');
                    if (!result) {
                        setInternalOpen(false);
                        return;
                    }
                    result.animation.onfinish = () => setInternalOpen(false);
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, prefersReducedMotion, animateSurface]);

    useEffect(() => {
        if (internalOpen && open) {
            requestAnimationFrame(() => {
                const result = animateSurface('in');
                if (!result) return;
                result.animation.onfinish = () => {
                    const el = surfaceRef.current;
                    if (!el) return;
                    el.style.transform = '';
                    el.style.opacity = '';
                    el.style.transformOrigin = '';
                };
            });
        }
    }, [internalOpen, open, animateSurface]);

    useEffect(() => {
        if (!internalOpen) return;

        const onMouseMove = (e: MouseEvent) => {
            if (!dragRef.current.dragging) return;
            // 使用固定的宽高值避免 getBoundingClientRect 导致的 layout thrashing
            const width = 420;
            const height = 560;
            const maxX = Math.max(0, window.innerWidth - width);
            const maxY = Math.max(0, window.innerHeight - height);
            const nextX = Math.min(maxX, Math.max(0, e.clientX - dragRef.current.dx));
            const nextY = Math.min(maxY, Math.max(48, e.clientY - dragRef.current.dy));
            setPos({ x: nextX, y: nextY });
        };

        const onMouseUp = () => {
            if (!dragRef.current.dragging) return;
            dragRef.current.dragging = false;
            setIsDragging(false);
            savePos({ x, y });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [internalOpen, x, y]);

    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const el = surfaceRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        dragRef.current.dragging = true;
        dragRef.current.dx = e.clientX - rect.left;
        dragRef.current.dy = e.clientY - rect.top;
        setIsDragging(true);
        e.preventDefault();
    };

    if (!internalOpen) return null;

    return (
        <Dialog open={internalOpen} onOpenChange={(_, data) => !data.open && onClose()} modalType="non-modal">
            <DialogSurface
                ref={surfaceRef}
                className={classes.surface}
                style={{
                    left: `${x}px`,
                    top: `${y}px`,
                }}
            >
                <div className={classes.header} onMouseDown={onMouseDown}>
                    <div className={classes.title}>
                        <Calculator24Regular />
                        <span style={{ marginLeft: '8px' }}>生产计算器</span>
                    </div>
                    <Button
                        appearance="subtle"
                        icon={<Dismiss24Regular />}
                        onClick={onClose}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={classes.closeButton}
                    />
                </div>
                <DialogBody className={classes.body} style={{ padding: 0, margin: 0 }}>
                    <iframe
                        src="https://craftbuilder.mapleshuzuko.site/"
                        title="CraftBuilder"
                        className={classes.iframe}
                        frameBorder="0"
                        style={{ display: 'block', margin: '-4px 0 0 -4px' }}
                    />
                    {isDragging && <div className={classes.dragOverlay} />}
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

const useStyles = makeStyles({
    surface: {
        position: 'fixed',
        width: '500px',
        height: '800px',
        maxWidth: 'none',
        maxHeight: 'none',
        ...shorthands.padding(0),
        display: 'flex',
        flexDirection: 'column',
        boxShadow: tokens.shadow64,
        ...shorthands.borderRadius(tokens.borderRadiusXLarge),
        overflow: 'hidden',
        zIndex: 1000,
        transform: 'none',
        margin: 0,
        minWidth: 'auto',
        minHeight: 'auto',
    },
    header: {
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shorthands.padding('0px', '12px'),
        backgroundColor: tokens.colorNeutralBackground1,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        cursor: 'move',
        userSelect: 'none',
        flexShrink: 0,
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    closeButton: {
        minWidth: 'auto',
        ...shorthands.padding('4px'),
    },
    body: {
        flex: 1,
        ...shorthands.padding(0),
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
    },
    dragOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
        backgroundColor: 'transparent',
    },
});
