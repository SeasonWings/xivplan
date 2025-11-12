import { Button, Input, Switch } from '@fluentui/react-components';
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
        } catch (error) {
            alert('创建房间失败，请检查服务器连接');
        }
    };

    // 加入指定房间
    const joinSpecifiedRoom = async () => {
        if (newRoomId.trim()) {
            try {
                await joinRoom(newRoomId.trim());
            } catch (error) {
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

    return (
        <div
            className="collaboration-panel"
            style={{
                width: '380px',
                height: '100%',
                borderRight: '1px solid #ccc',
                backgroundColor: '#f5f5f5',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* 连接状态 */}
            <div
                style={{
                    padding: '10px',
                    borderBottom: '1px solid #ccc',
                    backgroundColor: connected ? '#e6f7ff' : '#fff2e8',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <div
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: connected ? '#52c41a' : '#faad14',
                        marginRight: '8px',
                    }}
                ></div>
                <span>{connected ? '已连接' : '连接中...'}</span>
            </div>

            {/* 用户信息 */}
            <div
                style={{
                    padding: '10px',
                    borderBottom: '1px solid #ccc',
                    backgroundColor: '#fff',
                }}
            >
                <div style={{ marginBottom: '8px' }}>
                    <InfoField label="用户名">
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameChange}
                                style={{ flex: 1, marginRight: '5px' }}
                            />
                        </div>
                    </InfoField>
                </div>
            </div>

            {/* 房间管理 */}
            <div
                style={{
                    padding: '10px',
                    borderBottom: '1px solid #ccc',
                    backgroundColor: '#fff',
                }}
            >
                {roomId ? (
                    <div>
                        <div style={{ marginBottom: '10px' }}>
                            <InfoField label="房间ID">
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Input
                                        type="text"
                                        value={roomId}
                                        readOnly
                                        style={{ flex: 1, marginRight: '5px', backgroundColor: '#f5f5f5' }}
                                    />
                                    <Button onClick={copyRoomLink} title="复制房间链接">
                                        复制
                                    </Button>
                                </div>
                            </InfoField>
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <Button onClick={createNewRoom} style={{ flex: 1 }}>
                                创建新房间
                            </Button>
                            <Button onClick={leaveRoom} style={{ flex: 1 }}>
                                离开房间
                            </Button>
                        </div>
                        <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                            {isHost ? '你是房间主机' : '你是房间访客'}
                        </div>
                        {isHost && (
                            <div style={{ marginTop: '10px' }}>
                                <span style={{ fontSize: '14px', marginBottom: '5px', display: 'block' }}>
                                    支持在用户列表独立编辑用户绘图权限
                                </span>
                                <span style={{ fontSize: '11px', color: '#666' }}>
                                    开启后网络原因可能会导致操作不同步，请谨慎操作
                                </span>

                                {/* 更新延时控制 */}
                                {/* <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '14px' }}>启用场景更新延时</span>
                                        <Switch 
                                            checked={enableUpdateDelay} 
                                            onChange={(event) => {
                                                setEnableUpdateDelay(event.target.checked);
                                            }} 
                                            aria-label="启用场景更新延时"
                                            style={{ 
                                                cursor: 'pointer',
                                                width: '44px',
                                                height: '24px'
                                            }}
                                        />
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#666' }}>
                                        {enableUpdateDelay ? '已开启 - 场景更新将延迟1秒发送' : '未开启 - 场景更新将立即发送'}
                                    </span>
                                </div> */}
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
                        <Button onClick={createNewRoom} style={{ width: '100%', marginTop: '10px' }}>
                            创建新房间
                        </Button>
                    </div>
                )}
            </div>

            {/* 在线用户 */}
            <div
                style={{
                    padding: '10px',
                    borderBottom: '1px solid #ccc',
                    backgroundColor: '#fff',
                }}
            >
                <InfoField label={`在线用户 (${connectedUsers.length})`}>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '14px' }}>
                        {connectedUsers.map((user) => (
                            <div
                                key={user.id}
                                style={{
                                    padding: '5px',
                                    marginBottom: '3px',
                                    borderRadius: '3px',
                                    backgroundColor: user.id === userName ? '#e6f7ff' : '#f5f5f5',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        {user.name}
                                        {user.id === userId && (
                                            <span style={{ color: '#1890ff', marginLeft: '5px' }}>(你)</span>
                                        )}
                                        {/* 显示房主标识，基于hostId判断 */}
                                        {hostId && user.id === hostId && (
                                            <span style={{ color: '#52c41a', marginLeft: '5px', fontSize: '12px' }}>
                                                (房主)
                                            </span>
                                        )}
                                        {/* 显示编辑权限标识 */}
                                        {user.canEdit && user.id !== hostId && (
                                            <span style={{ color: '#722ed1', marginLeft: '5px', fontSize: '12px' }}>
                                                (可编辑)
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            marginLeft: 'auto',
                                        }}
                                    >
                                        {/* 编辑权限开关 - 只有房主可以控制，房主始终有编辑权限 */}
                                        {isHost && user.id !== userId && (
                                            <div style={{ padding: '2px' }}>
                                                <Switch
                                                    checked={user.canEdit || false}
                                                    onChange={(event) => {
                                                        console.log(
                                                            `设置用户编辑权限: userId=${user.id}, canEdit=${event.target.checked}`,
                                                        );
                                                        setUserEditPermission(user.id, event.target.checked);
                                                        // 触发场景更新
                                                        startEditActivity();
                                                    }}
                                                    aria-label={`设置${user.name}的编辑权限`}
                                                    style={{
                                                        cursor: 'pointer',
                                                        width: '44px',
                                                        height: '24px',
                                                    }}
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
                                                style={{ fontSize: '12px', padding: '2px 8px', minWidth: '50px' }}
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 10px 0 10px', fontSize: '14px', fontWeight: 'bold' }}>聊天</div>
                <div
                    style={{
                        flex: 1,
                        padding: '10px',
                        overflowY: 'auto',
                        backgroundColor: '#fff',
                    }}
                >
                    {chatMessages.length === 0 ? (
                        <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>暂无消息</div>
                    ) : (
                        chatMessages.map((msg, index) => (
                            <div key={index} style={{ marginBottom: '10px' }}>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                                    {msg.userName} {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                                <div style={{ fontSize: '14px', wordBreak: 'break-word' }}>{msg.message}</div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <form
                    onSubmit={handleSendMessage}
                    style={{
                        padding: '10px',
                        borderTop: '1px solid #ccc',
                        backgroundColor: '#fff',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="输入消息..."
                            style={{ flex: 1, marginRight: '5px' }}
                            disabled={!roomId}
                        />
                        <Button type="submit" disabled={!roomId || !newMessage.trim()}>
                            发送
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CollaborationPanel;
