const mysql = require('mysql2/promise');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect(config = {}) {
    try {
      this.pool = mysql.createPool({
        host: config.host || process.env.DB_HOST || 'localhost',
        user: config.user || process.env.DB_USER || 'root',
        password: config.password || process.env.DB_PASSWORD || '',
        database: config.database || process.env.DB_NAME || 'deepfake_detection',
        port: config.port || process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: config.connectionLimit || 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000
      });

      // Test connection
      const [rows] = await this.pool.execute('SELECT 1 as test');
      this.isConnected = true;
      console.log('Database connected successfully');
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Database disconnected');
    }
  }

  // Get deepfake media with various filters
  async getDeepfakeMedia(filters = {}) {
    const {
      startDate,
      endDate,
      mediaType = 'all',
      limit = 100,
      offset = 0,
      minConfidence = 0,
      platform,
      verified
    } = filters;

    let query = `
      SELECT
        id, media_type, media_url, thumbnail_url, title, description,
        confidence_score, detection_method, source_platform, upload_date,
        detected_date, file_size_mb, duration_seconds, resolution,
        is_verified, tags, metadata
      FROM deepfake_media
      WHERE 1=1
    `;

    const params = [];

    if (startDate && endDate) {
      query += ' AND detected_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (minConfidence > 0) {
      query += ' AND confidence_score >= ?';
      params.push(minConfidence);
    }

    if (mediaType !== 'all') {
      query += ' AND media_type = ?';
      params.push(mediaType);
    }

    if (platform) {
      query += ' AND source_platform = ?';
      params.push(platform);
    }

    if (verified !== undefined) {
      query += ' AND is_verified = ?';
      params.push(verified);
    }

    query += ' ORDER BY detected_date DESC, confidence_score DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await this.pool.execute(query, params);
    return rows;
  }

  // Get detection statistics by date range
  async getDetectionStats(startDate, endDate) {
    const [rows] = await this.pool.execute(`
      SELECT
        date,
        deepfake_photos_count,
        deepfake_videos_count,
        total_analyzed_photos,
        total_analyzed_videos,
        avg_confidence_score
      FROM detection_stats
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC
    `, [startDate, endDate]);

    return rows;
  }

  // Get real-time aggregated stats from deepfake_media table
  async getRealTimeStats(startDate, endDate) {
    const [rows] = await this.pool.execute(`
      SELECT
        DATE(detected_date) as date,
        COUNT(CASE WHEN media_type = 'photo' THEN 1 END) as photos_count,
        COUNT(CASE WHEN media_type = 'video' THEN 1 END) as videos_count,
        AVG(confidence_score) as avg_confidence,
        COUNT(*) as total_count
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
      GROUP BY DATE(detected_date)
      ORDER BY date ASC
    `, [startDate, endDate]);

    return rows;
  }

  // Get top deepfakes by confidence score
  async getTopDeepfakes(startDate, endDate, mediaType = 'all', limit = 10) {
    let query = `
      SELECT
        id, media_type, media_url, thumbnail_url, title, description,
        confidence_score, detection_method, source_platform, upload_date,
        detected_date, is_verified, tags
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
    `;

    const params = [startDate, endDate];

    if (mediaType !== 'all') {
      query += ' AND media_type = ?';
      params.push(mediaType);
    }

    query += ' ORDER BY confidence_score DESC, detected_date DESC LIMIT ?';
    params.push(limit);

    const [rows] = await this.pool.execute(query, params);

    // Add rank to each row
    return rows.map((row, index) => ({
      ...row,
      rank: index + 1
    }));
  }

  // Get platform statistics
  async getPlatformStats(startDate, endDate) {
    const [rows] = await this.pool.execute(`
      SELECT
        source_platform,
        COUNT(*) as total_count,
        COUNT(CASE WHEN media_type = 'photo' THEN 1 END) as photos_count,
        COUNT(CASE WHEN media_type = 'video' THEN 1 END) as videos_count,
        AVG(confidence_score) as avg_confidence,
        MAX(confidence_score) as max_confidence,
        COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified_count
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
      GROUP BY source_platform
      ORDER BY total_count DESC
    `, [startDate, endDate]);

    return rows;
  }

  // Get summary statistics for a date range
  async getSummaryStats(startDate, endDate) {
    const [rows] = await this.pool.execute(`
      SELECT
        COUNT(*) as total_deepfakes,
        COUNT(CASE WHEN media_type = 'photo' THEN 1 END) as total_photos,
        COUNT(CASE WHEN media_type = 'video' THEN 1 END) as total_videos,
        AVG(confidence_score) as avg_confidence,
        MAX(confidence_score) as max_confidence,
        MIN(confidence_score) as min_confidence,
        COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified_count,
        COUNT(DISTINCT source_platform) as platforms_count
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
    `, [startDate, endDate]);

    return rows[0];
  }

  // Search deepfakes by title or description
  async searchDeepfakes(searchTerm, startDate = null, endDate = null, limit = 50) {
    let query = `
      SELECT
        id, media_type, media_url, thumbnail_url, title, description,
        confidence_score, detection_method, source_platform, upload_date,
        detected_date, is_verified, tags
      FROM deepfake_media
      WHERE (title LIKE ? OR description LIKE ?)
    `;

    const params = [`%${searchTerm}%`, `%${searchTerm}%`];

    if (startDate && endDate) {
      query += ' AND detected_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY confidence_score DESC, detected_date DESC LIMIT ?';
    params.push(limit);

    const [rows] = await this.pool.execute(query, params);
    return rows;
  }

  // Health check
  async healthCheck() {
    try {
      const [rows] = await this.pool.execute('SELECT 1 as health');
      return { status: 'healthy', connected: this.isConnected };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = DatabaseService;