import { useToastController } from '@fluentui/react-components';
import React, { useEffect, useRef } from 'react';
import { useScene } from './SceneProvider';
import { SceneObject } from './scene';
import { MessageToast } from './MessageToast';

export const RotationLockNotifier: React.FC = () => {
    const { step } = useScene();
    const { dispatchToast } = useToastController();
    const prevObjects = useRef<readonly SceneObject[]>(step.objects);

    useEffect(() => {
        const prev = prevObjects.current;
        const current = step.objects;
        const currentIds = new Set(current.map((o) => o.id));
        for (const o of prev) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rl = (o as any).rotationLock as { targetId: number } | undefined;
            if (!rl) continue;
            if (!currentIds.has(o.id) || !currentIds.has(rl.targetId)) {
                dispatchToast(<MessageToast title="提示" message="锁定旋转点已自动解除：关联对象被删除" />, {
                    intent: 'info',
                });
                break;
            }
        }
        prevObjects.current = current;
    }, [step.objects, dispatchToast]);

    return null;
};
