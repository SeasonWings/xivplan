import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getDragOffset } from '../../DropHandler';
import { ObjectType } from '../../scene';
import { useImageTracked } from '../../useObjectLoading';
import { usePanelDrag } from '../../usePanelDrag';
import { wrapImageUrl } from '../../util/cos';
import { PrefabIcon } from '../PrefabIcon';

export const StatusShangDeath: React.FC = () => {
    const { t } = useTranslation();
    const [, setDragObject] = usePanelDrag();

    const defaultNameKey = 'statusIcons.shang';
    const name = t(defaultNameKey);
    const iconPath = '/marker/zxsj/shang.png';
    // 使用 useImageTracked 确保图片加载并在加载完成后显示
    const [image] = useImageTracked(iconPath);
    void image; // 仅用于触发加载跟踪，不直接使用变量

    const icon = useMemo(() => wrapImageUrl(iconPath), [iconPath]);
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
