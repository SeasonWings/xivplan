CREATE TABLE IF NOT EXISTS `user_assets` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `asset_url` TEXT NOT NULL COMMENT '资源URL',
  `asset_type` VARCHAR(50) DEFAULT 'image' COMMENT '资源类型',
  `file_name` VARCHAR(255) COMMENT '原始文件名',
  `file_size` INT UNSIGNED COMMENT '文件大小(字节)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户自定义资源表';
