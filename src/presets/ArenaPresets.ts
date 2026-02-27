import { ArenaPreset } from '../scene';
import { ARENA_PRESETS_CRITERION } from './Criterion';
import { ARENA_PRESETS_GENERAL } from './General';
import { ARENA_PRESETS_TRIALS } from './Trials';
import { ARENA_PRESETS_NIGHTMARE_FXKND } from './nightmare/fxknd';
import { ARENA_PRESETS_NIGHTMARE_SFWGH } from './nightmare/sfwgh.ts';
import { ARENA_PRESETS_NIGHTMARE_YJSFR } from './nightmare/yjsfr.ts';
import { ARENA_PRESETS_RAID_ARCADION } from './raid/Arcadion';
import { ARENA_PRESETS_RAID_EDEN } from './raid/Eden';
import { ARENA_PRESETS_RAID_PANDAEMONIUM } from './raid/Pandaemonium';
import { ARENA_PRESETS_ULTIMATE_DSU } from './ultimate/DSU';
import { ARENA_PRESETS_ULTIMATE_FRU } from './ultimate/FRU';
import { ARENA_PRESETS_ULTIMATE_TEA } from './ultimate/TEA';
import { ARENA_PRESETS_ULTIMATE_TOP } from './ultimate/TOP';
import { ARENA_PRESETS_ULTIMATE_UCOB } from './ultimate/UCOB';
import { ARENA_PRESETS_ULTIMATE_UWU } from './ultimate/UWU';

export const ARENA_PRESETS: Record<string, Record<string, ArenaPreset[]>> = {
    最终幻想14: {},
    '': {
        General: ARENA_PRESETS_GENERAL,
        异闻迷宫: ARENA_PRESETS_CRITERION,
        '极&灭': ARENA_PRESETS_TRIALS,
    },
    大型任务: {
        伊甸希望乐园: ARENA_PRESETS_RAID_EDEN,
        万魔殿: ARENA_PRESETS_RAID_PANDAEMONIUM,
        阿卡狄亚登天斗技场: ARENA_PRESETS_RAID_ARCADION,
    },
    绝境战: {
        巴哈姆特绝境战: ARENA_PRESETS_ULTIMATE_UCOB,
        究极神兵绝境战: ARENA_PRESETS_ULTIMATE_UWU,
        亚历山大绝境战: ARENA_PRESETS_ULTIMATE_TEA,
        幻想龙诗绝境战: ARENA_PRESETS_ULTIMATE_DSU,
        欧米茄绝境验证战: ARENA_PRESETS_ULTIMATE_TOP,
        光暗未来绝境战: ARENA_PRESETS_ULTIMATE_FRU,
    },
    诛仙世界: {},
    大型团本: {
        伏凶夔牛岛: ARENA_PRESETS_NIGHTMARE_FXKND,
        // '炼狱逐夔影': ARENA_PRESETS_ULTIMATE_UCOB
        霜封无垢海: ARENA_PRESETS_NIGHTMARE_SFWGH,
        炎烬锁锋刃: ARENA_PRESETS_NIGHTMARE_YJSFR,
    },
};
