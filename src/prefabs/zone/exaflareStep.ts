export type ExaflareStepRange = {
    stepSize: number;
    stepPosition: number;
    start: number;
    end: number;
};

const DEFAULT_STEP_SIZE = 1;
const DEFAULT_STEP_POSITION = 0;

export function normalizeExaflareStep(length: number, stepSize?: number, stepPosition?: number): ExaflareStepRange {
    const len = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;
    const rawSize = typeof stepSize === 'number' ? stepSize : DEFAULT_STEP_SIZE;
    const rawPos = typeof stepPosition === 'number' ? stepPosition : DEFAULT_STEP_POSITION;

    const sizeInt = Math.max(1, Math.floor(rawSize));
    const posInt = Math.floor(rawPos);

    if (len === 0) {
        return { stepSize: sizeInt, stepPosition: 0, start: 0, end: 0 };
    }

    const maxIndex = Math.max(0, len - 1);
    const start = Math.min(maxIndex, Math.max(-maxIndex, posInt));
    const end = Math.min(len, start + sizeInt);
    return { stepSize: sizeInt, stepPosition: start, start, end };
}
