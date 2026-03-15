import { Field, makeStyles, tokens } from '@fluentui/react-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { Segment, SegmentedGroup } from '../../Segmented';
import { BaseObject, UserLayer } from '../../scene';
import { commonValue } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';

const useStyles = makeStyles({
    label: {
        fontSize: tokens.fontSizeBase200,
        lineHeight: tokens.lineHeightBase200,
        whiteSpace: 'nowrap',
    },
});

export const LayerControl: React.FC<PropertiesControlProps<BaseObject>> = ({ objects }) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();
    const classes = useStyles();

    const value = commonValue(objects, (obj) => obj.layer ?? ('main' as const));

    const onChanged = (layer: UserLayer) => {
        dispatch({ type: 'update', value: objects.map((obj) => ({ ...obj, layer })) });
    };

    return (
        <Field label={t('properties.layer', { defaultValue: '图层' })}>
            <SegmentedGroup name="layer" value={value} onChange={(ev, data) => onChanged(data.value as UserLayer)}>
                <Segment
                    value="background"
                    size="mediumText"
                    title={t('properties.layerBackground', { defaultValue: '背景' })}
                    icon={
                        <span className={classes.label}>
                            {t('properties.layerBackground', { defaultValue: '背景层' })}
                        </span>
                    }
                />
                <Segment
                    value="main"
                    size="mediumText"
                    title={t('properties.layerMain', { defaultValue: '主图层' })}
                    icon={
                        <span className={classes.label}>{t('properties.layerMain', { defaultValue: '主图层' })}</span>
                    }
                />
                <Segment
                    value="foreground"
                    size="mediumText"
                    title={t('properties.layerForeground', { defaultValue: '前景' })}
                    icon={
                        <span className={classes.label}>
                            {t('properties.layerForeground', { defaultValue: '前景层' })}
                        </span>
                    }
                />
            </SegmentedGroup>
        </Field>
    );
};
