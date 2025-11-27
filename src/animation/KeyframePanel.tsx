import {
    Button,
    Input,
    makeStyles,
    Menu,
    MenuItem,
    MenuList,
    MenuPopover,
    MenuTrigger,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import {
    Add24Regular,
    Delete24Regular,
    // Edit24Regular,
    MoreVertical24Regular,
} from '@fluentui/react-icons';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnimation } from './AnimationContext';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        gap: tokens.spacingVerticalM,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: tokens.spacingVerticalM,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    title: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
    },
    toolbar: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
    },
    content: {
        flex: 1,
        overflowY: 'auto',
        padding: tokens.spacingVerticalM,
    },
    noSelection: {
        textAlign: 'center',
        color: tokens.colorNeutralForeground3,
        padding: tokens.spacingVerticalXXL,
    },
    timeInput: {
        width: '100px',
    },
    trackHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: tokens.spacingVerticalS,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        marginBottom: tokens.spacingVerticalS,
    },
    trackTitle: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
    },
    keyframeList: {
        marginLeft: tokens.spacingHorizontalL,
    },
});

interface KeyframeRowData {
    id: string;
    time: number;
    name?: string;
    objectCount: number;
}

export const KeyframePanel: React.FC = () => {
    const classes = useStyles();
    const { t } = useTranslation();
    const { animation, addKeyframe, removeKeyframe, updateKeyframeName, updateKeyframeTime, jumpToKeyframe } =
        useAnimation();
    const [newKeyframeTime] = useState<string>('0');
    const [keyframeName, setKeyframeName] = useState<string>('');
    const [editingRowId, setEditingRowId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');
    const [editingTimeRowId, setEditingTimeRowId] = useState<string | null>(null);
    const [editingTime, setEditingTime] = useState<string>('');

    const handleAddKeyframe = useCallback(() => {
        const time = parseFloat(newKeyframeTime);
        if (isNaN(time) || time < 0) {
            return;
        }

        addKeyframe(time, keyframeName || undefined);
        setKeyframeName(''); // 清空名称输入
    }, [newKeyframeTime, keyframeName, addKeyframe]);

    const handleRemoveKeyframe = useCallback(
        (time: number, name: string | undefined, objectCount: number) => {
            // 删除前自动跳转到该帧,让用户看到删除的是哪一帧
            jumpToKeyframe(time);
            // 稍微延迟后删除,让跳转效果可见
            setTimeout(() => {
                removeKeyframe(time, name, objectCount);
            }, 100);
        },
        [removeKeyframe, jumpToKeyframe],
    );

    const handleJumpToKeyframe = useCallback(
        (time: number) => {
            jumpToKeyframe(time);
        },
        [jumpToKeyframe],
    );

    const handleStartEdit = useCallback((rowId: string, currentName: string | undefined) => {
        setEditingRowId(rowId);
        setEditingName(currentName || '');
    }, []);

    const handleSaveEdit = useCallback(
        (time: number, oldName: string | undefined) => {
            if (editingName.trim()) {
                updateKeyframeName(time, oldName, editingName.trim());
            }
            setEditingRowId(null);
            setEditingName('');
        },
        [editingName, updateKeyframeName],
    );

    const handleCancelEdit = useCallback(() => {
        setEditingRowId(null);
        setEditingName('');
    }, []);

    const handleStartTimeEdit = useCallback((rowId: string, currentTime: number) => {
        setEditingTimeRowId(rowId);
        setEditingTime(currentTime.toString());
    }, []);

    const handleSaveTimeEdit = useCallback(
        (oldTime: number, name: string | undefined) => {
            const newTime = parseFloat(editingTime);
            if (!isNaN(newTime) && newTime >= 0) {
                updateKeyframeTime(oldTime, name, newTime);
            }
            setEditingTimeRowId(null);
            setEditingTime('');
        },
        [editingTime, updateKeyframeTime],
    );

    const handleCancelTimeEdit = useCallback(() => {
        setEditingTimeRowId(null);
        setEditingTime('');
    }, []);

    const getKeyframeRows = (): KeyframeRowData[] => {
        if (!animation) {
            return [];
        }
        return animation.keyframes.map((kf, index) => ({
            id: `keyframe-${index}`,
            time: kf.time,
            name: kf.name,
            objectCount: kf.objects.length,
        }));
    };

    const columns = [
        { columnKey: 'time', label: t('animation.time', '时间 (ms)') },
        { columnKey: 'name', label: t('animation.keyframeName', '名称') },
        { columnKey: 'objectCount', label: t('animation.objectCount', '对象数量') },
        { columnKey: 'actions', label: t('animation.actions', '操作') },
    ];

    const rows = getKeyframeRows();

    return (
        <div className={classes.container}>
            <div className={classes.header}>
                <div className={classes.title}>
                    {t('animation.keyframes', '关键帧')} ({rows.length} {t('animation.frames', '帧')})
                </div>
                <div className={classes.toolbar}>
                    {/*<Input*/}
                    {/*    type="text"*/}
                    {/*    value={keyframeName}*/}
                    {/*    onChange={(e, data) => setKeyframeName(data.value)}*/}
                    {/*    placeholder={t('animation.keyframeNamePlaceholder', '帧名称 (可选)')}*/}
                    {/*    className={classes.timeInput}*/}
                    {/*/>*/}
                    {/*<Input*/}
                    {/*    type="number"*/}
                    {/*    value={newKeyframeTime}*/}
                    {/*    onChange={(e, data) => setNewKeyframeTime(data.value)}*/}
                    {/*    placeholder={t('animation.timeMs', '时间 (ms)')}*/}
                    {/*    className={classes.timeInput}*/}
                    {/*/>*/}
                    <Tooltip content={t('animation.addKeyframe', '添加关键帧')} relationship="label">
                        <Button icon={<Add24Regular />} onClick={handleAddKeyframe} appearance="primary" />
                    </Tooltip>
                </div>
            </div>

            <div className={classes.content}>
                {rows.length > 0 ? (
                    <Table size="small">
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHeaderCell key={col.columnKey}>{col.label}</TableHeaderCell>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        {editingTimeRowId === row.id ? (
                                            <Input
                                                type="number"
                                                value={editingTime}
                                                onChange={(e, data) => setEditingTime(data.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveTimeEdit(row.time, row.name);
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelTimeEdit();
                                                    }
                                                }}
                                                onBlur={() => handleSaveTimeEdit(row.time, row.name)}
                                                autoFocus
                                                size="small"
                                                style={{ width: '100%' }}
                                            />
                                        ) : (
                                            <span
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleStartTimeEdit(row.id, row.time)}
                                            >
                                                {row.time}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingRowId === row.id ? (
                                            <Input
                                                value={editingName}
                                                onChange={(e, data) => setEditingName(data.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveEdit(row.time, row.name);
                                                    } else if (e.key === 'Escape') {
                                                        handleCancelEdit();
                                                    }
                                                }}
                                                onBlur={() => handleSaveEdit(row.time, row.name)}
                                                autoFocus
                                                size="small"
                                                style={{ width: '100%' }}
                                            />
                                        ) : (
                                            <span
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleStartEdit(row.id, row.name)}
                                            >
                                                {row.name || '-'}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{row.objectCount}</TableCell>
                                    <TableCell>
                                        <Menu>
                                            <MenuTrigger disableButtonEnhancement>
                                                <Button
                                                    icon={<MoreVertical24Regular />}
                                                    appearance="subtle"
                                                    size="small"
                                                />
                                            </MenuTrigger>
                                            <MenuPopover>
                                                <MenuList>
                                                    <MenuItem onClick={() => handleJumpToKeyframe(row.time)}>
                                                        {t('animation.seekTo', '跳转到此帧')}
                                                    </MenuItem>
                                                    {/*<MenuItem*/}
                                                    {/*    onClick={() => handleStartEdit(row.id, row.name)}*/}
                                                    {/*    icon={<Edit24Regular />}*/}
                                                    {/*>*/}
                                                    {/*    {t('animation.rename', '重命名')}*/}
                                                    {/*</MenuItem>*/}
                                                    <MenuItem
                                                        onClick={() =>
                                                            handleRemoveKeyframe(row.time, row.name, row.objectCount)
                                                        }
                                                        icon={<Delete24Regular />}
                                                    >
                                                        {t('animation.delete', '删除')}
                                                    </MenuItem>
                                                </MenuList>
                                            </MenuPopover>
                                        </Menu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className={classes.noSelection}>
                        {t('animation.noKeyframes', '暂无关键帧，点击上方按钮添加')}
                    </div>
                )}
            </div>
        </div>
    );
};
