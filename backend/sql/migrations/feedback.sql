-- 用户反馈表
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '反馈ID',
  `user_id` VARCHAR(64) COMMENT '用户ID(如果已登录)',
  `username` VARCHAR(100) COMMENT '用户名(如果已登录)',
  `content` TEXT NOT NULL COMMENT '反馈内容',
  `contact_info` VARCHAR(255) COMMENT '联系方式',
  `type` ENUM('suggestion', 'bug', 'other') DEFAULT 'suggestion' COMMENT '反馈类型',
  `status` ENUM('pending', 'read', 'resolved', 'ignored') DEFAULT 'pending' COMMENT '处理状态',
  `admin_reply` TEXT COMMENT '管理员回复',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户反馈表';
