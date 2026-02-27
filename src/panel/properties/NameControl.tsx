import { Field } from '@fluentui/react-components';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DeferredInput } from '../../DeferredInput';
import { useScene } from '../../SceneProvider';
import { ObjectType, SceneObject } from '../../scene';
import { commonValue } from '../../util';

// 获取对象的默认名称（使用翻译键）
function getDefaultTypeName(type: ObjectType, t: TFunction<'translation'>): string {
    return t(`objects.${type}`, type);
}

interface NameControlProps {
    objects: readonly SceneObject[];
    className?: string;
}

export const NameControl: React.FC<NameControlProps> = ({ objects, className }) => {
    const { dispatch } = useScene();
    const { t } = useTranslation();

    // 从对象中获取 name 属性（可能不存在）
    const name = commonValue(objects, (obj) => (obj as unknown as { name?: string }).name as string | undefined);
    const firstObject = objects[0];
    const objectType = firstObject ? firstObject.type : undefined;

    const setName = (name: string) =>
        dispatch({
            type: 'update',
            value: objects.map((obj) => ({ ...obj, name })) as SceneObject[],
            transient: true,
        });

    // 如果当前没有名称，显示默认的类型名称作为占位符
    const placeholder = objectType ? getDefaultTypeName(objectType, t) : t('properties.namePlaceholder', '输入名称');

    return (
        <Field label={t('properties.name')} className={className}>
            <DeferredInput
                value={name ?? ''}
                onChange={(_, data) => setName(data.value)}
                onCommit={() => dispatch({ type: 'commit' })}
                placeholder={placeholder}
            />
        </Field>
    );
};
