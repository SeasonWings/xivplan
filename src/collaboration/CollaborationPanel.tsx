import { Button, Input, Switch, makeStyles, shorthands, tokens } from '@fluentui/react-components';
import React, { useEffect, useRef, useState } from 'react';
import { useEditActivity } from '../EditActivityContext';
import { InfoField } from '../InfoField';
import { useCollaboration } from './CollaborationProvider';

const CollaborationPanel: React.FC = () => {
    const { startEditActivity } = useEditActivity();
    const {
        connected,
        userId,
        userName,
        roomId,
        connectedUsers,
        isHost,
        hostId, // 获取房主ID
        joinRoom,
        leaveRoom,
        changeUserName,
        sendChatMessage,
        transferHost,
        setUserEditPermission,
        chatMessages,
        // enableUpdateDelay,
        // setEnableUpdateDelay,
    } = useCollaboration();

    const [newMessage, setNewMessage] = useState('');
    const [newRoomId, setNewRoomId] = useState('');
    const [nameInput, setNameInput] = useState(userName);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 当userName变化时，同步更新nameInput
    useEffect(() => {
        setNameInput(userName);
    }, [userName]);

    // 自动滚动到最新消息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // 复制房间链接
    const copyRoomLink = () => {
        const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard
                .writeText(link)
                .then(() => {
                    alert('房间链接已复制到剪贴板');
                })
                .catch((err) => {
                    console.error('复制失败:', err);
                    fallbackCopyTextToClipboard(link);
                });
        } else {
            fallbackCopyTextToClipboard(link);
        }
    };

    // 备用复制方法
    const fallbackCopyTextToClipboard = (text: string) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            alert('房间链接已复制到剪贴板');
        } catch (err) {
            console.error('备用复制方法也失败了:', err);
            alert('复制失败，请手动复制链接');
        } finally {
            document.body.removeChild(textArea);
        }
    };

    // 创建新房间
    const createNewRoom = async () => {
        try {
            await joinRoom();
            setNewRoomId('');
        } catch {
            alert('创建房间失败，请检查服务器连接');
        }
    };

    // 加入指定房间
    const joinSpecifiedRoom = async () => {
        if (newRoomId.trim()) {
            try {
                await joinRoom(newRoomId.trim());
            } catch {
                alert('加入房间失败，请检查房间ID是否正确');
            }
        }
    };

    // 发送消息
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            sendChatMessage(newMessage);
            setNewMessage('');
        }
    };

    // 更新用户名
    const handleNameChange = () => {
        if (nameInput.trim()) {
            changeUserName(nameInput);
        } else {
            setNameInput(userName); // 恢复原始名称
        }
    };

    const classes = useStyles();

    return (
        <div className={classes.root}>
            {/* 连接状态 */}
            <div className={connected ? classes.statusConnected : classes.statusDisconnected}>
                <div className={connected ? classes.dotConnected : classes.dotDisconnected}></div>
                <span>{connected ? '已连接' : '连接中...'}</span>
            </div>

            {/* 用户信息 */}
            <div className={classes.section}>
                <div style={{ marginBottom: '8px' }}>
                    <InfoField label="用户名">
                        <div className={classes.row}>
                            <Input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameChange}
                                className={classes.input}
                            />
                        </div>
                    </InfoField>
                </div>
            </div>

            {/* 房间管理 */}
            <div className={classes.section}>
                {roomId ? (
                    <div>
                        <div style={{ marginBottom: '10px' }}>
                            <InfoField label="房间ID">
                                <div className={classes.row}>
                                    <Input type="text" value={roomId} readOnly className={classes.inputReadOnly} />
                                    <Button
                                        onClick={copyRoomLink}
                                        title="复制房间链接"
                                        data-tutorial="collaboration-copy-link"
                                    >
                                        复制
                                    </Button>
                                </div>
                            </InfoField>
                        </div>
                        <div className={classes.actionsRow}>
                            <Button
                                onClick={createNewRoom}
                                style={{ flex: 1 }}
                                data-tutorial="collaboration-create-room"
                            >
                                创建新房间
                            </Button>
                            <Button onClick={leaveRoom} style={{ flex: 1 }} data-tutorial="collaboration-leave-room">
                                离开房间
                            </Button>
                        </div>
                        <div className={classes.helperText}>{isHost ? '你是房间主机' : '你是房间访客'}</div>
                        {isHost && (
                            <div style={{ marginTop: '10px' }} data-tutorial="collaboration-host-functions">
                                <span className={classes.subtitle}>支持在用户列表独立编辑用户绘图权限</span>
                                <span className={classes.smallText}>
                                    开启后网络原因可能会导致操作不同步，请谨慎操作
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <InfoField label="输入房间ID加入">
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Input
                                    type="text"
                                    value={newRoomId}
                                    onChange={(e) => setNewRoomId(e.target.value)}
                                    placeholder="房间ID"
                                    style={{ flex: 1, marginRight: '5px' }}
                                />
                                <Button onClick={joinSpecifiedRoom}>加入</Button>
                            </div>
                        </InfoField>
                        <Button
                            onClick={createNewRoom}
                            style={{ width: '100%', marginTop: '10px' }}
                            data-tutorial="collaboration-create-room"
                        >
                            创建新房间
                        </Button>
                    </div>
                )}
            </div>

            {/* 在线用户 */}
            <div className={classes.section}>
                <InfoField label={`在线用户 (${connectedUsers.length})`}>
                    <div className={classes.userList} data-tutorial="collaboration-user-list">
                        {connectedUsers.map((user) => (
                            <div key={user.id} className={user.id === userName ? classes.userSelf : classes.userItem}>
                                <div className={classes.userRow}>
                                    <div className={classes.row}>
                                        {user.name}
                                        {user.id === userId && <span className={classes.tagSelf}>(你)</span>}
                                        {/* 显示房主标识，基于hostId判断 */}
                                        {hostId && user.id === hostId && (
                                            <span className={classes.tagHost}>(房主)</span>
                                        )}
                                        {/* 显示编辑权限标识 */}
                                        {user.canEdit && user.id !== hostId && (
                                            <span className={classes.tagEdit}>(可编辑)</span>
                                        )}
                                    </div>
                                    <div className={classes.userActions}>
                                        {/* 编辑权限开关 - 只有房主可以控制，房主始终有编辑权限 */}
                                        {isHost && user.id !== userId && (
                                            <div className={classes.switchWrapper}>
                                                <Switch
                                                    checked={user.canEdit || false}
                                                    onChange={(event) => {
                                                        setUserEditPermission(user.id, event.target.checked);
                                                        // 触发场景更新
                                                        startEditActivity();
                                                    }}
                                                    aria-label={`设置${user.name}的编辑权限`}
                                                    data-tutorial="collaboration-edit-switch"
                                                />
                                            </div>
                                        )}
                                        {/* 只有当前用户是房主，并且不是自己时才显示移交按钮 */}
                                        {isHost && user.id !== userId && (
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    if (window.confirm(`确定要将房主权限移交给 ${user.name} 吗？`)) {
                                                        transferHost(user.id);
                                                    }
                                                }}
                                                className={classes.transferButton}
                                                data-tutorial="collaboration-transfer-host"
                                            >
                                                移交房主
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </InfoField>
            </div>

            {/* 聊天区域 */}
            <div className={classes.chatWrapper} data-tutorial="collaboration-chat">
                <div className={classes.chatHeader}>聊天</div>
                <div className={classes.chatMessages}>
                    {chatMessages.length === 0 ? (
                        <div className={classes.empty}>暂无消息</div>
                    ) : (
                        chatMessages.map((msg, index) => (
                            <div key={index} style={{ marginBottom: '10px' }}>
                                <div className={classes.messageMeta}>
                                    {msg.userName} {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                                <div style={{ fontSize: '14px', wordBreak: 'break-word' }}>{msg.message}</div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className={classes.chatForm}>
                    <div className={classes.row}>
                        <Input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="输入消息..."
                            className={classes.input}
                            disabled={!roomId}
                        />
                        <Button
                            type="submit"
                            disabled={!roomId || !newMessage.trim()}
                            data-tutorial="collaboration-send-message"
                        >
                            发送
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CollaborationPanel;

const useStyles = makeStyles({
    root: {
        width: '380px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: tokens.colorNeutralBackground2,
        boxShadow: tokens.shadow16,
        ...shorthands.borderLeft('1px', 'solid', tokens.colorNeutralStroke1),
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    statusConnected: {
        padding: tokens.spacingHorizontalS,
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground3,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    statusDisconnected: {
        padding: tokens.spacingHorizontalS,
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground2,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    dotConnected: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#52c41a',
    },
    dotDisconnected: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: '#faad14',
    },
    section: {
        padding: tokens.spacingHorizontalS,
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground1,
    },
    input: {
        flex: 1,
    },
    inputReadOnly: {
        flex: 1,
    },
    actionsRow: {
        display: 'flex',
        gap: tokens.spacingHorizontalXS,
    },
    helperText: {
        marginTop: '5px',
        fontSize: '12px',
        color: tokens.colorNeutralForeground3,
    },
    subtitle: {
        fontSize: '14px',
        marginBottom: '5px',
        display: 'block',
    },
    smallText: {
        fontSize: '11px',
        color: tokens.colorNeutralForeground3,
    },
    userList: {
        maxHeight: '200px',
        overflowY: 'auto',
        fontSize: '14px',
    },
    userItem: {
        padding: '5px',
        marginBottom: '3px',
        borderRadius: tokens.borderRadiusSmall,
        backgroundColor: tokens.colorNeutralBackground2,
    },
    userSelf: {
        padding: '5px',
        marginBottom: '3px',
        borderRadius: tokens.borderRadiusSmall,
        backgroundColor: tokens.colorNeutralBackground3,
    },
    userRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tagSelf: {
        color: tokens.colorBrandForeground1,
        marginLeft: '5px',
    },
    tagHost: {
        color: '#52c41a',
        marginLeft: '5px',
        fontSize: '12px',
    },
    tagEdit: {
        color: '#722ed1',
        marginLeft: '5px',
        fontSize: '12px',
    },
    userActions: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        marginLeft: 'auto',
    },
    switchWrapper: {
        padding: '2px',
    },
    transferButton: {
        fontSize: '12px',
        padding: '2px 8px',
        minWidth: '50px',
    },
    chatWrapper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    chatHeader: {
        padding: '10px 10px 0 10px',
        fontSize: '14px',
        fontWeight: 600,
    },
    chatMessages: {
        flex: 1,
        padding: tokens.spacingHorizontalS,
        overflowY: 'auto',
        backgroundColor: tokens.colorNeutralBackground1,
    },
    empty: {
        color: tokens.colorNeutralForeground3,
        textAlign: 'center',
        padding: '20px',
    },
    messageMeta: {
        fontSize: '12px',
        color: tokens.colorNeutralForeground3,
        marginBottom: '2px',
    },
    chatForm: {
        padding: tokens.spacingHorizontalS,
        ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground1,
    },
});
