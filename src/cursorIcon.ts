const ARROW_PATH =
    'm128.035156 495.066406v-392.800781l281.730469 281.734375h-170.664063zm21.332032-341.332031v289.867187l80.933593-80.933593h128zm0 0';

const CLICK_EFFECT_PATHS = [
    'm138.699219 0h21.335937v74.667969h-21.335937zm0 0',
    'm224.035156 138.667969h74.664063v21.332031h-74.664063zm0 0',
    'm.0351562 138.667969h74.6640628v21.332031h-74.6640628zm0 0',
    'm254.875 28.738281 15.085938 15.082031-55.53125 55.53125-15.085938-15.082031zm0 0',
    'm84.210938 199.402344 15.082031 15.085937-55.527344 55.53125-15.085937-15.085937zm0 0',
    'm43.855469 28.738281 55.53125 55.53125-15.082031 15.085938-55.53125-55.53125zm0 0',
];

export function getCursorSvg(color: string, clicked = false) {
    const clickEffects = clicked ? CLICK_EFFECT_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join('') : '';
    const paths = `<path d="${ARROW_PATH}" fill="${color}"/>${clickEffects}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-43 0 495 495.06667" width="32" height="32"><defs><filter id="cursorShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="10" dy="10" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/></filter></defs><g filter="url(#cursorShadow)">${paths}</g></svg>`;
}

export function getCursorDataUrl(color: string, clicked = false) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getCursorSvg(color, clicked))}`;
}

export function getCursorCss(color = '#000000', hotspotX = 0, hotspotY = 0, clicked = false) {
    return `url("${getCursorDataUrl(color, clicked)}") ${hotspotX} ${hotspotY}, auto`;
}

export const DEFAULT_POINTER_CURSOR = getCursorCss('#000000', 10, 6, false);
export const CLICK_POINTER_CURSOR = getCursorCss('#000000', 10, 6, true);

export const CANVAS_POINTER_CURSOR = getCursorCss('#ffffff', 10, 6, false);
export const CANVAS_CLICK_POINTER_CURSOR = getCursorCss('#ffffff', 10, 6, true);

const CROSSHAIR_PATHS = [
    'm.398438 488.800781v-488.800781l345.734374 345.734375h-202.667968zm21.335937-437.335937v385.867187l112.933594-112.933593h160zm0 0',
    'm320.398438 15.066406h21.335937v213.332032h-21.335937zm0 0',
    'm362 61.066406-30.933594-30.933594-30.933594 30.933594-15.066406-15.066406 46-46 46 46zm0 0',
    'm255.332031 167.734375-46-46 46-46 15.066407 15.066406-30.933594 30.933594 30.933594 30.933594zm0 0',
    'm331.066406 243.464844-46-46 15.066406-15.066406 30.933594 30.933593 30.933594-30.933593 15.066406 15.066406zm0 0',
    'm406.800781 167.734375-15.066406-15.066406 30.933594-30.933594-30.933594-30.933594 15.066406-15.066406 46 46zm0 0',
    'm224.398438 111.066406h213.335937v21.332032h-213.335937zm0 0',
];

export function getCrosshairSvg(color: string) {
    const paths = CROSSHAIR_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 0 488 488.8" width="32" height="32"><defs><filter id="crosshairShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="10" dy="10" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/></filter></defs><g filter="url(#crosshairShadow)">${paths}</g></svg>`;
}

export function getCrosshairDataUrl(color: string) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getCrosshairSvg(color))}`;
}

export function getCrosshairCss(color = '#000000', hotspotX = 0, hotspotY = 0) {
    return `url("${getCrosshairDataUrl(color)}") ${hotspotX} ${hotspotY}, auto`;
}

export const CANVAS_CROSSHAIR_CURSOR = getCrosshairCss('#ffffff', 0, 0);
