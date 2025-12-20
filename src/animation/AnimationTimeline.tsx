import { Button, makeStyles, Slider, tokens, Tooltip } from '@fluentui/react-components';
import { Pause24Regular, Play24Regular, Stop24Regular } from '@fluentui/react-icons';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from './AnimationContext';
import { PlaybackState } from './animationTypes';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackground1,
        borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        gap: tokens.spacingHorizontalM,
    },
    playbackButtons: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
    },
    timeDisplay: {
        fontFamily: tokens.fontFamilyMonospace,
        fontSize: tokens.fontSizeBase300,
        color: tokens.colorNeutralForeground2,
        minWidth: '120px',
    },
    sliderContainer: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        color: '#FFFFFF',
        gap: tokens.spacingHorizontalM,
    },
    speedControl: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        minWidth: '100px',
    },
    label: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
});

export const AnimationTimeline: React.FC = () => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { animation, playerState, play, pause, stop, seekTo, setPlaybackSpeed } = useAnimation();

    const handleSliderChange = useCallback(
        (_: unknown, data: { value: number }) => {
            seekTo(data.value);
        },
        [seekTo],
    );

    const handleSpeedChange = useCallback(
        (_: unknown, data: { value: number }) => {
            setPlaybackSpeed(data.value);
        },
        [setPlaybackSpeed],
    );

    const formatTime = (milliseconds: number): string => {
        const seconds = Math.floor(milliseconds / 1000);
        const ms = Math.floor(milliseconds % 1000);
        return `${seconds}.${ms.toString().padStart(3, '0')}s`;
    };

    if (!animation) {
        return null;
    }

    const isPlaying = playerState.state === PlaybackState.Playing;

    return (
        <div className={classes.container} data-tutorial="animation-timeline">
            <div className={classes.controls}>
                {/* 播放控制按钮 */}
                <div className={classes.playbackButtons}>
                    <Tooltip content={t('animation.play', '播放')} relationship="label">
                        <Button icon={<Play24Regular />} onClick={play} disabled={isPlaying} appearance="subtle" />
                    </Tooltip>
                    <Tooltip content={t('animation.pause', '暂停')} relationship="label">
                        <Button icon={<Pause24Regular />} onClick={pause} disabled={!isPlaying} appearance="subtle" />
                    </Tooltip>
                    <Tooltip content={t('animation.stop', '停止')} relationship="label">
                        <Button
                            icon={<Stop24Regular />}
                            onClick={stop}
                            disabled={playerState.state === PlaybackState.Stopped}
                            appearance="subtle"
                        />
                    </Tooltip>
                </div>

                {/* 时间显示 */}
                <div className={classes.timeDisplay}>
                    {formatTime(playerState.currentTime)} / {formatTime(animation.duration)}
                </div>

                {/* 进度条 */}
                <div className={classes.sliderContainer}>
                    <Slider
                        value={playerState.currentTime}
                        min={0}
                        max={animation.duration}
                        onChange={handleSliderChange}
                    />
                </div>

                {/* 速度控制 */}
                <div className={classes.speedControl} data-tutorial="animation-speed-control">
                    <span className={classes.label}>
                        {t('animation.speed', '速度')}: {playerState.playbackSpeed.toFixed(1)}x
                    </span>
                    <Slider
                        value={playerState.playbackSpeed}
                        min={0.5}
                        max={3.0}
                        step={0.5}
                        onChange={handleSpeedChange}
                        style={{ width: '80px' }}
                    />
                </div>
            </div>
        </div>
    );
};
