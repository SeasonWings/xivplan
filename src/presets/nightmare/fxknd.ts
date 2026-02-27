import { ArenaPreset, ArenaShape, GridType } from '../../scene';

const BATTLE_1: ArenaPreset = {
    name: '伏凶夔牛岛-万毒三老',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/fxknd/fxknd_b1.png',
};
const BATTLE_3: ArenaPreset = {
    name: '伏凶夔牛岛-髯奴',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/fxknd/fxknd_b3.png',
};
const BATTLE_4: ArenaPreset = {
    name: '伏凶夔牛岛-夔牛-无边框',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/fxknd/fxknd_b4.png',
};

export const ARENA_PRESETS_NIGHTMARE_FXKND = [BATTLE_1, BATTLE_3, BATTLE_4];
