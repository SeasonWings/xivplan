import { ArenaPreset, ArenaShape, GridType } from '../../scene';

const BATTLE_1: ArenaPreset = {
    name: '霜封无垢海-慈悲戒师',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/wxl/sfwgh_b1.png',
};

const BATTLE_2: ArenaPreset = {
    name: '霜封无垢海-慈心霜魂',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 30,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/wxl/sfwgh_b2.png',
};

const BATTLE_3: ArenaPreset = {
    name: '解枢断妄崖-止欲戒师',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 20,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/wxl/jsdwy_b1.png',
};

const BATTLE_4: ArenaPreset = {
    name: '逆命寂灭墟-无名',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 20,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/wxl/nmjmx_s1.png',
};

const BATTLE_5: ArenaPreset = {
    name: '逆命寂灭墟-孤辰尊·梵空',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 20,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/wxl/nmjmx_s2.png',
};

const BATTLE_6: ArenaPreset = {
    name: '逆命寂灭墟-后卿魔像',
    shape: ArenaShape.Rectangle,
    width: 600,
    height: 600,
    padding: 20,
    grid: { type: GridType.None },
    backgroundImage: '/arena/zxsj/nightmare/wxl/nmjmx_s3.png',
};

export const ARENA_PRESETS_NIGHTMARE_WXL = [BATTLE_1, BATTLE_2, BATTLE_3, BATTLE_4, BATTLE_5, BATTLE_6];
