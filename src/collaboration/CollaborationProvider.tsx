import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEditActivity } from '../EditActivityContext';
import { MessageToast } from '../MessageToast';
import { useLoadScene, useScene } from '../SceneProvider';
import { webSocketService } from './WebSocketService';

interface User {
    id: string;
    name: string;
    canEdit?: boolean;
}

interface CollaborationContextType {
    connected: boolean;
    userId: string;
    userName: string;
    roomId: string;
    connectedUsers: User[];
    isHost: boolean;
    hostId: string; // 房主ID
    joinRoom: (roomId?: string) => Promise<void>;
    leaveRoom: () => void;
    changeUserName: (name: string) => void;
    sendChatMessage: (message: string) => void;
    transferHost: (newHostId: string) => void;
    setUserEditPermission: (userId: string, canEdit: boolean) => void; // 设置用户编辑权限
    chatMessages: Array<{
        userId: string;
        userName: string;
        message: string;
        timestamp: number;
    }>;
    enableUpdateDelay: boolean; // 是否启用更新延时
    setEnableUpdateDelay: (enabled: boolean) => void; // 设置是否启用更新延时
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

// localStorage中的用户名键名
const USER_NAME_STORAGE_KEY = 'xivplan_user_name';

// 辅助函数：从localStorage获取用户名
const getSavedUserName = (): string => {
    try {
        return localStorage.getItem(USER_NAME_STORAGE_KEY) || '';
    } catch (error) {
        console.error('读取保存的用户名失败:', error);
        return '';
    }
};

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({
    children,
    serverUrl = 'ws://ws.xivplan.mapleshuzuko.site',
}) => {
    const { scene, stepIndex, dispatch } = useScene();
    const loadScene = useLoadScene();
    const [searchParams] = useSearchParams();

    const [connected, setConnected] = useState(false);
    const [userId, setUserId] = useState('');
    // 初始化时直接从localStorage读取用户名
    const [userName, setUserName] = useState(getSavedUserName());
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
    // 使用EditActivityContext中的isActiveEdit状态
    const { isActiveEdit, setActiveEdit } = useEditActivity();

    const [error, setError] = useState<string | null>(null);
    // 场景更新计数器，用于实现每5次更新才发送一次请求
    // Removed unused updateCounter state
    // 控制是否启用场景更新延时功能
    const [enableUpdateDelay, setEnableUpdateDelay] = useState(false);
    // 使用useRef存储定时器引用，避免触发不必要的重渲染
    const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());

    // 组件加载时再次确认localStorage中的用户名
    useEffect(() => {
        const savedName = getSavedUserName();
        if (savedName && savedName !== userName) {
            setUserName(savedName);
        }
    }, []);

    // 连接到WebSocket服务器
    useEffect(() => {
        const connectWebSocket = async () => {
            try {
                await webSocketService.connect(serverUrl);
                setConnected(true);

                // 连接成功后，如果已有保存的用户名，立即发送到服务器
                const savedName = getSavedUserName();
                if (savedName) {
                    setTimeout(() => {
                        webSocketService.setUserName(savedName);
                    }, 100); // 短暂延迟确保连接完全建立
                }

                // 检查URL中是否有房间参数，如果有则加入房间
                const roomIdFromUrl = searchParams.get('room');
                if (roomIdFromUrl) {
                    setTimeout(() => {
                        joinRoom(roomIdFromUrl).catch((error) => {
                            console.error('自动加入房间失败:', error);
                        });
                    }, 200); // 确保连接和用户名设置完成后再加入房间
                }
            } catch (error) {
                console.error('连接WebSocket服务器失败:', error);
                setConnected(false);
            }
        };

        connectWebSocket();

        // 注册事件监听器
        const handleUserInfo = (data: any) => {
            setUserId(data.userId);

            // 获取保存的用户名
            const savedName = getSavedUserName();

            // 如果有保存的用户名，优先使用它
            if (savedName) {
                // 如果当前userName和保存的用户名不同，更新它
                if (savedName !== userName) {
                    setUserName(savedName);
                }
                // 确保服务器也使用这个用户名
                webSocketService.setUserName(savedName);
            } else if (data.userName && !userName) {
                // 如果没有保存的用户名，但服务器提供了一个，且当前没有用户名，则使用服务器的
                setUserName(data.userName);
            }
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
        };

        // 移除访客编辑权限变更处理，使用用户级权限

        // 定义错误处理回调函数
        const handleError = (message: string) => {
            setError(message);
            // 3秒后自动清除错误消息
            setTimeout(() => setError(null), 3000);
        };

        // 注册房主相关事件监听器
        webSocketService.on('host_changed', handleHostChanged);
        webSocketService.on('host_info', handleHostInfo);

        webSocketService.on('error', handleError);

        // 清理函数
        return () => {
            webSocketService.off('host_changed', handleHostChanged);
            webSocketService.off('host_info', handleHostInfo);

            webSocketService.off('error', handleError);
        };
    }, [userId]); // 依赖于userId，确保函数获取最新的userId值

