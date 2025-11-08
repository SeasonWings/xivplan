import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useLoadScene, useScene } from '../SceneProvider';
import { webSocketService } from './WebSocketService';
import { MessageToast } from '../MessageToast';

interface User {
    id: string;
    name: string;
}

interface CollaborationContextType {
    connected: boolean;
    userId: string;
    userName: string;
    roomId: string;
    connectedUsers: User[];
    isHost: boolean;
    hostId: string; // 房主ID
    allowGuestEdit: boolean; // 访客是否可以编辑
    joinRoom: (roomId?: string) => Promise<void>;
    leaveRoom: () => void;
    changeUserName: (name: string) => void;
    sendChatMessage: (message: string) => void;
    transferHost: (newHostId: string) => void;
    setGuestEdit: (allowEdit: boolean) => void; // 设置访客编辑权限
    chatMessages: Array<{
        userId: string;
        userName: string;
        message: string;
        timestamp: number;
    }>;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const useCollaboration = () => {
    const context = useContext(CollaborationContext);
    if (context === undefined) {
        throw new Error('useCollaboration must be used within a CollaborationProvider');
    }
    return context;
};

interface CollaborationProviderProps {
    children: ReactNode;
    serverUrl?: string;
}

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({
    children,
    serverUrl = 'ws://localhost:8680',
}) => {
    const [connected, setConnected] = useState(false);
    const [userId, setUserId] = useState('');
    const [userName, setUserName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
    const [chatMessages, setChatMessages] = useState<
        Array<{
            userId: string;
            userName: string;
            message: string;
            timestamp: number;
        }>
    >([]);
    const [isHost, setIsHost] = useState(false);
    const [hostId, setHostId] = useState(''); // 存储房主ID
    const [allowGuestEdit, setAllowGuestEdit] = useState(true); // 默认允许访客编辑
    const [error, setError] = useState<string | null>(null);

    const { scene } = useScene();
    const loadScene = useLoadScene();

    // 连接到WebSocket服务器
    useEffect(() => {
        const connectWebSocket = async () => {
            try {
                await webSocketService.connect(serverUrl);
                setConnected(true);
            } catch (error) {
                console.error('连接WebSocket服务器失败:', error);
                setConnected(false);
            }
        };

        connectWebSocket();

        // 注册事件监听器
        const handleUserInfo = (data: any) => {
            setUserId(data.userId);
            setUserName(data.userName);
        };

        const handleRoomJoined = (data: any) => {
            setRoomId(data.roomId);
            // 房主状态将由服务器通过host_info事件来决定
            // 不再在客户端自行设置房主状态
        };

        const handleSceneSync = (sceneData: any) => {
            loadScene(sceneData);
            // 移除这里的setIsHost(false)，让房主状态由服务器通过host_info事件决定
        };

        const handleUsersUpdated = (users: User[]) => {
            setConnectedUsers(users);
        };

        const handleConnected = () => {
            setConnected(true);
        };

        const handleDisconnected = () => {
            setConnected(false);
        };

        const handleChatMessage = (message: any) => {
            setChatMessages((prev) => [...prev, message]);
        };

        webSocketService.on('user_info', handleUserInfo);
        webSocketService.on('room_joined', handleRoomJoined);
        webSocketService.on('scene_sync', handleSceneSync);
        webSocketService.on('users_updated', handleUsersUpdated);
        webSocketService.on('connected', handleConnected);
        webSocketService.on('disconnected', handleDisconnected);
        webSocketService.on('chat_message', handleChatMessage);

        // 清理函数
        return () => {
            webSocketService.off('user_info', handleUserInfo);
            webSocketService.off('room_joined', handleRoomJoined);
            webSocketService.off('scene_sync', handleSceneSync);
            webSocketService.off('users_updated', handleUsersUpdated);
            webSocketService.off('connected', handleConnected);
            webSocketService.off('disconnected', handleDisconnected);
            webSocketService.off('chat_message', handleChatMessage);
            webSocketService.disconnect();
        };
    }, [serverUrl, loadScene]);

    // 单独处理房主相关事件，确保依赖于userId
    useEffect(() => {
        const handleHostChanged = (data: any) => {
            // 更新房主ID和当前用户的房主状态
            console.log(
                `handleHostChanged - 房主变更事件: 新hostId=${data.hostId}, 原hostId=${data.oldHostId}, 房间=${data.roomId}, 当前userId=${userId}`,
            );
            // 首先更新hostId状态
            setHostId(data.hostId);
            // 更新访客编辑权限
            if (typeof data.allowGuestEdit !== 'undefined') {
                setAllowGuestEdit(data.allowGuestEdit);
                console.log(`handleHostChanged - 更新访客编辑权限: ${data.allowGuestEdit}`);
            }
            // 然后检查userId是否存在，更新isHost状态
            if (userId) {
                const isNowHost = data.hostId === userId;
                setIsHost(isNowHost);
                console.log(`handleHostChanged - 用户 ${userId} 房主状态更新为: ${isNowHost}`);
                if (isNowHost) {
                    console.log(`handleHostChanged - 恭喜！您现在是房主了！`);
                }
            } else {
                console.log('handleHostChanged - userId尚未获取，无法设置房主状态');
            }
        };

        const handleHostInfo = (data: any) => {
            console.log(
                `handleHostInfo - 收到房主信息事件: hostId=${data.hostId}, 房间=${data.roomId}, 当前userId=${userId}`,
            );
            // 检查userId是否存在
            if (userId) {
                // 更新hostId和isHost状态
                setHostId(data.hostId);
                const isNowHost = data.hostId === userId;
                setIsHost(isNowHost);
                console.log(`handleHostInfo - 用户 ${userId} 房主状态更新为: ${isNowHost}`);
            } else {
                console.log('handleHostInfo - userId尚未获取，无法设置房主状态');
            }
            // 更新访客编辑权限
            if (typeof data.allowGuestEdit !== 'undefined') {
                setAllowGuestEdit(data.allowGuestEdit);
                console.log(`handleHostInfo - 更新访客编辑权限: ${data.allowGuestEdit}`);
            }
        };

        const handleGuestEditPermissionChanged = (data: any) => {
            console.log(
                `handleGuestEditPermissionChanged - 访客编辑权限变更: allowGuestEdit=${data.allowGuestEdit}, 房间=${data.roomId}`,
            );
            setAllowGuestEdit(data.allowGuestEdit);
        };

        // 定义错误处理回调函数
        const handleError = (message: string) => {
            setError(message);
            // 3秒后自动清除错误消息
            setTimeout(() => setError(null), 3000);
        };

        // 注册房主相关事件监听器
        webSocketService.on('host_changed', handleHostChanged);
        webSocketService.on('host_info', handleHostInfo);
        webSocketService.on('guest_edit_permission_changed', handleGuestEditPermissionChanged);
        webSocketService.on('error', handleError);

        // 清理函数
        return () => {
            webSocketService.off('host_changed', handleHostChanged);
            webSocketService.off('host_info', handleHostInfo);
            webSocketService.off('guest_edit_permission_changed', handleGuestEditPermissionChanged);
            webSocketService.off('error', handleError);
        };
    }, [userId]); // 依赖于userId，确保函数获取最新的userId值

    // 单独处理scene_update事件中对userId的依赖
    useEffect(() => {
        const handleSceneUpdate = ({ data, senderId }: { data: any; senderId: string }) => {
            // 如果更新不是由当前用户发起的，则更新场景
            if (senderId !== userId) {
                loadScene(data);
            }
        };

        // 添加新的场景更新监听器
        webSocketService.on('scene_update', handleSceneUpdate);

        // 清理时移除监听器
        return () => {
            webSocketService.off('scene_update', handleSceneUpdate);
        };
    }, [userId, loadScene]);

    // 场景更新时发送到服务器
    useEffect(() => {
        if (connected && roomId && scene) {
            // 使用防抖来限制发送频率
            const timer = setTimeout(() => {
                webSocketService.updateScene(scene, isHost, allowGuestEdit);
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [scene, connected, roomId, isHost, allowGuestEdit]);

    // 加入房间
    const joinRoom = async (roomId?: string) => {
        if (!connected) {
            try {
                await webSocketService.connect(serverUrl);
            } catch (error) {
                console.error('连接服务器失败:', error);
                throw error;
            }
        }

        // 清除之前的聊天记录
        setChatMessages([]);

        // 清除之前的房主状态
        setIsHost(false);
        setHostId('');

        // 临时添加一个特定的host_info监听器，确保我们能捕获到加入房间后的房主信息
        const tempHostInfoHandler = (data: any) => {
            console.log(`joinRoom - 接收到房主信息: hostId=${data.hostId}, 当前userId=${userId}`);
            setHostId(data.hostId);
            if (userId) {
                setIsHost(data.hostId === userId);
                console.log(`joinRoom - 设置房主状态: ${data.hostId === userId}`);
            } else {
                console.log('joinRoom - userId尚未获取，无法设置房主状态');
            }
        };

        // 添加临时监听器
        webSocketService.on('host_info', tempHostInfoHandler);

        // 发送加入房间请求
        webSocketService.joinRoom(roomId);

        // 3秒后移除临时监听器，避免重复处理
        setTimeout(() => {
            webSocketService.off('host_info', tempHostInfoHandler);
            console.log('joinRoom - 临时host_info监听器已移除');
        }, 3000);
    };

    // 离开房间
    const leaveRoom = () => {
        setRoomId('');
        setConnectedUsers([]);
        setChatMessages([]);
        setIsHost(false);
        setAllowGuestEdit(true); // 重置为默认值
        // 这里可以添加离开房间的逻辑，例如重新连接WebSocket
    };

    // 更改用户名
    const changeUserName = (name: string) => {
        if (name.trim()) {
            webSocketService.setUserName(name);
            setUserName(name);
        }
    };

    const sendChatMessage = (message: string) => {
        if (message.trim()) {
            webSocketService.sendChatMessage(message);
        }
    };

    // 移交房主权限
    const transferHost = (newHostId: string) => {
        webSocketService.transferHost(newHostId);
    };

    // 设置访客编辑权限
    const setGuestEdit = (allowEdit: boolean) => {
        webSocketService.setGuestEdit(allowEdit);
    };

    const value = {
        connected,
        userId,
        userName,
        roomId,
        connectedUsers,
        isHost,
        hostId,
        allowGuestEdit,
        joinRoom,
        leaveRoom,
        changeUserName,
        sendChatMessage,
        transferHost,
        setGuestEdit,
        chatMessages,
    };

    return (
        <CollaborationContext.Provider value={value}>
            {error && (
                <MessageToast
                    title="操作失败"
                    message={error}
                    style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}
                />
            )}
            {children}
        </CollaborationContext.Provider>
    );
};
