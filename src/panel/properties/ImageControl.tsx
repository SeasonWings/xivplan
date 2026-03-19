import { Field, makeStyles } from '@fluentui/react-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DeferredInput } from '../../DeferredInput';
import { useScene } from '../../SceneProvider';
import { ImageObject } from '../../scene';
import { commonValue } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';
import { ImageUploadButton } from '../../ImageUploadButton';

const useStyles = makeStyles({
    inputRow: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
    },
    input: {
        flexGrow: 1,
    },
});

export const ImageControl: React.FC<PropertiesControlProps<ImageObject>> = ({ objects }) => {
    const classes = useStyles();
    const { dispatch } = useScene();
    const { t } = useTranslation();

    const image = commonValue(objects, (obj) => obj.image);

    const setImage = (image: string) =>
        dispatch({ type: 'update', value: objects.map((obj) => ({ ...obj, image })), transient: true });

    const handleUpload = (base64: string) => {
        setImage(base64);
        dispatch({ type: 'commit' });
    };

    return (
        <Field label={t('properties.imageUrl')}>
            <div className={classes.inputRow}>
                <DeferredInput
                    value={image}
                    onChange={(ev, data) => setImage(data.value)}
                    onCommit={() => dispatch({ type: 'commit' })}
                    className={classes.input}
                />
                <ImageUploadButton onImageUpload={handleUpload} />
            </div>
        </Field>
    );
};