    // 已经从useScene获取了scene、stepIndex和dispatch

    // 单独处理scene_update事件中对userId的依赖
    useEffect(() => {
        const handleSceneUpdate = ({ data, senderId }: { data: any; senderId: string }) => {
            // 如果更新不是由当前用户发起的，则更新场景
            if (senderId !== userId) {
                console.log(`[协作] 收到来自用户 ${senderId} 的场景更新，设置isActiveEdit=false`);
                setActiveEdit(false); // 设置为非主动编辑
                // 保存当前选中的stepIndex
                const currentStepIndex = stepIndex;
                // 加载更新的场景
                loadScene(data);
                // 恢复原来选中的stepIndex
                dispatch({ type: 'setStep', index: currentStepIndex });
                // 定期重置为不活动状态
                setTimeout(() => {
                    console.log('[编辑活动] 结束编辑操作');
                    setActiveEdit(false);
                }, 500);
            } else {
                console.log(`[协作] 收到自己(${userId})发送的场景更新，忽略`);
            }
        };

        // 添加新的场景更新监听器
        webSocketService.on('scene_update', handleSceneUpdate);

        // 清理时移除监听器
        return () => {
            webSocketService.off('scene_update', handleSceneUpdate);
        };
    }, [userId, loadScene, stepIndex, dispatch]);

    useEffect(() => {
        if (connected && roomId && scene && isActiveEdit) {
            // if (enableUpdateDelay) {
            //     const currentTime = Date.now();
            //     const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
            //     // 如果达到5次更新或者时间间隔超过200ms，发送场景数据
            //     if (timeSinceLastUpdate > 100) {
            //         webSocketService.updateScene(scene, isHost);
            //         lastUpdateTimeRef.current = currentTime; // 更新时间戳
            //     }
            // } else {
            //     // 不启用延时，直接发送
            //     webSocketService.updateScene(scene, isHost);
            // }
            const currentTime = Date.now();
            const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
            // 如果达到5次更新或者时间间隔超过200ms，发送场景数据
            if (timeSinceLastUpdate > 50) {
                webSocketService.updateScene(scene, isHost);
                lastUpdateTimeRef.current = currentTime; // 更新时间戳
            }
        }

        // 清理函数：清除定时器
        return () => {
            if (updateTimerRef.current) {
                clearTimeout(updateTimerRef.current);
            }
        };
    }, [scene, connected, roomId, isHost, isActiveEdit, enableUpdateDelay]);

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
        // 清除定时器
        if (updateTimerRef.current) {
            clearTimeout(updateTimerRef.current);
            updateTimerRef.current = null;
        }
        // 重置延时设置
        setEnableUpdateDelay(false);
        // 这里可以添加离开房间的逻辑，例如重新连接WebSocket
    };

    // 更改用户名
    const changeUserName = (name: string) => {
        if (name.trim()) {
            webSocketService.setUserName(name);
            setUserName(name);
            // 保存用户名到localStorage
            try {
                localStorage.setItem(USER_NAME_STORAGE_KEY, name);
            } catch (error) {
                console.error('保存用户名失败:', error);
            }
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

    // 设置用户编辑权限
    const setUserEditPermission = (userId: string, canEdit: boolean) => {
        webSocketService.setUserEditPermission(userId, canEdit);
    };

    // 控制是否启用更新延时（只有房主可以修改）
    const handleSetEnableUpdateDelay = (enabled: boolean) => {
        if (isHost) {
            setEnableUpdateDelay(enabled);
        }
    };

    const value = {
        connected,
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
        chatMessages,
        enableUpdateDelay,
        setEnableUpdateDelay: handleSetEnableUpdateDelay,
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
