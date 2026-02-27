-- XIVPlan 完整数据库建表脚本
-- 包含所有必需的表结构

-- 删除已存在的表（注意：这会删除所有数据！）
DROP TABLE IF EXISTS `user_preferences`;
DROP TABLE IF EXISTS `blacklisted_tokens`;
DROP TABLE IF EXISTS `plan_reports`;
DROP TABLE IF EXISTS `plan_comments`;
DROP TABLE IF EXISTS `plan_likes`;
DROP TABLE IF EXISTS `plan_shares`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `verification_codes`;
DROP TABLE IF EXISTS `api_logs`;

-- 1. 用户表
CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '用户主键ID',
  `user_id` VARCHAR(64) UNIQUE NOT NULL COMMENT '用户唯一ID',
  `username` VARCHAR(100) UNIQUE NOT NULL COMMENT '用户名/昵称',
  `email` VARCHAR(255) UNIQUE COMMENT '用户邮箱',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希值',
  `avatar` MEDIUMTEXT COMMENT '用户头像URL或base64数据',
  `bio` TEXT COMMENT '用户简介',
  `role` ENUM('user', 'admin', 'moderator') DEFAULT 'user' COMMENT '用户角色',
  `is_verified` BOOLEAN DEFAULT FALSE COMMENT '邮箱验证状态',
  `last_login_at` TIMESTAMP NULL COMMENT '最后登录时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `email_verified` BOOLEAN DEFAULT FALSE COMMENT '邮箱是否已验证',
  `email_verification_sent_at` TIMESTAMP NULL COMMENT '邮箱验证邮件发送时间',
  INDEX `idx_username` (`username`),
  INDEX `idx_email` (`email`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 2. 战术板分享表
CREATE TABLE `plan_shares` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `share_id` VARCHAR(32) UNIQUE NOT NULL COMMENT '分享唯一标识',
  `title` VARCHAR(200) NOT NULL COMMENT '战术板标题',
  `description` TEXT COMMENT '战术板描述',
  `author` VARCHAR(100) NOT NULL COMMENT '作者名称',
  `author_id` VARCHAR(64) COMMENT '作者用户ID(可选)',
  `scene_data` MEDIUMTEXT NOT NULL COMMENT '场景JSON数据(压缩后)',
  `thumbnail` TEXT COMMENT '缩略图数据URL',
  `game` VARCHAR(50) DEFAULT 'ff14' COMMENT '游戏大类(ff14/zxsj等)',
  `category` VARCHAR(50) DEFAULT 'general' COMMENT '子分类(ff14_raid/ff14_ultimate/zxsj_nightmare等)',
  `dungeon_name` VARCHAR(100) COMMENT '副本名称',
  `tags` VARCHAR(500) COMMENT '标签(JSON数组)',
  `view_count` INT UNSIGNED DEFAULT 0 COMMENT '查看次数',
  `download_count` INT UNSIGNED DEFAULT 0 COMMENT '下载次数',
  `like_count` INT UNSIGNED DEFAULT 0 COMMENT '点赞数',
  `comment_count` INT UNSIGNED DEFAULT 0 COMMENT '评论数',
  `status` TINYINT DEFAULT 1 COMMENT '状态(0-已删除,1-正常,2-审核中)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_share_id` (`share_id`),
  INDEX `idx_game` (`game`),
  INDEX `idx_category` (`category`),
  INDEX `idx_game_category` (`game`, `category`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_view_count` (`view_count`),
  INDEX `idx_download_count` (`download_count`),
  INDEX `idx_like_count` (`like_count`),
  INDEX `idx_comment_count` (`comment_count`),
  INDEX `idx_status` (`status`),
  INDEX `idx_author_id` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='战术板分享表';

-- 3. 用户点赞记录表
CREATE TABLE `plan_likes` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `share_id` VARCHAR(32) NOT NULL COMMENT '分享ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  UNIQUE KEY `uk_share_user` (`share_id`, `user_id`),
  INDEX `idx_share_id` (`share_id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户点赞记录表';

-- 4. 评论表(支持回复功能)
CREATE TABLE `plan_comments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `share_id` VARCHAR(32) NOT NULL COMMENT '分享ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `user_name` VARCHAR(100) NOT NULL COMMENT '用户名',
  `user_avatar` TEXT COMMENT '用户头像',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `parent_id` INT UNSIGNED DEFAULT NULL COMMENT '父评论ID(回复功能)',
  `reply_to_user_id` VARCHAR(64) DEFAULT NULL COMMENT '回复的用户ID',
  `reply_to_user_name` VARCHAR(100) DEFAULT NULL COMMENT '回复的用户名',
  `status` TINYINT DEFAULT 1 COMMENT '状态(0-已删除,1-正常)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_share_id` (`share_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_parent_id` (`parent_id`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- 5. 报告记录表(用于举报不当内容)
CREATE TABLE `plan_reports` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `share_id` VARCHAR(32) NOT NULL COMMENT '分享ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '举报用户ID',
  `reason` VARCHAR(500) NOT NULL COMMENT '举报原因',
  `status` TINYINT DEFAULT 0 COMMENT '处理状态(0-待处理,1-已处理,2-已忽略)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_share_id` (`share_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报记录表';

-- 6. JWT令牌黑名单表（用于登出功能）
CREATE TABLE `blacklisted_tokens` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `token` TEXT NOT NULL COMMENT '被拉黑的JWT令牌',
  `expires_at` TIMESTAMP NOT NULL COMMENT '令牌过期时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_token` (`token`(100)),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='JWT令牌黑名单表';

-- 7. 用户偏好设置表（可选）
CREATE TABLE `user_preferences` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `preferences` JSON COMMENT '用户偏好设置JSON',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_user_prefs` (`user_id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户偏好设置表';

-- 邮件验证相关表结构

-- 1. 验证码表
CREATE TABLE `verification_codes` (
                                      `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
                                      `email` VARCHAR(255) NOT NULL COMMENT '接收验证码的邮箱',
                                      `code` VARCHAR(10) NOT NULL COMMENT '验证码(6位数字+4位字母)',
                                      `type` ENUM('register', 'reset_password', 'email_change') NOT NULL COMMENT '验证码类型',
                                      `expires_at` TIMESTAMP NOT NULL COMMENT '过期时间',
                                      `used` BOOLEAN DEFAULT FALSE COMMENT '是否已被使用',
                                      `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      `email_verified` BOOLEAN DEFAULT FALSE COMMENT '邮箱是否已验证',
                                      `email_verification_sent_at` TIMESTAMP NULL COMMENT '邮箱验证邮件发送时间',
                                      INDEX `idx_email` (`email`),
                                      INDEX `idx_code` (`code`),
                                      INDEX `idx_type` (`type`),
                                      INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码表';

-- 创建API日志表
CREATE TABLE `api_logs` (
                            `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '日志主键ID',
                            `request_id` VARCHAR(64) UNIQUE NOT NULL COMMENT '请求唯一ID',
                            `user_id` VARCHAR(64) COMMENT '用户ID（如果已认证）',
                            `method` VARCHAR(10) NOT NULL COMMENT 'HTTP方法(GET/POST/PUT/DELETE等)',
                            `url` VARCHAR(500) NOT NULL COMMENT '请求URL',
                            `route` VARCHAR(200) COMMENT '路由路径',
                            `ip_address` VARCHAR(45) COMMENT '请求IP地址',
                            `user_agent` VARCHAR(500) COMMENT '用户代理',
                            `request_headers` JSON COMMENT '请求头信息',
                            `request_params` JSON COMMENT '请求参数(query params)',
                            `request_body` JSON COMMENT '请求体(body)',
                            `response_status` INT COMMENT 'HTTP响应状态码',
                            `response_body` JSON COMMENT '响应体',
                            `error_message` TEXT COMMENT '错误信息（如果有）',
                            `error_stack` TEXT COMMENT '错误堆栈（如果有）',
                            `execution_time` INT COMMENT '执行时间(毫秒)',
                            `success` BOOLEAN DEFAULT TRUE COMMENT '是否成功',
                            `level` ENUM('info', 'warn', 'error', 'debug') DEFAULT 'info' COMMENT '日志级别',
                            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            INDEX `idx_request_id` (`request_id`),
                            INDEX `idx_user_id` (`user_id`),
                            INDEX `idx_method` (`method`),
                            INDEX `idx_route` (`route`),
                            INDEX `idx_created_at` (`created_at`),
                            INDEX `idx_success` (`success`),
                            INDEX `idx_level` (`level`),
                            INDEX `idx_response_status` (`response_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API接口日志表';

-- 创建索引以优化查询性能
CREATE INDEX `idx_created_at_user_id` ON `api_logs` (`created_at`, `user_id`);
CREATE INDEX `idx_route_created_at` ON `api_logs` (`route`, `created_at`);- -   "�&1�WY��]��t?  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   ` f e e d b a c k `   (  
     ` i d `   I N T   U N S I G N E D   A U T O _ I N C R E M E N T   P R I M A R Y   K E Y   C O M M E N T   ' Y��]��I D ' ,  
     ` u s e r _ i d `   V A R C H A R ( 6 4 )   C O M M E N T   ' "�&1�WI D ( �o�PIp�[,��j0�? ' ,  
     ` u s e r n a m e `   V A R C H A R ( 1 0 0 )   C O M M E N T   ' "�&1�WZ�? �o�PIp�[,��j0�? ' ,  
     ` c o n t e n t `   T E X T   N O T   N U L L   C O M M E N T   ' Y��]��P�mT��' ,  
     ` c o n t a c t _ i n f o `   V A R C H A R ( 2 5 5 )   C O M M E N T   ' q��e��pt!}' ,  
     ` t y p e `   E N U M ( ' s u g g e s t i o n ' ,   ' b u g ' ,   ' o t h e r ' )   D E F A U L T   ' s u g g e s t i o n '   C O M M E N T   ' Y��]���~�7p' ,  
     ` s t a t u s `   E N U M ( ' p e n d i n g ' ,   ' r e a d ' ,   ' r e s o l v e d ' ,   ' i g n o r e d ' )   D E F A U L T   ' p e n d i n g '   C O M M E N T   ' �o�R�`�5�� ? ,  
     ` a d m i n _ r e p l y `   T E X T   C O M M E N T   ' �~��`[�:jm�o? ,  
     ` c r e a t e d _ a t `   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P   C O M M E N T   ' R��mÓX�h' ,  
     ` u p d a t e d _ a t `   T I M E S T A M P   D E F A U L T   C U R R E N T _ T I M E S T A M P   O N   U P D A T E   C U R R E N T _ T I M E S T A M P   C O M M E N T   ' ǓX[�gÓX�h' ,  
     I N D E X   ` i d x _ u s e r _ i d `   ( ` u s e r _ i d ` ) ,  
     I N D E X   ` i d x _ s t a t u s `   ( ` s t a t u s ` ) ,  
     I N D E X   ` i d x _ c r e a t e d _ a t `   ( ` c r e a t e d _ a t ` )  
 )   E N G I N E = I n n o D B   D E F A U L T   C H A R S E T = u t f 8 m b 4   C O L L A T E = u t f 8 m b 4 _ u n i c o d e _ c i   C O M M E N T = ' "�&1�WY��]��t? ;  
 