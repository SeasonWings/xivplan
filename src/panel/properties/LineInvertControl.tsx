import { Field } from '@fluentui/react-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { Segment, SegmentedGroup } from '../../Segmented';
import { LineZone } from '../../scene';
import { commonValue, setOrOmit } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';

enum Directions {
    Normal = 'normal',
    Inverted = 'inverted',
}

export const LineInvertControl: React.FC<PropertiesControlProps<LineZone>> = ({ objects }) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const inverted = commonValue(objects, (obj) => !!obj.inverted);
    const direction = inverted ? Directions.Inverted : Directions.Normal;

    const onDirectionChanged = (direction: string) => {
        const inverted = direction === Directions.Inverted;
        dispatch({ type: 'update', value: objects.map((obj) => setOrOmit(obj, 'inverted', inverted)) });
    };

    return (
        <Field label={t('properties.lineInvert') || 'Line Invert'}>
            <SegmentedGroup
                name="line-invert"
                value={direction}
                onChange={(ev, data) => onDirectionChanged(data.value)}
            >
                <Segment value={Directions.Normal} title={t('properties.centerRange') || 'Center Range'} />
                <Segment value={Directions.Inverted} title={t('properties.leftRightRanges') || 'Left/Right Ranges'} />
            </SegmentedGroup>
        </Field>
    );
};
