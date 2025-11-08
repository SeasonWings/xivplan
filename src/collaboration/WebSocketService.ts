// WebSocket服务用于管理与服务器的实时通信
class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectInterval = 2000;
    private maxReconnectDelay = 10000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private eventListeners: Map<string, Array<(data: any) => void>> = new Map();
    private isConnecting = false;
    private userId: string = '';
    private userName: string = '';
    private roomId: string = '';
    private connectedUsers: Array<{ id: string; name: string }> = [];

    // 初始化WebSocket连接
    private currentUrl: string = 'ws://localhost:8680';

    connect(serverUrl: string = 'ws://localhost:8680'): Promise<void> {
        return new Promise((resolve, reject) => {
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
            this.currentUrl = serverUrl;

            try {
                this.ws = new WebSocket(serverUrl);

                this.ws.onopen = () => {
                    console.log('WebSocket连接已建立');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.trigger('connected');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('解析WebSocket消息失败:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket错误:', error);
                    this.isConnecting = false;
                    reject(error);
                };

                // 连接关闭时的处理
                this.ws.onclose = (event) => {
                    console.log(`WebSocket连接关闭: ${event.code} ${event.reason}`);
                    this.isConnecting = false;
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
                reject(error);
            }
        });
    }

    // 断开连接
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            // 使用正常关闭代码
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }

        this.isConnecting = false;
        this.reconnectAttempts = 0;
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

            console.log(
                `尝试重新连接... (第 ${this.reconnectAttempts}/${this.maxReconnectAttempts} 次，延迟 ${delay}ms)`,
            );

            this.reconnectTimer = setTimeout(() => {
                if (!this.isConnecting && !this.ws?.OPEN) {
                    this.connect(this.currentUrl).catch((error) => {
                        console.error('重连失败:', error);
                    });
                }
                this.reconnectTimer = null;
            }, delay);
        } else {
            console.error('达到最大重连次数，停止重连');
            this.trigger('disconnected');
        }
    }

    // 处理接收到的消息
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
                this.trigger('scene_sync', data.data);
                break;

            case 'scene_update':
                this.trigger('scene_update', {
                    data: data.data,
                    senderId: data.senderId,
                });
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

            case 'guest_edit_permission_changed':
                // 触发访客编辑权限变更事件
                this.trigger('guest_edit_permission_changed', data);
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

    // 发送消息到服务器
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

    // 加入房间
    joinRoom(roomId?: string): void {
        this.send('join_room', { roomId });
    }

    // 更新场景数据
    updateScene(scene: any, isHost: boolean, allowGuestEdit: boolean): void {
        // 只有房主或允许访客编辑时才能发送场景更新
        if (isHost || allowGuestEdit) {
            this.send('update_scene', { scene });
        }
    }

    // 设置用户名
    setUserName(name: string): void {
        this.send('set_user_name', { name });
    }

    // 发送聊天消息
    sendChatMessage(message: string): void {
        this.send('chat_message', { message });
    }

    // 移交房主权限
    transferHost(newHostId: string): void {
        this.send('transfer_host', { newHostId });
    }

    // 设置访客编辑权限
    setGuestEdit(allowEdit: boolean): void {
        this.send('set_guest_edit', { allowEdit });
    }

    // 添加事件监听器
    on(event: string, callback: (data: any) => void): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    // 移除事件监听器
    off(event: string, callback: (data: any) => void): void {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event)!;
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    // 触发事件
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
        connectedUsers: Array<{ id: string; name: string }>;
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
