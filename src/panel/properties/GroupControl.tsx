import { Button, Field, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowFitInFilled, DismissRegular } from '@fluentui/react-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScene } from '../../SceneProvider';
import { SceneObject, UnknownObject } from '../../scene';
import { commonValue } from '../../util';
import { PropertiesControlProps } from '../PropertiesControl';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    row: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
    },
    groupInfo: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
});

export const GroupControl: React.FC<PropertiesControlProps<UnknownObject>> = ({ objects }) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();
    const classes = useStyles();

    // 检查是否所有对象都有groupId，以及是否是同一个组
    const groupId = commonValue(objects as (SceneObject & { groupId?: string })[], (obj) => obj.groupId);

    const hasGroup = groupId !== undefined && groupId !== null;
    const canGroup = objects.length >= 2;

    const handleCreateGroup = () => {
        if (objects.length < 2) {
            return;
        }

        // 生成唯一的组ID
        const newGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        dispatch({
            type: 'update',
            value: objects.map((obj) => ({ ...obj, groupId: newGroupId })),
        });
        dispatch({ type: 'commit' });
    };

    const handleUngroup = () => {
        dispatch({
            type: 'update',
            value: objects.map((obj) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { groupId, ...rest } = obj as SceneObject & { groupId?: string };
                return rest as SceneObject;
            }),
        });
        dispatch({ type: 'commit' });
    };

    return (
        <div className={classes.container} data-tutorial="group-control">
            {(canGroup || hasGroup) && (
                <Field label={t('properties.group', { defaultValue: '元素组' })}>
                    <div className={classes.row}>
                        {!hasGroup && canGroup && (
                            <Button
                                appearance="secondary"
                                icon={<ArrowFitInFilled />}
                                onClick={handleCreateGroup}
                                data-tutorial="create-group-button"
                            >
                                {t('properties.createGroup', { defaultValue: '创建组' })}
                            </Button>
                        )}
                        {hasGroup && (
                            <Button
                                appearance="secondary"
                                icon={<DismissRegular />}
                                onClick={handleUngroup}
                                data-tutorial="ungroup-button"
                            >
                                {t('properties.ungroup', { defaultValue: '解散组' })}
                            </Button>
                        )}
                    </div>
                </Field>
            )}
            {hasGroup && (
                <div className={classes.groupInfo}>
                    {t('properties.groupInfo', {
                        defaultValue: '此元素属于一个组，拖动时会一起移动',
                    })}
                </div>
            )}
        </div>
    );
};
