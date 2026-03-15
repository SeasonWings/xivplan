import {
    Avatar,
    Button,
    Field,
    Input,
    Switch,
    Tab,
    TabList,
    Textarea,
    makeStyles,
    shorthands,
    tokens,
} from '@fluentui/react-components';
import { Send20Regular } from '@fluentui/react-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditActivity } from '../EditActivityContext';
import { TabActivity } from '../TabActivity';
import { useCollaboration } from './CollaborationProvider';
import { ensureRoomKeyInUrl } from './cursor/cursorCrypto';

type Tabs = 'room' | 'users' | 'chat';

function formatUnreadCount(n: number) {
    if (n <= 0) return '';
    if (n > 99) return '99+';
    return String(n);
}

const CollaborationPanel: React.FC = () => {
    const { startEditActivity } = useEditActivity();
    const {
        userId,
        userName,
        roomId,
        connectedUsers,
        isHost,
        hostId,
        joinRoom,
        leaveRoom,
        changeUserName,
        sendChatMessage,
        transferHost,
        setUserEditPermission,
        unreadChatCount,
        markChatRead,
        setChatTabActive,
        chatMessages,
    } = useCollaboration();

    const classes = useStyles();
    const [tab, setTab] = useState<Tabs>('room');
    const [newMessage, setNewMessage] = useState('');
    const [newRoomId, setNewRoomId] = useState('');
    const [nameInput, setNameInput] = useState(userName);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setNameInput(userName);
    }, [userName]);

    useEffect(() => {
        localStorage.setItem('xivplan_cursor_share_mask', '1');
    }, []);

    useEffect(() => {
        const active = tab === 'chat';
        setChatTabActive(active);
        if (active) {
            markChatRead();
        }
    }, [markChatRead, setChatTabActive, tab]);

    useEffect(() => {
        return () => {
            setChatTabActive(false);
        };
    }, [setChatTabActive]);

    useEffect(() => {
        if (tab !== 'chat') return;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, tab]);

    const roomLink = useMemo(() => {
        if (!roomId) return '';
        ensureRoomKeyInUrl();
        return `${window.location.origin}${window.location.pathname}?room=${roomId}${window.location.hash}`;
    }, [roomId]);

    const copyRoomLink = async () => {
        if (!roomId) return;
        const link = roomLink;
        if (!link) return;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(link);
                return;
            } catch (err) {
                void err;
            }
        }

        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } finally {
            document.body.removeChild(textArea);
        }
    };

    const createNewRoom = async () => {
        await joinRoom();
        setNewRoomId('');
        setTab('room');
    };

    const joinSpecifiedRoom = async () => {
        const id = newRoomId.trim();
        if (!id) return;
        await joinRoom(id);
        setTab('room');
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const msg = newMessage.trim();
        if (!msg) return;
        sendChatMessage(msg);
        setNewMessage('');
    };

    const handleNameCommit = () => {
        const next = nameInput.trim();
        if (next) {
            changeUserName(next);
        } else {
            setNameInput(userName);
        }
    };

    return (
        <div className={classes.root}>
            <TabList selectedValue={tab} onTabSelect={(ev, data) => setTab(data.value as Tabs)}>
                <Tab value="room">房间</Tab>
                <Tab value="users">用户</Tab>
                <Tab value="chat">
                    <span className={classes.chatTabLabel}>
                        聊天
                        {unreadChatCount > 0 && (
                            <span className={classes.unreadBadge}>{formatUnreadCount(unreadChatCount)}</span>
                        )}
                    </span>
                </Tab>
            </TabList>

            <div className={classes.body}>
                <TabActivity value="room" activeTab={tab}>
                    <div className={classes.tab}>
                        <Field label="用户名">
                            <Input
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameCommit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                            />
                        </Field>

                        {roomId ? (
                            <>
                                <Field label="房间">
                                    <div className={classes.row}>
                                        <Input value={roomId} readOnly />
                                        <Button onClick={copyRoomLink} data-tutorial="collaboration-copy-link">
                                            复制链接
                                        </Button>
                                    </div>
                                </Field>

                                <div className={classes.row}>
                                    <Button
                                        onClick={createNewRoom}
                                        style={{ flex: 1 }}
                                        data-tutorial="collaboration-create-room"
                                    >
                                        创建新房间
                                    </Button>
                                    <Button
                                        onClick={leaveRoom}
                                        style={{ flex: 1 }}
                                        data-tutorial="collaboration-leave-room"
                                    >
                                        离开房间
                                    </Button>
                                </div>

                                <div className={classes.hint}>{isHost ? '你是房主' : '你是访客'}</div>
                                {isHost && (
                                    <div className={classes.hostHint} data-tutorial="collaboration-host-functions">
                                        <div className={classes.hostTitle}>房主可管理用户编辑权限</div>
                                        <div className={classes.hostSub}>网络原因可能导致操作不同步，建议谨慎操作</div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <Field label="加入房间">
                                    <div className={classes.row}>
                                        <Input
                                            value={newRoomId}
                                            onChange={(e) => setNewRoomId(e.target.value)}
                                            placeholder="房间ID"
                                        />
                                        <Button onClick={joinSpecifiedRoom}>加入</Button>
                                    </div>
                                </Field>
                                <Button onClick={createNewRoom} data-tutorial="collaboration-create-room">
                                    创建新房间
                                </Button>
                            </>
                        )}
                    </div>
                </TabActivity>

                <TabActivity value="users" activeTab={tab}>
                    <div className={classes.tab}>
                        <div className={classes.sectionTitle} data-tutorial="collaboration-user-list">
                            在线用户（{connectedUsers.length}）
                        </div>
                        <div className={classes.userList}>
                            {connectedUsers.map((u) => {
                                const isSelf = u.id === userId;
                                const isRoomHost = hostId && u.id === hostId;
                                const canEdit = u.canEdit || false;
                                return (
                                    <div key={u.id} className={classes.userItem}>
                                        <div className={classes.userTop}>
                                            <div className={classes.userNameRow}>
                                                <Avatar
                                                    name={u.name}
                                                    size={24}
                                                    image={u.avatar ? { src: u.avatar } : undefined}
                                                />
                                                <span className={classes.userName}>{u.name}</span>
                                                {isSelf && <span className={classes.tag}>(你)</span>}
                                                {isRoomHost && <span className={classes.tagHost}>(房主)</span>}
                                                {canEdit && !isRoomHost && (
                                                    <span className={classes.tagEdit}>(可编辑)</span>
                                                )}
                                            </div>
                                            {isHost && !isSelf && (
                                                <div className={classes.userControls}>
                                                    <Switch
                                                        checked={canEdit}
                                                        onChange={(event) => {
                                                            setUserEditPermission(u.id, event.target.checked);
                                                            startEditActivity();
                                                        }}
                                                        aria-label={`设置${u.name}的编辑权限`}
                                                        data-tutorial="collaboration-edit-switch"
                                                    />
                                                </div>
                                            )}
                                            {isHost && !isSelf && (
                                                <div className={classes.userBottom}>
                                                    <Button
                                                        size="small"
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(`确定要将房主权限移交给 ${u.name} 吗？`)
                                                            ) {
                                                                transferHost(u.id);
                                                            }
                                                        }}
                                                        data-tutorial="collaboration-transfer-host"
                                                    >
                                                        移交房主
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </TabActivity>

                <TabActivity value="chat" activeTab={tab}>
                    <div className={classes.chatTab} data-tutorial="collaboration-chat">
                        <div className={classes.chatMessages}>
                            {chatMessages.length === 0 ? (
                                <div className={classes.empty}>暂无消息</div>
                            ) : (
                                chatMessages.map((msg, index) => {
                                    const isSelf = msg.userId === userId;
                                    const prev = chatMessages[index - 1];
                                    const showHeader =
                                        !prev ||
                                        prev.userId !== msg.userId ||
                                        Math.abs(msg.timestamp - prev.timestamp) > 2 * 60 * 1000;
                                    const time = new Date(msg.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    });
                                    const showAvatar = !isSelf && showHeader;
                                    return (
                                        <div
                                            key={index}
                                            className={isSelf ? classes.messageRowSelf : classes.messageRowOther}
                                        >
                                            {!isSelf && (
                                                <div className={classes.avatarSlot}>
                                                    {showAvatar ? (
                                                        <Avatar
                                                            name={msg.userName}
                                                            size={28}
                                                            image={msg.userAvatar ? { src: msg.userAvatar } : undefined}
                                                        />
                                                    ) : (
                                                        <div className={classes.avatarPlaceholder} />
                                                    )}
                                                </div>
                                            )}

                                            <div className={classes.messageCol}>
                                                {!isSelf && showHeader && (
                                                    <div className={classes.metaRow}>
                                                        <span className={classes.metaName}>{msg.userName}</span>
                                                        <span className={classes.metaTime}>{time}</span>
                                                    </div>
                                                )}

                                                <div className={isSelf ? classes.bubbleSelf : classes.bubbleOther}>
                                                    {msg.message}
                                                </div>

                                                {isSelf && showHeader && <div className={classes.selfTime}>{time}</div>}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className={classes.chatForm}>
                            <Textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={roomId ? '输入消息…' : '加入房间后可聊天'}
                                disabled={!roomId}
                                resize="none"
                                rows={2}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                className={classes.chatInput}
                            />
                            <Button
                                type="submit"
                                appearance="primary"
                                icon={<Send20Regular />}
                                disabled={!roomId || !newMessage.trim()}
                                data-tutorial="collaboration-send-message"
                            >
                                发送
                            </Button>
                        </form>
                    </div>
                </TabActivity>
            </div>
        </div>
    );
};

export default CollaborationPanel;

const useStyles = makeStyles({
    root: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    body: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
    },
    tab: {
        height: '100%',
        overflowY: 'auto',
        padding: tokens.spacingHorizontalM,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    hint: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    hostHint: {
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    hostTitle: {
        fontWeight: tokens.fontWeightSemibold,
    },
    hostSub: {
        marginTop: tokens.spacingVerticalXS,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    sectionTitle: {
        fontWeight: tokens.fontWeightSemibold,
    },
    userList: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    userItem: {
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    },
    userTop: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacingHorizontalS,
    },
    userNameRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        minWidth: 0,
        flex: 1,
    },
    userName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    tag: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    tagHost: {
        color: '#52c41a',
        fontSize: tokens.fontSizeBase200,
    },
    tagEdit: {
        color: '#722ed1',
        fontSize: tokens.fontSizeBase200,
    },
    userControls: {
        flexShrink: 0,
    },
    userBottom: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    chatTab: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    },
    chatMessages: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorNeutralBackground2,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
    },
    empty: {
        color: tokens.colorNeutralForeground3,
        textAlign: 'center',
        paddingTop: tokens.spacingVerticalXXL,
    },
    messageRowOther: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: tokens.spacingHorizontalS,
    },
    messageRowSelf: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    avatarSlot: {
        width: '28px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    avatarPlaceholder: {
        width: '28px',
        height: '28px',
    },
    messageCol: {
        maxWidth: '78%',
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXXS,
        minWidth: 0,
    },
    metaRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: tokens.spacingHorizontalS,
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
        minWidth: 0,
    },
    metaName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    metaTime: {
        whiteSpace: 'nowrap',
    },
    bubbleOther: {
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderRadius(tokens.borderRadiusLarge),
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        fontSize: tokens.fontSizeBase300,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        alignSelf: 'flex-start',
    },
    bubbleSelf: {
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        ...shorthands.borderRadius(tokens.borderRadiusLarge),
        fontSize: tokens.fontSizeBase300,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        alignSelf: 'flex-end',
    },
    selfTime: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        alignSelf: 'flex-end',
        whiteSpace: 'nowrap',
    },
    chatForm: {
        flexShrink: 0,
        padding: tokens.spacingHorizontalM,
        ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke1),
        backgroundColor: tokens.colorNeutralBackground1,
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        alignItems: 'flex-end',
    },
    chatInput: {
        flex: 1,
        height: '32px',
    },
    chatTabLabel: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    unreadBadge: {
        height: '18px',
        minWidth: '18px',
        paddingLeft: '6px',
        paddingRight: '6px',
        borderRadius: '999px',
        backgroundColor: tokens.colorPaletteRedBorderActive,
        color: tokens.colorNeutralForegroundInverted,
        fontSize: tokens.fontSizeBase100,
        lineHeight: '18px',
        textAlign: 'center',
    },
});
