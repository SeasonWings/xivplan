import { Field, Select } from '@fluentui/react-components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GAME_CATEGORIES, getGameByCategory } from './categoryConfig';

interface CategorySelectorProps {
    value: string;
    onChange: (category: string) => void;
    gameLabel?: string;
    categoryLabel?: string;
    required?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    value,
    onChange,
    gameLabel,
    categoryLabel,
    required = false,
}) => {
    const { t } = useTranslation();

    // 根据当前分类值确定所属游戏
    const currentGame = getGameByCategory(value);
    const [selectedGame, setSelectedGame] = useState(currentGame?.value || 'ff14');

    // 当外部value变化时,同步更新selectedGame
    useEffect(() => {
        const game = getGameByCategory(value);
        if (game && game.value !== selectedGame) {
            // 使用 setTimeout 避免在 effect 中同步调用 setState 导致的警告
            const timer = setTimeout(() => {
                setSelectedGame(game.value);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [value, selectedGame]);

    const handleGameChange = (gameValue: string) => {
        setSelectedGame(gameValue);
        // 自动选择该游戏的第一个子分类
        const gameCategory = GAME_CATEGORIES.find((g) => g.value === gameValue);
        if (gameCategory && gameCategory.children.length > 0 && gameCategory.children[0]) {
            onChange(gameCategory.children[0].value);
        }
    };

    return (
        <>
            <Field label={gameLabel || t('community.upload.game', '游戏')} required={required}>
                <Select value={selectedGame} onChange={(e, data) => handleGameChange(data.value)}>
                    {GAME_CATEGORIES.map((game) => (
                        <option key={game.value} value={game.value}>
                            {game.label}
                        </option>
                    ))}
                </Select>
            </Field>

            <Field label={categoryLabel || t('community.upload.category', '分类')} required={required}>
                <Select value={value} onChange={(e, data) => onChange(data.value)}>
                    {GAME_CATEGORIES.find((g) => g.value === selectedGame)?.children.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                            {cat.label}
                        </option>
                    ))}
                </Select>
            </Field>
        </>
    );
};
