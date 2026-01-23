export interface CommunityPlan {
    share_id: string;
    title: string;
    description: string;
    author: string;
    author_id?: string;
    author_avatar?: string;
    scene_data: string;
    thumbnail?: string;
    game: string; // 游戏大类
    category: string; // 子分类
    dungeon_name?: string;
    tags?: string[];
    view_count: number;
    download_count: number;
    like_count: number;
    comment_count?: number; // 评论数
    user_liked?: boolean; // 当前用户是否已点赞
    created_at: string;
    updated_at: string;
}

export interface UploadPlanData {
    title: string;
    description?: string;
    author: string;
    authorId?: string;
    sceneData: string;
    thumbnail?: string;
    game: string; // 游戏大类
    category: string; // 子分类
    dungeonName?: string;
    tags?: string[];
}

// 评论相关类型
export interface Comment {
    id: number;
    share_id: string;
    user_id: string;
    user_name: string;
    user_avatar?: string;
    content: string;
    parent_id?: number;
    reply_to_user_id?: string;
    reply_to_user_name?: string;
    created_at: string;
    updated_at: string;
    replies?: Comment[]; // 回复列表
    replyCount?: number; // 回复总数
}

export interface CommentListResponse {
    success: boolean;
    data: Comment[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface CreateCommentData {
    content: string;
    parentId?: number;
    replyToUserId?: string;
    replyToUserName?: string;
}
