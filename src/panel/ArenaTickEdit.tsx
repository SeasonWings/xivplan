import { Divider, Field } from '@fluentui/react-components';
import {
    bundleIcon,
    CircleFilled,
    CircleRegular,
    SquareFilled,
    SquareHintFilled,
    SquareHintRegular,
    SquareRegular,
} from '@fluentui/react-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArenaShape,
    DEFAULT_RADIAL_TICKS,
    DEFAULT_RECT_TICKS,
    DEFAULT_TRI_TICKS,
    NO_TICKS,
    Ticks,
    TickType,
} from '../scene';
import { useScene } from '../SceneProvider';
import { Segment, SegmentedGroup } from '../Segmented';
import { SpinButton } from '../SpinButton';
import { SpinButtonUnits } from '../SpinButtonUnits';
import { useControlStyles } from '../useControlStyles';

const SquareHintIcon = bundleIcon(SquareHintFilled, SquareHintRegular);
const CircleIcon = bundleIcon(CircleFilled, CircleRegular);
const SquareIcon = bundleIcon(SquareFilled, SquareRegular);

const TriangleFilledIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true" {...props}>
        <path d="M12 4L21 20H3L12 4Z" fill="currentColor" />
    </svg>
);

const TriangleRegularIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
        <path d="M12 4L21 20H3L12 4Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
);

const TriangleIcon = bundleIcon(TriangleFilledIcon, TriangleRegularIcon);

export const ArenaTickEdit: React.FC = () => {
    const classes = useControlStyles();
    const { scene, dispatch } = useScene();
    const ticks = scene.arena.ticks;
    const { t } = useTranslation();
    const isTriangleArena = scene.arena.shape === ArenaShape.Triangle;

    const setTicks = (ticks: Ticks) => {
        dispatch({ type: 'arenaTicks', value: ticks });
    };

    const onTypeChange = (option?: TickType) => {
        if (isTriangleArena) {
            switch (option) {
                case TickType.None:
                    setTicks(NO_TICKS);
                    return;
                case TickType.Triangular:
                    setTicks(DEFAULT_TRI_TICKS);
                    return;
            }
            return;
        }

        switch (option) {
            case TickType.None:
                setTicks(NO_TICKS);
                break;

            case TickType.Radial:
                setTicks(DEFAULT_RADIAL_TICKS);
                break;

            case TickType.Rectangular:
                setTicks(DEFAULT_RECT_TICKS);
                break;

            case TickType.Triangular:
                break;
        }
    };

    return (
        <div className={classes.column}>
            <Field label={t('arena.borderTicks')}>
                <SegmentedGroup
                    name="arena-ticks"
                    value={ticks?.type ?? TickType.None}
                    onChange={(ev, data) => onTypeChange(data.value as TickType)}
                >
                    {isTriangleArena ? (
                        <>
                            <Segment value={TickType.None} icon={<SquareHintIcon />} title={t('arena.none')} />
                            <Segment value={TickType.Triangular} icon={<TriangleIcon />} title={t('arena.triangle')} />
                        </>
                    ) : (
                        <>
                            <Segment value={TickType.None} icon={<SquareHintIcon />} title={t('arena.none')} />
                            <Segment value={TickType.Radial} icon={<CircleIcon />} title={t('arena.circle')} />
                            <Segment value={TickType.Rectangular} icon={<SquareIcon />} title={t('arena.rectangle')} />
                        </>
                    )}
                </SegmentedGroup>
            </Field>
            {ticks?.type === TickType.Triangular && (
                <div className={classes.row}>
                    <Field label={t('arena.scaleNumber')}>
                        <SpinButton
                            min={1}
                            max={6}
                            step={1}
                            value={ticks.level}
                            onChange={(ev, data) => {
                                if (data.value) {
                                    setTicks({ ...ticks, level: data.value });
                                }
                            }}
                        />
                    </Field>
                </div>
            )}
            {ticks?.type === TickType.Radial && (
                <>
                    <div className={classes.row}>
                        <Field label={t('arena.majorTicks')}>
                            <SpinButton
                                min={0}
                                max={90}
                                step={1}
                                value={ticks.majorCount}
                                onChange={(ev, data) => {
                                    if (typeof data.value === 'number') {
                                        setTicks({ ...ticks, majorCount: data.value });
                                    }
                                }}
                            />
                        </Field>
                        <Field label={t('arena.majorRotation')}>
                            <SpinButtonUnits
                                min={-180}
                                max={180}
                                step={5}
                                fractionDigits={1}
                                suffix="°"
                                value={ticks.majorStart}
                                onChange={(ev, data) => {
                                    if (typeof data.value === 'number') {
                                        setTicks({ ...ticks, majorStart: data.value });
                                    }
                                }}
                            />
                        </Field>
                    </div>
                    <div className={classes.row}>
                        <Field label={t('arena.minorTicks')}>
                            <SpinButton
                                min={0}
                                max={180}
                                step={1}
                                value={ticks.minorCount}
                                onChange={(ev, data) => {
                                    if (typeof data.value === 'number') {
                                        setTicks({ ...ticks, minorCount: data.value });
                                    }
                                }}
                            />
                        </Field>
                        <Field label={t('arena.minorRotation')}>
                            <SpinButtonUnits
                                min={-180}
                                max={180}
                                step={5}
                                fractionDigits={1}
                                suffix="°"
                                value={ticks.minorStart}
                                onChange={(ev, data) => {
                                    if (typeof data.value === 'number') {
                                        setTicks({ ...ticks, minorStart: data.value });
                                    }
                                }}
                            />
                        </Field>
                    </div>
                </>
            )}
            {ticks?.type === TickType.Rectangular && (
                <>
                    <div className={classes.row}>
                        <Field label={t('arena.columns')}>
                            <SpinButton
                                min={1}
                                max={100}
                                step={1}
                                value={ticks.columns}
                                onChange={(ev, data) => {
                                    if (data.value) {
                                        setTicks({ ...ticks, columns: data.value });
                                    }
                                }}
                            />
                        </Field>
                        <Field label={t('arena.rows')}>
                            <SpinButton
                                min={1}
                                max={100}
                                step={1}
                                value={ticks.rows}
                                onChange={(ev, data) => {
                                    if (data.value) {
                                        setTicks({ ...ticks, rows: data.value });
                                    }
                                }}
                            />
                        </Field>
                    </div>
                </>
            )}
            {ticks && ticks.type !== TickType.None && <Divider />}
        </div>
    );
};
