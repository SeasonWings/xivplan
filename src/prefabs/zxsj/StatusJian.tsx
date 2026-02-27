import { useTranslation } from 'react-i18next';
import { getDragOffset } from '../../DropHandler';
import { ObjectType } from '../../scene';
import { usePanelDrag } from '../../usePanelDrag';
import { PrefabIcon } from '../PrefabIcon';

export const StatusJian: React.FC = () => {
    const { t } = useTranslation();
    const [, setDragObject] = usePanelDrag();

    const defaultNameKey = 'statusIcons.jian';
    const name = t(defaultNameKey, { defaultValue: 'Sword Mark' });
    const icon = '/marker/zxsj/jian.png';
    const defaultColor = '#ff0000';

    return (
        <PrefabIcon
            draggable
            name={name}
            icon={
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: defaultColor,
                        maskImage: `url(${icon})`,
                        WebkitMaskImage: `url(${icon})`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                    }}
                />
            }
            onDragStart={(e) => {
                setDragObject({
                    object: {
                        type: ObjectType.Icon,
                        image: icon,
                        defaultNameKey,
                        color: defaultColor,
                        width: 32,
                        height: 32,
                    },
                    offset: getDragOffset(e),
                });
            }}
        />
    );
};
