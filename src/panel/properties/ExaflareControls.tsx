import { Field, Switch } from '@fluentui/react-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { SpinButton } from '../../SpinButton';
import { SpinButtonUnits } from '../../SpinButtonUnits';
import { useSpinChanged } from '../../prefabs/useSpinChanged';
import {
    EXAFLARE_LENGTH_MAX,
    EXAFLARE_LENGTH_MIN,
    EXAFLARE_SPACING_MAX,
    EXAFLARE_SPACING_MIN,
} from '../../prefabs/zone/constants';
import { ExaflareZone } from '../../scene';
import { useControlStyles } from '../../useControlStyles';
import { commonValue } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';
import { notifyExaflareStepChange } from './exaflareStepEvents';

export const ExaflareLengthControl: React.FC<PropertiesControlProps<ExaflareZone>> = ({ objects }) => {
    const classes = useControlStyles();
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const length = commonValue(objects, (obj) => obj.length);

    const onLengthChanged = useSpinChanged((length: number) =>
        dispatch({ type: 'update', value: objects.map((obj) => ({ ...obj, length })) }),
    );

    return (
        <Field label={t('properties.length')} className={classes.cell}>
            <SpinButton
                value={length}
                onChange={onLengthChanged}
                min={EXAFLARE_LENGTH_MIN}
                max={EXAFLARE_LENGTH_MAX}
                step={1}
            />
        </Field>
    );
};

export const ExaflareSpacingControl: React.FC<PropertiesControlProps<ExaflareZone>> = ({ objects }) => {
    const classes = useControlStyles();
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const spacing = commonValue(objects, (obj) => obj.spacing);

    const onSpacingChanged = useSpinChanged((spacing: number) =>
        dispatch({ type: 'update', value: objects.map((obj) => ({ ...obj, spacing })) }),
    );

    return (
        <Field label={t('properties.spacing')} className={classes.cell}>
            <SpinButtonUnits
                value={spacing}
                suffix="%"
                onChange={onSpacingChanged}
                min={EXAFLARE_SPACING_MIN}
                max={EXAFLARE_SPACING_MAX}
                step={10}
            />
        </Field>
    );
};

export const ExaflareLengthDashControl: React.FC<PropertiesControlProps<ExaflareZone>> = ({ objects }) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const showLengthDash = commonValue(objects, (obj) => obj.showLengthDash ?? true) ?? true;

    const onChanged = (checked: boolean) => {
        dispatch({
            type: 'update',
            value: objects.map((obj) => ({
                ...obj,
                showLengthDash: checked,
            })),
        });
        dispatch({ type: 'commit' });
    };

    return (
        <Field label={t('properties.showLengthDash', { defaultValue: '长度虚线' })}>
            <Switch checked={showLengthDash} onChange={(_ev, data) => onChanged(data.checked)} />
        </Field>
    );
};

export const ExaflareStepSizeControl: React.FC<PropertiesControlProps<ExaflareZone>> = ({ objects }) => {
    const classes = useControlStyles();
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const stepSize = commonValue(objects, (obj) => obj.stepSize ?? 1) ?? 1;
    const length = commonValue(objects, (obj) => obj.length);
    const stepPosition = commonValue(objects, (obj) => obj.stepPosition ?? 0) ?? 0;

    const onChanged = useSpinChanged((value: number) => {
        const sizeInt = Math.max(1, Math.floor(value));
        const lenInt = typeof length === 'number' ? Math.max(0, Math.floor(length)) : 0;
        const maxIndex = Math.max(0, lenInt - 1);
        const posInt = Math.min(maxIndex, Math.max(-maxIndex, Math.floor(stepPosition)));

        dispatch({
            type: 'update',
            value: objects.map((obj) => ({
                ...obj,
                stepSize: sizeInt,
                stepPosition: posInt,
            })),
        });
        dispatch({ type: 'commit' });
        notifyExaflareStepChange(objects, sizeInt, posInt);
    });

    return (
        <Field label={t('properties.stepSize', { defaultValue: '步长' })} className={classes.cell}>
            <SpinButton value={stepSize} onChange={onChanged} min={1} max={999} step={1} />
        </Field>
    );
};

export const ExaflareStepPositionControl: React.FC<PropertiesControlProps<ExaflareZone>> = ({ objects }) => {
    const classes = useControlStyles();
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const stepPosition = commonValue(objects, (obj) => obj.stepPosition ?? 0) ?? 0;
    const length = commonValue(objects, (obj) => obj.length);
    const stepSize = commonValue(objects, (obj) => obj.stepSize ?? 1) ?? 1;

    const onChanged = useSpinChanged((value: number) => {
        const lenInt = typeof length === 'number' ? Math.max(0, Math.floor(length)) : 0;
        const maxIndex = Math.max(0, lenInt - 1);
        const posInt = Math.min(maxIndex, Math.max(-maxIndex, Math.floor(value)));
        const sizeInt = Math.max(1, Math.floor(stepSize));

        dispatch({
            type: 'update',
            value: objects.map((obj) => ({
                ...obj,
                stepPosition: posInt,
                stepSize: sizeInt,
            })),
        });
        dispatch({ type: 'commit' });
        notifyExaflareStepChange(objects, sizeInt, posInt);
    });

    const maxStepPosition = typeof length === 'number' ? Math.max(0, Math.floor(length) - 1) : 999;

    return (
        <Field label={t('properties.stepPosition', { defaultValue: '步进位置' })} className={classes.cell}>
            <SpinButton
                value={stepPosition}
                onChange={onChanged}
                min={-maxStepPosition}
                max={maxStepPosition}
                step={1}
            />
        </Field>
    );
};
