-- Database schema for deepfake media detection system
CREATE DATABASE IF NOT EXISTS deepfake_detection;
USE deepfake_detection;

-- Table for storing deepfake media links and metadata
CREATE TABLE deepfake_media (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_type ENUM('photo', 'video') NOT NULL,
    media_url VARCHAR(2048) NOT NULL,
    thumbnail_url VARCHAR(2048),
    title VARCHAR(500),
    description TEXT,
    confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
    detection_method VARCHAR(100),
    source_platform VARCHAR(100),
    upload_date DATETIME,
    detected_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_size_mb DECIMAL(10,2),
    duration_seconds INT, -- for videos only
    resolution VARCHAR(20), -- e.g. "1920x1080"
    is_verified BOOLEAN DEFAULT FALSE,
    tags JSON, -- flexible tagging system
    metadata JSON, -- additional technical metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_media_type (media_type),
    INDEX idx_detected_date (detected_date),
    INDEX idx_confidence_score (confidence_score),
    INDEX idx_source_platform (source_platform),
    INDEX idx_is_verified (is_verified)
);

-- Table for tracking detection statistics by date
CREATE TABLE detection_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date DATE NOT NULL,
    deepfake_photos_count INT DEFAULT 0,
    deepfake_videos_count INT DEFAULT 0,
    total_analyzed_photos INT DEFAULT 0,
    total_analyzed_videos INT DEFAULT 0,
    avg_confidence_score DECIMAL(5,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_date (date)
);

-- Insert sample data for testing
INSERT INTO deepfake_media (media_type, media_url, thumbnail_url, title, description, confidence_score, detection_method, source_platform, upload_date, file_size_mb, duration_seconds, resolution, is_verified, tags) VALUES
('photo', 'https://example.com/deepfake1.jpg', 'https://example.com/thumb1.jpg', '明星换脸图片被检测为深度伪造', '使用AI技术检测出的深度伪造图片', 0.9234, 'FaceSwap_Detector_v2', 'weibo', '2024-01-15 10:30:00', 2.5, NULL, '1024x768', TRUE, '["celebrity", "faceswap", "verified"]'),
('video', 'https://example.com/deepfake1.mp4', 'https://example.com/thumb1_video.jpg', '政治人物虚假演讲视频', '检测到的包含政治人物的深度伪造视频', 0.8756, 'DeepFake_Detector_v3', 'douyin', '2024-01-16 14:20:00', 45.8, 120, '1920x1080', TRUE, '["political", "speech", "verified"]'),
('photo', 'https://example.com/deepfake2.jpg', 'https://example.com/thumb2.jpg', '虚假新闻配图', '伴随虚假新闻传播的AI生成图片', 0.7891, 'StyleGAN_Detector', 'wechat', '2024-01-17 09:15:00', 1.8, NULL, '800x600', FALSE, '["news", "generated", "unverified"]'),
('video', 'https://example.com/deepfake2.mp4', 'https://example.com/thumb2_video.jpg', '虚假产品广告视频', '使用深度伪造技术制作的产品广告', 0.9012, 'FaceSwap_Detector_v2', 'xiaohongshu', '2024-01-18 16:45:00', 23.4, 60, '1280x720', FALSE, '["advertisement", "product", "commercial"]'),
('photo', 'https://example.com/deepfake3.jpg', 'https://example.com/thumb3.jpg', '社交媒体虚假身份图片', '用于创建虚假社交媒体账户的AI生成头像', 0.8543, 'GAN_Detector_v1', 'weibo', '2024-01-19 11:30:00', 0.9, NULL, '512x512', TRUE, '["profile", "identity", "generated"]');

-- Insert sample statistics
INSERT INTO detection_stats (date, deepfake_photos_count, deepfake_videos_count, total_analyzed_photos, total_analyzed_videos, avg_confidence_score) VALUES
('2024-01-15', 15, 8, 150, 45, 0.8234),
('2024-01-16', 23, 12, 189, 67, 0.8456),
('2024-01-17', 18, 6, 167, 34, 0.7891),
('2024-01-18', 31, 15, 234, 78, 0.8678),
('2024-01-19', 27, 9, 201, 52, 0.8123);