import { ArenaPreset, ArenaShape, GridType } from '../../scene';

const BATTLE_1: ArenaPreset = {
    name: '炎烬锁锋刃-火修罗',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/yjsfr/yjsfr_b1.png',
};

export const ARENA_PRESETS_NIGHTMARE_YJSFR = [BATTLE_1];
