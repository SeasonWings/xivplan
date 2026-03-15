import { Button, Dialog, DialogBody, DialogSurface, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { Dismiss24Regular, PeopleRegular } from '@fluentui/react-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import CollaborationPanel from './CollaborationPanel';
import { useCollaboration } from './CollaborationProvider';

export interface CollaborationDialogProps {
    open: boolean;
    onClose: () => void;
}

const POS_KEY = 'xivplan_collaboration_dialog_pos';

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

export const CollaborationDialog: React.FC<CollaborationDialogProps> = ({ open, onClose }) => {
    const classes = useStyles();
    const { connected, setCollaborationDialogOpen } = useCollaboration();
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const animRef = useRef<Animation | null>(null);
    const [internalOpen, setInternalOpen] = useState(open);

    const initialPos = useMemo(() => loadPos(), []);
    const [{ x, y }, setPos] = useState<{ x: number; y: number }>(() => initialPos ?? { x: 24, y: 72 });
    const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });

    const prefersReducedMotion = useMemo(() => {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch {
            return false;
        }
    }, []);

    const getSourceRect = () => {
        const el = document.querySelector('[data-tutorial="collaboration-open"]');
        if (!(el instanceof HTMLElement)) return null;
        return el.getBoundingClientRect();
    };

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const animateSurface = (dir: 'in' | 'out'): { animation: Animation; scale: number } | null => {
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
    };

    useEffect(() => {
        if (open) {
            setInternalOpen(true);
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
                    setInternalOpen(false);
                    result.animation.onfinish = () => {
                        const el = surfaceRef.current;
                        if (el) {
                            el.style.opacity = '0';
                            el.style.transform = `scale(${result.scale})`;
                        }
                    };
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!internalOpen || !open) return;
        if (prefersReducedMotion) return;
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [internalOpen]);

    useEffect(() => {
        setCollaborationDialogOpen(internalOpen);
        if (!internalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose, internalOpen, setCollaborationDialogOpen]);

    useEffect(() => {
        return () => {
            setCollaborationDialogOpen(false);
        };
    }, [setCollaborationDialogOpen]);

    useEffect(() => {
        if (!internalOpen) return;

        const onMouseMove = (e: MouseEvent) => {
            const el = surfaceRef.current;
            if (!dragRef.current.dragging || !el) return;
            const rect = el.getBoundingClientRect();
            const maxX = Math.max(0, window.innerWidth - rect.width);
            const maxY = Math.max(0, window.innerHeight - rect.height);
            const nextX = Math.min(maxX, Math.max(0, e.clientX - dragRef.current.dx));
            const nextY = Math.min(maxY, Math.max(48, e.clientY - dragRef.current.dy));
            setPos({ x: nextX, y: nextY });
        };

        const onMouseUp = () => {
            if (!dragRef.current.dragging) return;
            dragRef.current.dragging = false;
            savePos({ x, y });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [internalOpen, x, y]);

    return (
        <Dialog
            open={internalOpen}
            modalType="non-modal"
            onOpenChange={(e, data) => {
                if (!data.open) {
                    onClose();
                }
            }}
        >
            <DialogSurface
                ref={surfaceRef}
                className={classes.surface}
                style={{
                    left: x,
                    top: y,
                }}
            >
                <DialogBody className={classes.body}>
                    <div
                        className={classes.header}
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            const el = surfaceRef.current;
                            if (!el) return;
                            const rect = el.getBoundingClientRect();
                            dragRef.current.dragging = true;
                            dragRef.current.dx = e.clientX - rect.left;
                            dragRef.current.dy = e.clientY - rect.top;
                        }}
                    >
                        <div className={classes.titleRow}>
                            <PeopleRegular />
                            <span>协作</span>
                            <span className={connected ? classes.badgeConnected : classes.badgeDisconnected}>
                                {connected ? '已连接' : '未连接'}
                            </span>
                        </div>
                        <Button
                            appearance="subtle"
                            icon={<Dismiss24Regular />}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={onClose}
                        />
                    </div>
                    <div className={classes.content}>
                        <CollaborationPanel />
                    </div>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

const useStyles = makeStyles({
    surface: {
        position: 'fixed',
        width: '420px',
        height: '560px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        padding: 0,
        boxShadow: tokens.shadow64,
        borderRadius: tokens.borderRadiusXLarge,
        overflow: 'hidden',
        transform: 'none',
        margin: 0,
    },
    body: {
        padding: 0,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        height: '44px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: tokens.spacingHorizontalM,
        paddingRight: tokens.spacingHorizontalXS,
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
        userSelect: 'none',
        cursor: 'move',
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        fontWeight: tokens.fontWeightSemibold,
    },
    badgeConnected: {
        fontSize: tokens.fontSizeBase200,
        paddingLeft: tokens.spacingHorizontalS,
        paddingRight: tokens.spacingHorizontalS,
        height: '22px',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorPaletteGreenBackground1,
        color: tokens.colorPaletteGreenForeground1,
    },
    badgeDisconnected: {
        fontSize: tokens.fontSizeBase200,
        paddingLeft: tokens.spacingHorizontalS,
        paddingRight: tokens.spacingHorizontalS,
        height: '22px',
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorPaletteYellowBackground1,
        color: tokens.colorPaletteYellowForeground1,
    },
    content: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
    },
});
