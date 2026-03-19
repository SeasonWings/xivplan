import { Button, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { DeleteRegular } from '@fluentui/react-icons';
import * as React from 'react';
import { getDragOffset } from '../DropHandler';
import { ObjectType, PartyObject } from '../scene';
import { DEFAULT_PARTY_OPACITY } from '../theme';
import { usePanelDrag } from '../usePanelDrag';
import { PrefabIcon } from './PrefabIcon';

const useStyles = makeStyles({
    container: {
        position: 'relative',
        display: 'inline-block',
        '&:hover .delete-button': {
            display: 'flex',
        },
    },
    deleteButton: {
        display: 'none',
        position: 'absolute',
        top: '-4px',
        right: '-4px',
        zIndex: 10,
        minWidth: '20px',
        height: '20px',
        padding: '0',
        borderRadius: '50%',
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow4,
        color: tokens.colorPaletteRedForeground1,
        '&:hover': {
            backgroundColor: tokens.colorPaletteRedBackground1,
            color: tokens.colorNeutralForegroundInverted,
        },
    },
});

interface CustomAssetIconProps {
    url: string;
    name: string;
    onDelete?: () => void;
}

export const CustomAssetIcon: React.FC<CustomAssetIconProps> = ({ url, name, onDelete }) => {
    const classes = useStyles();
    const [, setDragObject] = usePanelDrag();

    return (
        <div className={classes.container}>
            <PrefabIcon
                draggable
                name={name}
                icon={url}
                onDragStart={(e) => {
                    setDragObject({
                        object: {
                            type: ObjectType.Party, // 使用 Party 类型作为自定义图案的基础
                            image: url,
                            name: name,
                            width: 48,
                            height: 48,
                            opacity: DEFAULT_PARTY_OPACITY,
                        } as PartyObject,
                        offset: getDragOffset(e),
                    });
                }}
            />
            {onDelete && (
                <Button
                    className={mergeClasses(classes.deleteButton, 'delete-button')}
                    icon={<DeleteRegular style={{ fontSize: '12px' }} />}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    appearance="subtle"
                    size="small"
                />
            )}
        </div>
    );
};
