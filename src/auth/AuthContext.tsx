import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { config } from '../config';

interface User {
    id: string;
    username: string;
    email: string;
    avatar?: string | null;
    bio?: string | null;
    role: string;
    isVerified: boolean;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthAction {
    type: string;
    payload?: {
        user?: User;
        token?: string;
    };
}

interface AuthContextType {
    state: AuthState;
    login: (identifier: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string, verificationCode: string) => Promise<void>;
    logout: () => void;
    updateUserProfile: (profileData: Partial<User>) => Promise<void>;
    refreshToken: () => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    verifyPasswordResetCode: (email: string, code: string) => Promise<void>;
    resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
    switch (action.type) {
        case 'LOADING_START':
            return { ...state, isLoading: true };
        case 'LOADING_END':
            return { ...state, isLoading: false };
        case 'LOGIN_SUCCESS':
            return {
                ...state,
                user: action.payload?.user ?? null,
                token: action.payload?.token ?? null,
                isAuthenticated: true,
                isLoading: false,
            };
        case 'LOGOUT':
            return {
                ...initialState,
                isLoading: false,
            };
        case 'SET_USER':
            return {
                ...state,
                user: action.payload?.user ?? null,
                token: action.payload?.token ?? state.token, // 保留现有token或使用新token
                isAuthenticated: !!action.payload?.user,
                isLoading: false,
            };
        case 'UPDATE_PROFILE':
            return {
                ...state,
                user: state.user ? { ...state.user, ...action.payload?.user } : null,
            };
        default:
            return state;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // 检查本地存储中的令牌并在页面加载时恢复会话
    useEffect(() => {
        const token = localStorage.getItem('xivplan_auth_token');
        const user = localStorage.getItem('xivplan_user');

        console.log('AuthProvider init', { hasToken: !!token, hasUser: !!user });

        if (token && user) {
            dispatch({
                type: 'SET_USER',
                payload: {
                    user: JSON.parse(user),
                    token: token,
                },
            });

            // 验证令牌仍然有效
            validateTokenAndRefresh(token);
        } else {
            dispatch({ type: 'LOADING_END' });
        }
    }, []);

    const validateTokenAndRefresh = async (token: string) => {
        try {
            const response = await fetch(`${config.api.baseUrl}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    // 更新用户信息
                    dispatch({
                        type: 'SET_USER',
                        payload: {
                            user: data.user,
                        },
                    });
                    return true;
                }
            }
        } catch (error) {
            console.error('Token validation failed:', error);
        }

        // 如果验证失败，清除本地存储
        localStorage.removeItem('xivplan_auth_token');
        localStorage.removeItem('xivplan_user');
        dispatch({ type: 'LOGOUT' });
        return false;
    };

    const login = async (identifier: string, password: string) => {
        dispatch({ type: 'LOADING_START' });

        try {
            const response = await fetch(`${config.api.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifier, password }), // identifier 可以是用户名或邮箱
            });

            const data = await response.json();

            if (data.success && data.token && data.user) {
                // 保存令牌和用户信息到本地存储
                localStorage.setItem('xivplan_auth_token', data.token);
                localStorage.setItem('xivplan_user', JSON.stringify(data.user));

                dispatch({
                    type: 'LOGIN_SUCCESS',
                    payload: {
                        user: data.user,
                        token: data.token,
                    },
                });

                return;
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error: unknown) {
            dispatch({ type: 'LOADING_END' });
            throw error;
        }
    };

    const register = async (username: string, email: string, password: string, verificationCode: string) => {
        dispatch({ type: 'LOADING_START' });

        try {
            const response = await fetch(`${config.api.baseUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, verificationCode }),
            });

            const data = await response.json();

            if (data.success && data.token && data.user) {
                // 保存令牌和用户信息到本地存储
                localStorage.setItem('xivplan_auth_token', data.token);
                localStorage.setItem('xivplan_user', JSON.stringify(data.user));

                dispatch({
                    type: 'LOGIN_SUCCESS',
                    payload: {
                        user: data.user,
                        token: data.token,
                    },
                });

                return;
            } else {
                throw new Error(data.error || 'Registration failed');
            }
        } catch (error: unknown) {
            dispatch({ type: 'LOADING_END' });
            throw error;
        }
    };

    const logout = async () => {
        const token = localStorage.getItem('xivplan_auth_token');

        // 尝试调用后端登出API将令牌加入黑名单
        if (token) {
            try {
                await fetch(`${config.api.baseUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
            } catch (error) {
                console.error('Logout API call failed:', error);
                // 即使API调用失败，也要清除本地状态
            }
        }

        // 清除本地存储
        localStorage.removeItem('xivplan_auth_token');
        localStorage.removeItem('xivplan_user');

        dispatch({ type: 'LOGOUT' });
    };

    const updateUserProfile = async (profileData: Partial<User>) => {
        const token = localStorage.getItem('xivplan_auth_token');

        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${config.api.baseUrl}/auth/profile`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData),
        });

        const data = await response.json();

        if (data.success && data.user) {
            // 更新本地存储中的用户信息
            localStorage.setItem('xivplan_user', JSON.stringify(data.user));

            dispatch({
                type: 'UPDATE_PROFILE',
                payload: {
                    user: data.user,
                },
            });

            return data.user;
        } else {
            throw new Error(data.error || 'Failed to update profile');
        }
    };

    const refreshToken = async () => {
        // 实现刷新令牌逻辑（如果需要）
        // 这里可以根据需要实现令牌刷新机制
    };

    const requestPasswordReset = async (email: string) => {
        const response = await fetch(`${config.api.baseUrl}/auth/request-reset-password-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to send reset password code');
        }
    };

    const verifyPasswordResetCode = async (email: string, code: string) => {
        const response = await fetch(`${config.api.baseUrl}/auth/verify-reset-password-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, code }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Invalid or expired verification code');
        }
    };

    const resetPassword = async (email: string, code: string, newPassword: string) => {
        const response = await fetch(`${config.api.baseUrl}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, code, newPassword }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to reset password');
        }
    };

    const value = {
        state,
        login,
        register,
        logout,
        updateUserProfile,
        refreshToken,
        requestPasswordReset,
        verifyPasswordResetCode,
        resetPassword,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
