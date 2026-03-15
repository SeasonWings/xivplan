// WebSocket服务用于管理与服务器的实时通信
import { config } from '../config';

export interface UserInfoData {
    userId: string;
    userName: string;
    userAvatar?: string | null;
}

export interface RoomJoinedData {
    roomId: string;
    shortId?: number;
}

export interface HostInfoData {
    hostId: string;
}

export interface HostChangedData {
    hostId: string;
}

export interface ChatMessageData {
    userId: string;
    userName: string;
    userAvatar?: string | null;
    message: string;
    timestamp: number;
}

export interface SceneActionMessage {
    seq: number;
    senderId: string;
    action: unknown;
}

export interface SceneActionLogMessage {
    fromSeq: number;
    actions: SceneActionMessage[];
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectInterval = 2000;
    private maxReconnectDelay = 10000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private eventListeners: Map<string, Array<(data: unknown) => void>> = new Map();
    private isConnecting = false;
    private userId: string = '';
    private userName: string = '';
    private roomId: string = '';
    private connectedUsers: Array<{
        id: string;
        name: string;
        avatar?: string | null;
        canEdit?: boolean;
        shortId?: number;
    }> = [];
    private heartbeatInterval = 5000; // 心跳间隔5秒
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private lastHeartbeatResponse: number = 0;

