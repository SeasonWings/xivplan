// 战术板分类配置

export interface Category {
    value: string;
    label: string;
    labelEn: string;
}

export interface GameCategory {
    value: string;
    label: string;
    labelEn: string;
    children: Category[];
}

export const GAME_CATEGORIES: GameCategory[] = [
    {
        value: 'ff14',
        label: 'FF14',
        labelEn: 'FF14',
        children: [
            { value: 'ff14_general', label: '通用', labelEn: 'FF14-通用' },
            { value: 'ff14_raid', label: '大型任务', labelEn: '大型任务' },
            { value: 'ff14_ultimate', label: '绝境战', labelEn: '绝境战' },
            { value: 'ff14_trial', label: '极神&灭', labelEn: '极神&灭' },
            { value: 'ff14_criterion', label: '异闻迷宫', labelEn: '异闻迷宫' },
        ],
    },
    {
        value: 'zxsj',
        label: '诛仙世界',
        labelEn: 'Zhu Xian World',
        children: [
            { value: 'zxsj_general', label: '通用', labelEn: '诛仙世界-通用' },
            { value: 'zxsj_nightmare', label: '噩梦', labelEn: '噩梦' },
        ],
    },
];

// 获取所有子分类的平铺列表
export const getAllCategories = (): Category[] => {
    return GAME_CATEGORIES.flatMap((game) => game.children);
};

// 根据分类值获取分类信息
export const getCategoryByValue = (value: string): Category | undefined => {
    return getAllCategories().find((cat) => cat.value === value);
};

// 根据分类值获取游戏分类
export const getGameByCategory = (categoryValue: string): GameCategory | undefined => {
    return GAME_CATEGORIES.find((game) => game.children.some((cat) => cat.value === categoryValue));
};

// 根据游戏值获取游戏分类
export const getGameByValue = (gameValue: string): GameCategory | undefined => {
    return GAME_CATEGORIES.find((game) => game.value === gameValue);
};
