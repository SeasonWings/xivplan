import { ExaflareZone } from '../../scene';

export type ExaflareStepChange = {
    objectIds: number[];
    stepSize: number;
    stepPosition: number;
};

type ExaflareStepChangeListener = (change: ExaflareStepChange) => void;

const exaflareStepChangeListeners = new Set<ExaflareStepChangeListener>();

export function onExaflareStepChange(listener: ExaflareStepChangeListener): () => void {
    exaflareStepChangeListeners.add(listener);
    return () => {
        exaflareStepChangeListeners.delete(listener);
    };
}

export function notifyExaflareStepChange(objects: readonly ExaflareZone[], stepSize: number, stepPosition: number) {
    if (exaflareStepChangeListeners.size === 0) return;
    const objectIds = objects.map((o) => o.id);
    for (const listener of exaflareStepChangeListeners) {
        listener({ objectIds, stepSize, stepPosition });
    }
}
