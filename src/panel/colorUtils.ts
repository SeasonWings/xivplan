// 动态生成颜色的辅助函数
export function getDynamicColor(seed: number | string): { background: string; color: string; border: string } {
    const strSeed = String(seed);
    let hash = 0;
    for (let i = 0; i < strSeed.length; i++) {
        hash = (hash << 5) - hash + strSeed.charCodeAt(i);
        hash = hash & hash;
    }

    // 生成 HSL 颜色
    const hue = Math.abs(hash) % 360;
    // 使用较低的饱和度和较高的亮度作为背景，确保文字对比度
    const bgLightness = 92; // 浅色背景
    const textLightness = 25; // 深色文字
    const borderLightness = 80; // 边框亮度

    return {
        background: `hsl(${hue}, 70%, ${bgLightness}%)`,
        color: `hsl(${hue}, 80%, ${textLightness}%)`,
        border: `hsl(${hue}, 60%, ${borderLightness}%)`,
    };
}
