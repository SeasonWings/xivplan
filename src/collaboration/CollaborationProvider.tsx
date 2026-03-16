import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { config } from '../config';
import { useEditActivity } from '../EditActivityContext';
import { MessageToast } from '../MessageToast';
import type { Scene } from '../scene';
import {
    type EditorState,
    type SceneAction,
    useAddSceneDispatchListener,
    useLoadScene,
    useScene,
} from '../SceneProvider';
import type { UndoRedoAction } from '../undo/undoReducer';
import {
    ChatMessageData,
    HostChangedData,
    HostInfoData,
    RoomJoinedData,
    UserInfoData,
    webSocketService,
} from './WebSocketService';

interface User {
    id: string;
    name: string;
    avatar?: string | null;
    canEdit?: boolean;
    shortId?: number;
}

interface CollaborationContextType {
    connected: boolean;
    userId: string;
    userName: string;
    userAvatar: string | null;
    usingAccountProfile: boolean;
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
    unreadChatCount: number;
    markChatRead: () => void;
    setCollaborationDialogOpen: (open: boolean) => void;
    setChatTabActive: (active: boolean) => void;
    chatMessages: Array<{
        userId: string;
        userName: string;
        userAvatar?: string | null;
        message: string;
        timestamp: number;
    }>;
    enableUpdateDelay: boolean; // 是否启用更新延时
    setEnableUpdateDelay: (enabled: boolean) => void; // 设置是否启用更新延时
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
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

export const CollaborationProvider: React.FC<CollaborationProviderProps> = ({ children, serverUrl }) => {
    const { scene, stepIndex, dispatch } = useScene();
    const loadScene = useLoadScene();
    const [searchParams] = useSearchParams();
    const { hash } = useLocation();
    const { state: authState } = useAuth();

    const [connected, setConnected] = useState(false);
    const [userId, setUserId] = useState('');
    // 初始化时直接从localStorage读取用户名
    const [userName, setUserName] = useState(getSavedUserName());
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
    const [roomId, setRoomId] = useState('');
    const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
    const [chatMessages, setChatMessages] = useState<
        Array<{
            userId: string;
            userName: string;
            userAvatar?: string | null;
            message: string;
            timestamp: number;
        }>
    >([]);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [isHost, setIsHost] = useState(false);
    const [hostId, setHostId] = useState(''); // 存储房主ID
    // 使用EditActivityContext中的isActiveEdit状态
    const { setActiveEdit } = useEditActivity();

    const [error, setError] = useState<string | null>(null);
    // 场景更新计数器，用于实现每5次更新才发送一次请求
    // Removed unused updateCounter state
    // 控制是否启用场景更新延时功能
    const [enableUpdateDelay, setEnableUpdateDelay] = useState(false);
    const userIdRef = useRef('');
    const stepIndexRef = useRef(stepIndex);
    const dialogOpenRef = useRef(false);
    const chatTabActiveRef = useRef(false);
    const autoJoinAttemptRef = useRef<{ roomId: string; at: number } | null>(null);
    const isApplyingRemoteRef = useRef(false);
    const lastSceneSeqRef = useRef(0);
    const sceneRef = useRef(scene);
    const snapshotTimerRef = useRef<number | null>(null);
    const periodicSnapshotTimerRef = useRef<number | null>(null);
    const transientSendTimerRef = useRef<number | null>(null);
    const pendingTransientActionRef = useRef<SceneAction | null>(null);

    const remoteQueueRef = useRef<Array<{ seq: number; senderId: string; action: unknown }>>([]);
    const remoteFlushRafRef = useRef<number | null>(null);

    const usingAccountProfile = authState.isAuthenticated && !!authState.user;

    const preferredProfileRef = useRef<{ name: string; avatar: string | null }>({ name: '', avatar: null });

    useEffect(() => {
        if (!usingAccountProfile) {
            setUserNameOverride(null);
        }
    }, [usingAccountProfile]);

    useEffect(() => {
        if (authState.isAuthenticated && authState.user) {
            const override = userNameOverride?.trim();
            preferredProfileRef.current = {
                name: override || authState.user.username,
                avatar: authState.user.avatar ?? null,
            };
            return;
        }
        const savedName = getSavedUserName();
        preferredProfileRef.current = {
            name: savedName || userName || '',
            avatar: null,
        };
    }, [authState.isAuthenticated, authState.user, userName, userNameOverride]);

    const getPreferredProfile = () => preferredProfileRef.current;

    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    useEffect(() => {
        stepIndexRef.current = stepIndex;
    }, [stepIndex]);

    useEffect(() => {
        sceneRef.current = scene;
    }, [scene]);

    // 组件加载时再次确认localStorage中的用户名
    useEffect(() => {
        const savedName = getSavedUserName();
        if (savedName && savedName !== userName) {
            setUserName(savedName);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // 注册事件监听器
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleUserInfo = (data: any) => {
            const userInfo = data as UserInfoData;
            setUserId(userInfo.userId);

            const profile = getPreferredProfile();
            if (profile.name) {
                setUserName(profile.name);
            } else if (userInfo.userName && !userName) {
                setUserName(userInfo.userName);
            }
            setUserAvatar(profile.avatar);
            webSocketService.setUserProfile({ name: profile.name || userInfo.userName || '', avatar: profile.avatar });
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleRoomJoined = (data: any) => {
            const roomData = data as RoomJoinedData;
            setRoomId(roomData.roomId);
            // 房主状态将由服务器通过host_info事件来决定
            // 不再在客户端自行设置房主状态
        };

        const handleSceneSync = (payload: unknown) => {
            const data = payload as { scene?: unknown; seq?: number } | undefined;
            const nextScene = data?.scene ?? payload;
            const seq = typeof data?.seq === 'number' ? data.seq : 0;
            lastSceneSeqRef.current = Math.max(lastSceneSeqRef.current, seq);

            setActiveEdit(false);
            const currentStepIndex = stepIndexRef.current;
            isApplyingRemoteRef.current = true;
            loadScene(nextScene as Scene);
            dispatch({ type: 'setStep', index: currentStepIndex });
            isApplyingRemoteRef.current = false;
        };

        const flushRemoteQueue = () => {
            if (remoteFlushRafRef.current !== null) return;
            remoteFlushRafRef.current = window.requestAnimationFrame(() => {
                remoteFlushRafRef.current = null;
                const batch: Array<{ seq: number; senderId: string; action: unknown }> = remoteQueueRef.current.splice(
                    0,
                    80,
                );
                if (batch.length === 0) return;

                isApplyingRemoteRef.current = true;
                unstable_batchedUpdates(() => {
                    const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
                    let mergedUpdate: Map<number, unknown> | null = null;
                    let mergedTransient = false;

                    const flushMergedUpdate = () => {
                        if (!mergedUpdate || mergedUpdate.size === 0) {
                            mergedUpdate = null;
                            mergedTransient = false;
                            return;
                        }
                        const mergedAction = {
                            type: 'update',
                            value: Array.from(mergedUpdate.values()),
                            transient: mergedTransient,
                        } as unknown as SceneAction;
                        dispatch(mergedAction);
                        mergedUpdate = null;
                        mergedTransient = false;
                    };

                    for (const a of batch) {
                        lastSceneSeqRef.current = Math.max(lastSceneSeqRef.current, a.seq);
                        if (a.senderId && a.senderId === userIdRef.current) {
                            continue;
                        }

                        const act = a.action;
                        if (!isRecord(act)) {
                            flushMergedUpdate();
                            dispatch(act as SceneAction | UndoRedoAction<EditorState>);
                            continue;
                        }

                        const actType = typeof act.type === 'string' ? act.type : undefined;
                        const actTransient = act.transient === true;

                        if (actType === 'update' && actTransient) {
                            if (!mergedUpdate) mergedUpdate = new Map();
                            mergedTransient = true;
                            const rawValue = 'value' in act ? act.value : undefined;
                            const items = Array.isArray(rawValue) ? rawValue : [rawValue];
                            for (const it of items) {
                                if (!isRecord(it)) continue;
                                const id = it.id;
                                if (typeof id === 'number') {
                                    mergedUpdate.set(id, it);
                                }
                            }
                            continue;
                        }

                        if (actType === 'commit' || actType === 'rollback') {
                            flushMergedUpdate();
                            dispatch(act as unknown as SceneAction | UndoRedoAction<EditorState>);
                            continue;
                        }

                        flushMergedUpdate();
                        dispatch(act as unknown as SceneAction | UndoRedoAction<EditorState>);
                    }

                    flushMergedUpdate();
                });
                isApplyingRemoteRef.current = false;

                if (remoteQueueRef.current.length > 0) {
                    flushRemoteQueue();
                }
            });
        };

        const handleUsersUpdated = (data: unknown) => {
            const users = data as User[];
            setConnectedUsers(users);
        };

        const handleConnected = () => {
            setConnected(true);
        };

        const handleDisconnected = () => {
            setConnected(false);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleChatMessage = (message: any) => {
            const msg = message as ChatMessageData;
            setChatMessages((prev) => [...prev, msg]);
            const isSelfMessage = !!msg.userId && msg.userId === userIdRef.current;
            if (isSelfMessage) return;
            if (dialogOpenRef.current && chatTabActiveRef.current) return;
            setUnreadChatCount((c) => c + 1);
        };

        webSocketService.on('user_info', handleUserInfo);
        webSocketService.on('room_joined', handleRoomJoined);
        webSocketService.on('scene_sync', handleSceneSync);
        webSocketService.on('users_updated', handleUsersUpdated);
        webSocketService.on('connected', handleConnected);
        webSocketService.on('disconnected', handleDisconnected);
        const handleSceneAction = (m: unknown) => {
            const msg = m as { seq: number; senderId: string; action: unknown };
            if (!msg || typeof msg.seq !== 'number') return;
            remoteQueueRef.current.push(msg);
            flushRemoteQueue();
        };

        const handleSceneActionLog = (m: unknown) => {
            const msg = m as { actions?: Array<{ seq: number; senderId: string; action: unknown }> };
            const actions = msg.actions ?? [];
            if (actions.length === 0) return;
            remoteQueueRef.current.push(...actions);
            flushRemoteQueue();
        };

        webSocketService.on('chat_message', handleChatMessage);
        webSocketService.on('scene_action', handleSceneAction);
        webSocketService.on('scene_action_log', handleSceneActionLog);

        // 清理函数
        return () => {
            webSocketService.off('user_info', handleUserInfo);
            webSocketService.off('room_joined', handleRoomJoined);
            webSocketService.off('scene_sync', handleSceneSync);
            webSocketService.off('users_updated', handleUsersUpdated);
            webSocketService.off('connected', handleConnected);
            webSocketService.off('disconnected', handleDisconnected);
            webSocketService.off('chat_message', handleChatMessage);
            webSocketService.off('scene_action', handleSceneAction);
            webSocketService.off('scene_action_log', handleSceneActionLog);
            webSocketService.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadScene]);

    // 单独处理房主相关事件，确保依赖于userId
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleHostChanged = (data: any) => {
            const hostData = data as HostChangedData;
            // 更新房主ID和当前用户的房主状态
            // 首先更新hostId状态
            setHostId(hostData.hostId);
            // 然后检查userId是否存在，更新isHost状态
            if (userId) {
                const isNowHost = hostData.hostId === userId;
                setIsHost(isNowHost);
                if (isNowHost) {
                    // 用户成为房主
                }
            } else {
                // userId尚未获取，无法设置房主状态
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleHostInfo = (data: any) => {
            const hostInfo = data as HostInfoData;
            // 检查userId是否存在
            if (userId) {
                // 更新hostId和isHost状态
                setHostId(hostInfo.hostId);
                const isNowHost = hostInfo.hostId === userId;
                setIsHost(isNowHost);
            } else {
                // userId尚未获取，无法设置房主状态
            }
        };

        // 移除访客编辑权限变更处理，使用用户级权限

        // 定义错误处理回调函数
        const handleError = (data: unknown) => {
            const message = data as string;
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

    const onLocalDispatch = React.useCallback(
        (action: SceneAction | UndoRedoAction<EditorState>) => {
            if (isApplyingRemoteRef.current) return;
            if (!connected || !roomId) return;
            const type = (action as { type: string }).type;
            if (type === 'reset' || type === 'setSource') return;
            if (type === 'setStep' || type === 'nextStep' || type === 'previousStep') return;

            const flushPendingTransient = () => {
                if (!pendingTransientActionRef.current) return;
                webSocketService.sendSceneAction(pendingTransientActionRef.current);
                pendingTransientActionRef.current = null;
            };

            const transient = (action as SceneAction).transient === true;
            if (transient) {
                pendingTransientActionRef.current = action as SceneAction;
                if (transientSendTimerRef.current === null) {
                    transientSendTimerRef.current = window.requestAnimationFrame(() => {
                        transientSendTimerRef.current = null;
                        flushPendingTransient();
                    });
                }
                return;
            }

            flushPendingTransient();
            webSocketService.sendSceneAction(action);

            if (isHost) {
                if (snapshotTimerRef.current !== null) {
                    window.clearTimeout(snapshotTimerRef.current);
                }
                snapshotTimerRef.current = window.setTimeout(() => {
                    webSocketService.sendSceneSnapshot(sceneRef.current, lastSceneSeqRef.current);
                    snapshotTimerRef.current = null;
                }, 800);
            }
        },
        [connected, isHost, roomId],
    );

    useAddSceneDispatchListener(onLocalDispatch);

    useEffect(() => {
        if (!connected || !roomId || !isHost) return;
        webSocketService.sendSceneSnapshot(sceneRef.current, lastSceneSeqRef.current);
    }, [connected, isHost, roomId]);

    useEffect(() => {
        if (!connected || !roomId || !isHost) {
            if (periodicSnapshotTimerRef.current !== null) {
                window.clearInterval(periodicSnapshotTimerRef.current);
                periodicSnapshotTimerRef.current = null;
            }
            return;
        }

        if (periodicSnapshotTimerRef.current !== null) {
            window.clearInterval(periodicSnapshotTimerRef.current);
            periodicSnapshotTimerRef.current = null;
        }

        periodicSnapshotTimerRef.current = window.setInterval(() => {
            webSocketService.sendSceneSnapshot(sceneRef.current, lastSceneSeqRef.current);
        }, config.collaboration.hostSnapshotIntervalMs);

        return () => {
            if (periodicSnapshotTimerRef.current !== null) {
                window.clearInterval(periodicSnapshotTimerRef.current);
                periodicSnapshotTimerRef.current = null;
            }
        };
    }, [connected, isHost, roomId]);

    // 加入房间
    const joinRoom = async (roomId?: string) => {
        if (!connected) {
            try {
                await webSocketService.connect(serverUrl);
                const profile = getPreferredProfile();
                setUserName(profile.name || userName || '');
                setUserAvatar(profile.avatar);
                webSocketService.setUserProfile({ name: profile.name || userName || '', avatar: profile.avatar });
            } catch (error) {
                console.error('连接服务器失败:', error);
                setError(error instanceof Error ? error.message : '连接服务器失败');
                throw error;
            }
        }

        lastSceneSeqRef.current = 0;

        // 清除之前的聊天记录
        setChatMessages([]);
        setUnreadChatCount(0);

        // 清除之前的房主状态
        setIsHost(false);
        setHostId('');

        // 临时添加一个特定的host_info监听器，确保我们能捕获到加入房间后的房主信息
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tempHostInfoHandler = (data: any) => {
            const hostInfo = data as HostInfoData;
            setHostId(hostInfo.hostId);
            if (userId) {
                setIsHost(hostInfo.hostId === userId);
            } else {
                // userId尚未获取，无法设置房主状态
            }
        };

        // 添加临时监听器
        webSocketService.on('host_info', tempHostInfoHandler);

        // 发送加入房间请求
        webSocketService.joinRoom(roomId);

        // 显式刷新用户列表
        webSocketService.refreshUsersList();

        // 添加重试机制，确保用户列表能够正确加载
        let retryCount = 0;
        const maxRetries = 3;
        const retryInterval = 500; // 毫秒

        const retryRefreshUsers = () => {
            if (retryCount < maxRetries) {
                retryCount++;
                webSocketService.refreshUsersList();

                // 设置下一次重试
                setTimeout(retryRefreshUsers, retryInterval);
            }
        };

        // 第一次重试延迟1秒，给服务器一些时间处理加入请求
        setTimeout(retryRefreshUsers, 1000);

        // 3秒后移除临时监听器，避免重复处理
        setTimeout(() => {
            webSocketService.off('host_info', tempHostInfoHandler);
        }, 3000);
    };

    useEffect(() => {
        const roomIdFromSearch = searchParams.get('room');
        const roomIdFromHash = (() => {
            const m = hash.match(/[?&]room=([^&]+)/);
            if (!m || !m[1]) return null;
            try {
                return decodeURIComponent(m[1]);
            } catch {
                return m[1];
            }
        })();
        const roomIdFromUrl = roomIdFromSearch || roomIdFromHash;
        if (!roomIdFromUrl) return;
        if (roomId && roomId === roomIdFromUrl) return;
        const now = Date.now();
        if (autoJoinAttemptRef.current?.roomId === roomIdFromUrl && now - autoJoinAttemptRef.current.at < 5000) {
            return;
        }
        autoJoinAttemptRef.current = { roomId: roomIdFromUrl, at: now };

        setTimeout(() => {
            joinRoom(roomIdFromUrl).catch((error) => {
                console.error('自动加入房间失败:', error);
            });
        }, 200); // 确保连接和用户名设置完成后再加入房间

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams, hash, roomId]);

    // 离开房间
    const leaveRoom = () => {
        setRoomId('');
        setConnectedUsers([]);
        setChatMessages([]);
        setUnreadChatCount(0);
        setIsHost(false);
        setHostId('');
        pendingTransientActionRef.current = null;
        if (transientSendTimerRef.current !== null) {
            window.cancelAnimationFrame(transientSendTimerRef.current);
            transientSendTimerRef.current = null;
        }
        if (snapshotTimerRef.current !== null) {
            window.clearTimeout(snapshotTimerRef.current);
            snapshotTimerRef.current = null;
        }
        if (periodicSnapshotTimerRef.current !== null) {
            window.clearInterval(periodicSnapshotTimerRef.current);
            periodicSnapshotTimerRef.current = null;
        }
        if (remoteFlushRafRef.current !== null) {
            window.cancelAnimationFrame(remoteFlushRafRef.current);
            remoteFlushRafRef.current = null;
        }
        remoteQueueRef.current = [];
        // 重置延时设置
        setEnableUpdateDelay(false);
        webSocketService.disconnect();
        setConnected(false);
        setUserId('');
    };

    // 更改用户名
    const changeUserName = (name: string) => {
        const next = name.trim();
        if (usingAccountProfile) {
            if (next) {
                setUserNameOverride(next);
                setUserName(next);
                webSocketService.setUserProfile({ name: next, avatar: userAvatar });
                return;
            }
            setUserNameOverride(null);
            const fallback = authState.user?.username ?? '';
            if (fallback) {
                setUserName(fallback);
                webSocketService.setUserProfile({ name: fallback, avatar: userAvatar });
            }
            return;
        }

        if (!next) return;
        webSocketService.setUserName(next);
        setUserName(next);
        try {
            localStorage.setItem(USER_NAME_STORAGE_KEY, next);
        } catch (error) {
            console.error('保存用户名失败:', error);
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

    const markChatRead = () => {
        setUnreadChatCount(0);
    };

    const setCollaborationDialogOpen = (open: boolean) => {
        dialogOpenRef.current = open;
        if (!open) {
            chatTabActiveRef.current = false;
        }
    };

    const setChatTabActive = (active: boolean) => {
        chatTabActiveRef.current = active;
        if (active) {
            setUnreadChatCount(0);
        }
    };

    const value = {
        connected,
        userId,
        userName,
        userAvatar,
        usingAccountProfile,
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
        setCollaborationDialogOpen,
        setChatTabActive,
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