    // 根据页面协议自动生成WebSocket URL
    private getWebSocketUrl(): string {
        // 获取当前页面的协议
        const protocol = window.location.protocol;
        // 根据页面协议选择WebSocket协议
        const isHttps = protocol === 'https:';
        const wsProtocol = isHttps ? 'wss:' : 'ws:';

        // 根据当前协议选择对应的配置
        const wsConfig = config.websocket;
        const baseUrl = wsConfig.baseUrl;

        // 构造完整URL
        if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
            return baseUrl;
        }
        if (baseUrl.startsWith('//')) {
            return `${wsProtocol}${baseUrl}`;
        }
        return `${wsProtocol}//${baseUrl}`;
    }

    private currentUrl: string = '';

    connect(serverUrl?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const safeResolve = () => {
                if (settled) return;
                settled = true;
                resolve();
            };
            const safeReject = (error: unknown) => {
                if (settled) return;
                settled = true;
                reject(error);
            };

            // 清除任何现有的重连定时器
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
                resolve();
                return;
            }

            this.isConnecting = true;
            // 如果提供了serverUrl，则直接使用，否则根据配置生成URL
            this.currentUrl = serverUrl || this.getWebSocketUrl();

            try {
                this.ws = new WebSocket(this.currentUrl);
                this.ws.binaryType = 'arraybuffer';

                this.ws.onopen = () => {
                    this.log('WebSocket连接已建立');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.trigger('connected');
                    this.startHeartbeat(); // 启动心跳
                    safeResolve();
                };

                this.ws.onmessage = (event) => {
                    if (typeof event.data === 'string') {
                        try {
                            const data = JSON.parse(event.data);
                            this.handleMessage(data);
                        } catch (error) {
                            this.error('解析WebSocket消息失败:', error);
                        }
                        return;
                    }

                    if (event.data instanceof ArrayBuffer) {
                        this.handleBinaryMessage(new Uint8Array(event.data));
                        return;
                    }

                    if (event.data instanceof Blob) {
                        event.data
                            .arrayBuffer()
                            .then((buf) => this.handleBinaryMessage(new Uint8Array(buf)))
                            .catch((error) => this.error('解析WebSocket二进制消息失败:', error));
                        return;
                    }
                };

                this.ws.onerror = (error) => {
                    this.error('WebSocket错误:', error);
                    this.isConnecting = false;
                    safeReject(new Error(`WebSocket连接失败: ${this.currentUrl}`));
                };

                // 连接关闭时的处理
                this.ws.onclose = (event) => {
                    this.log(`WebSocket连接关闭: ${event.code} ${event.reason}`);
                    this.isConnecting = false;
                    this.stopHeartbeat(); // 停止心跳
                    this.trigger('disconnected');

                    // 只有在非正常关闭的情况下才尝试重连
                    // 正常关闭（1000）或离开页面（1001）不重连
                    if (event.code !== 1000 && event.code !== 1001) {
                        // 使用防抖，避免短时间内多次触发重连
                        if (!this.reconnectTimer) {
                            this.attemptReconnect();
                        }
                    }
                };
            } catch (error) {
                this.isConnecting = false;
                safeReject(error);
            }
        });
    }

    // 断开连接
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopHeartbeat(); // 停止心跳

        if (this.ws) {
            // 使用正常关闭代码
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }

        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }

    // 启动心跳
    private startHeartbeat(): void {
        this.stopHeartbeat(); // 先清除现有的心跳定时器
        this.lastHeartbeatResponse = Date.now();

        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.heartbeatInterval);

        this.log('心跳保活机制已启动，间隔:', this.heartbeatInterval, 'ms');
    }

    // 停止心跳
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            this.log('心跳保活机制已停止');
        }
    }

    // 发送心跳包
    private sendHeartbeat(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            // 检查是否长时间未收到响应，可能连接已断开
            const currentTime = Date.now();
            const timeSinceLastResponse = currentTime - this.lastHeartbeatResponse;

            // 如果超过1.5倍心跳间隔未收到响应，认为连接异常
            if (timeSinceLastResponse > this.heartbeatInterval * 1.5) {
                this.log('长时间未收到心跳响应，可能连接已断开，尝试重连');
                this.disconnect();
                this.connect(this.currentUrl).catch((error) => {
                    this.error('心跳重连失败:', error);
                });
                return;
            }

            // 发送ping消息
            this.ws.send(JSON.stringify({ type: 'ping' }));
            this.log('发送心跳包');
        }
    }

    // 尝试重连
    private attemptReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            // 指数退避策略，但有上限
            const delay = Math.min(
                this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
                this.maxReconnectDelay,
            );

            this.log(`尝试重新连接... (第 ${this.reconnectAttempts}/${this.maxReconnectAttempts} 次，延迟 ${delay}ms)`);

            this.reconnectTimer = setTimeout(() => {
                if (!this.isConnecting && !this.ws?.OPEN) {
                    this.connect(this.currentUrl).catch((error) => {
                        this.error('重连失败:', error);
                    });
                }
                this.reconnectTimer = null;
            }, delay);
        } else {
            this.error('达到最大重连次数，停止重连');
            this.trigger('disconnected');
        }
    }

    // 日志打印方法，受debugMode控制
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private log(...args: unknown[]): void {
        //  if (this.debugMode) {
        //     console.log(...args);
        // }
    }

    // 错误日志打印方法，不受debugMode控制
    private error(...args: unknown[]): void {
        console.error(...args);
    }

    // 处理接收到的消息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleMessage(data: any): void {
        switch (data.type) {
            case 'user_info':
                this.userId = data.userId;
                this.userName = data.userName;
                this.trigger('user_info', data);
                break;

            case 'room_joined':
                this.roomId = data.roomId;
                this.trigger('room_joined', data);
                break;

            case 'scene_sync':
                this.trigger('scene_sync', { scene: data.data, seq: typeof data.seq === 'number' ? data.seq : 0 });
                break;

            case 'scene_update':
                this.trigger('scene_update', {
                    data: data.data,
                    senderId: data.senderId,
                });
                break;

            case 'scene_action':
                this.trigger('scene_action', {
                    seq: data.seq,
                    senderId: data.senderId,
                    action: data.action,
                } satisfies SceneActionMessage);
                break;

            case 'scene_action_log':
                this.trigger('scene_action_log', {
                    fromSeq: typeof data.fromSeq === 'number' ? data.fromSeq : 0,
                    actions: Array.isArray(data.actions) ? data.actions : [],
                } satisfies SceneActionLogMessage);
                break;

            case 'user_joined':
            case 'user_left':
            case 'user_name_changed':
                this.connectedUsers = data.users || [];
                this.trigger(data.type, data);
                this.trigger('users_updated', this.connectedUsers);
                break;

            case 'host_info':
                // 触发房主信息事件
                this.trigger('host_info', data);
                break;

            case 'host_changed':
                // 触发房主变更事件
                this.trigger('host_changed', data);
                break;

            case 'pong':
                // 接收到服务器的心跳响应
                this.lastHeartbeatResponse = Date.now();
                this.log('收到服务器心跳响应');
                break;

            case 'guest_edit_permission_changed':
                // 触发访客编辑权限变更事件
                this.trigger('guest_edit_permission_changed', data);
                break;

            case 'user_permission_changed':
                // 处理用户权限变更事件
                this.log(`收到用户权限变更: userId=${data.userId}, canEdit=${data.canEdit}`);
                // 更新connectedUsers数组中的用户权限
                this.connectedUsers = this.connectedUsers.map((user) =>
                    user.id === data.userId ? { ...user, canEdit: data.canEdit } : user,
                );
                // 触发用户列表更新事件
                this.trigger('users_updated', this.connectedUsers);
                break;

            case 'chat_message':
                this.trigger('chat_message', data);
                break;

            case 'error':
                // 触发错误事件
                this.trigger('error', data.message);
                break;

            default:
                this.trigger('message', data);
        }
    }

    private handleBinaryMessage(data: Uint8Array): void {
        const type = data[0];
        switch (type) {
            case 0xd1:
                this.trigger('cursor_batch', data);
                break;
            case 0xd2:
                this.trigger('cursor_fec', data);
                break;
            default:
                this.trigger('binary_message', data);
        }
    }

    // 发送消息到服务器
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(type: string, payload?: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket未连接，无法发送消息');
            return;
        }

        const message = {
            type,
            ...payload,
        };

        this.ws.send(JSON.stringify(message));
    }

    sendBinary(payload: ArrayBuffer | Uint8Array): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket未连接，无法发送二进制消息');
            return;
        }
        this.ws.send(payload);
    }

    // 加入房间
    joinRoom(roomId?: string): void {
        this.send('join_room', { roomId });

        // 立即刷新用户列表，确保在用户通过链接加入房间后能尽快获取到当前房间的用户信息
        this.refreshUsersList();
    }

    // 更新场景数据
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateScene(scene: any, isHost: boolean): void {
        // 只有房主或用户有编辑权限时才能发送场景更新
        const currentUser = this.connectedUsers.find((user) => user.id === this.userId);
        if (isHost || (currentUser && currentUser.canEdit)) {
            this.send('update_scene', { scene });
        } else {
            console.warn('没有编辑权限，无法发送场景更新');
        }
    }

    sendSceneAction(action: unknown): void {
        this.send('scene_action', { action });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendSceneSnapshot(scene: any, seq: number): void {
        this.send('scene_snapshot', { scene, seq });
    }

    // 设置用户名
    setUserName(name: string): void {
        this.send('set_user_name', { name });
    }

    setUserProfile(profile: { name?: string; avatar?: string | null }): void {
        this.send('set_user_profile', profile);
    }

    // 发送聊天消息
    sendChatMessage(message: string): void {
        this.send('chat_message', { message });
    }

    // 移交房主权限
    transferHost(newHostId: string): void {
        this.send('transfer_host', { newHostId });
    }

    // 设置用户编辑权限
    setUserEditPermission(userId: string, canEdit: boolean): void {
        this.send('set_user_edit_permission', { userId, canEdit });

        // 延迟一小段时间后刷新用户列表，确保服务器已经处理了权限变更
        setTimeout(() => {
            this.refreshUsersList();
        }, 300);
    }

    // 主动刷新用户列表
    refreshUsersList(): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // 添加请求ID以便追踪响应
            const requestId = Date.now();
            this.send('refresh_users_list', { request_id: requestId });
        } else {
            console.error('WebSocket未连接，无法刷新用户列表');
            // 尝试重新连接
            if (!this.isConnecting && this.ws?.readyState !== WebSocket.OPEN) {
                this.connect(this.currentUrl).catch((error) => {
                    this.error('刷新用户列表时重连失败:', error);
                });
            }
        }
        // 同时更新本地用户列表状态，确保UI及时反映最新变化
        this.trigger('users_updated', this.connectedUsers);
    }

    // 添加事件监听器
    on(event: string, callback: (data: unknown) => void): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    // 移除事件监听器
    off(event: string, callback: (data: unknown) => void): void {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event)!;
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    // 触发事件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private trigger(event: string, data?: any): void {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event)!;
            listeners.forEach((callback) => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`处理事件 ${event} 的回调时出错:`, error);
                }
            });
        }
    }

    // 获取当前状态
    getStatus(): {
        connected: boolean;
        userId: string;
        userName: string;
        roomId: string;
        connectedUsers: Array<{ id: string; name: string; canEdit?: boolean; shortId?: number }>;
    } {
        return {
            connected: this.ws?.readyState === WebSocket.OPEN,
            userId: this.userId,
            userName: this.userName,
            roomId: this.roomId,
            connectedUsers: this.connectedUsers,
        };
    }
}

// 导出单例实例
export const webSocketService = new WebSocketService();

export default WebSocketService;
