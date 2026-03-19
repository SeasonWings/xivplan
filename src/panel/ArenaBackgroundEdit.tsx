import { Field, makeStyles } from '@fluentui/react-components';
import React from 'react';
import { DeferredInput } from '../DeferredInput';
import { OpacitySlider } from '../OpacitySlider';
import { useScene } from '../SceneProvider';
import { useTranslation } from 'react-i18next';
import { ImageUploadButton } from '../ImageUploadButton';

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

export const ArenaBackgroundEdit: React.FC = () => {
    const classes = useStyles();
    const { scene, dispatch } = useScene();
    const { t } = useTranslation();

    const handleUpload = (base64: string) => {
        dispatch({ type: 'arenaBackground', value: base64, transient: true });
        dispatch({ type: 'commit' });
    };

    return (
        <>
            <Field label={t('arena.backgroundImageUrl')}>
                <div className={classes.inputRow}>
                    <DeferredInput
                        value={scene.arena.backgroundImage}
                        onChange={(ev, data) => {
                            dispatch({ type: 'arenaBackground', value: data.value, transient: true });
                        }}
                        onCommit={() => dispatch({ type: 'commit' })}
                        className={classes.input}
                    />
                    <ImageUploadButton onImageUpload={handleUpload} />
                </div>
            </Field>
            {scene.arena.backgroundImage && (
                <OpacitySlider
                    label={t('arena.backgroundImageOpacity')}
                    value={scene.arena.backgroundOpacity ?? 100}
                    onChange={(ev, data) => {
                        dispatch({ type: 'arenaBackgroundOpacity', value: data.value, transient: data.transient });
                    }}
                    onCommit={() => dispatch({ type: 'commit' })}
                />
            )}
        </>
    );
};
