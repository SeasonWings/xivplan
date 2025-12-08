import { Field, Switch } from '@fluentui/react-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { StackZone, RectangleZone, CircleZone, UnknownObject } from '../../scene';
import { commonValue } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';

type AnimatedObject = (StackZone | RectangleZone | CircleZone) & { animated?: boolean };

export const AnimatedControl: React.FC<PropertiesControlProps<UnknownObject>> = ({ objects }) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const animated = commonValue(objects as AnimatedObject[], (obj) => obj.animated !== false) ?? true;

    const onAnimatedChanged = (checked: boolean) => {
        dispatch({
            type: 'update',
            value: objects.map((obj) => ({
                ...obj,
                animated: checked,
            })),
        });
        dispatch({ type: 'commit' });
    };

    return (
        <Field label={t('properties.animated', { defaultValue: '动画效果' })}>
            <Switch checked={animated} onChange={(ev, data) => onAnimatedChanged(data.checked)} />
        </Field>
    );
};
