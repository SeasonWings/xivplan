import { ArenaPreset, ArenaShape, GridType } from '../../scene';

const BATTLE_2: ArenaPreset = {
    name: '霜封无垢海-慈心霜魂',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/sfwgh/sfwgh_b2.png',
};

export const ARENA_PRESETS_NIGHTMARE_SFWGH = [BATTLE_2];
