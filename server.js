const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.API_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'deepfake_detection',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
});

// Validation schemas
const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  mediaType: Joi.string().valid('photo', 'video', 'all').default('all'),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0),
  minConfidence: Joi.number().min(0).max(1).default(0),
  platform: Joi.string().optional(),
  verified: Joi.boolean().optional()
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT 1 as health');
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// Get deepfake media data with filters
app.get('/api/deepfakes', async (req, res) => {
  try {
    const { error, value } = dateRangeSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate, mediaType, limit, offset, minConfidence, platform, verified } = value;

    let query = `
      SELECT
        id, media_type, media_url, thumbnail_url, title, description,
        confidence_score, detection_method, source_platform, upload_date,
        detected_date, file_size_mb, duration_seconds, resolution,
        is_verified, tags, metadata
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
        AND confidence_score >= ?
    `;

    const queryParams = [startDate, endDate, minConfidence];

    if (mediaType !== 'all') {
      query += ' AND media_type = ?';
      queryParams.push(mediaType);
    }

    if (platform) {
      query += ' AND source_platform = ?';
      queryParams.push(platform);
    }

    if (verified !== undefined) {
      query += ' AND is_verified = ?';
      queryParams.push(verified);
    }

    query += ' ORDER BY detected_date DESC, confidence_score DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const [rows] = await pool.execute(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
        AND confidence_score >= ?
    `;
    const countParams = [startDate, endDate, minConfidence];

    if (mediaType !== 'all') {
      countQuery += ' AND media_type = ?';
      countParams.push(mediaType);
    }

    if (platform) {
      countQuery += ' AND source_platform = ?';
      countParams.push(platform);
    }

    if (verified !== undefined) {
      countQuery += ' AND is_verified = ?';
      countParams.push(verified);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    console.error('Error fetching deepfakes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get detection statistics by date range
app.get('/api/stats', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate } = value;

    const [rows] = await pool.execute(`
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

    // Also get aggregated real-time stats from deepfake_media table
    const [aggregatedStats] = await pool.execute(`
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

    res.json({
      historical_stats: rows,
      realtime_stats: aggregatedStats
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get deepfake rankings by confidence score
app.get('/api/rankings', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
      mediaType: Joi.string().valid('photo', 'video', 'all').default('all'),
      limit: Joi.number().integer().min(1).max(50).default(10)
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate, mediaType, limit } = value;

    let query = `
      SELECT
        ROW_NUMBER() OVER (ORDER BY confidence_score DESC, detected_date DESC) as rank,
        id, media_type, media_url, thumbnail_url, title, description,
        confidence_score, detection_method, source_platform, upload_date,
        detected_date, is_verified, tags
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
    `;

    const queryParams = [startDate, endDate];

    if (mediaType !== 'all') {
      query += ' AND media_type = ?';
      queryParams.push(mediaType);
    }

    query += ' ORDER BY confidence_score DESC, detected_date DESC LIMIT ?';
    queryParams.push(limit);

    const [rows] = await pool.execute(query, queryParams);

    res.json({
      rankings: rows,
      period: { startDate, endDate },
      mediaType
    });

  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get platform statistics
app.get('/api/platforms', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate } = value;

    const [rows] = await pool.execute(`
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

    res.json({
      platforms: rows,
      period: { startDate, endDate }
    });

  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to convert data to CSV format
function convertToCSV(data, headers) {
  if (!data || data.length === 0) return '';

  const csvHeaders = headers.join(',');
  const csvRows = data.map(row =>
    headers.map(header => {
      const value = row[header];
      // Handle null/undefined, escape quotes, wrap strings with commas
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}

// Export deepfakes data
app.get('/api/export/deepfakes', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
      format: Joi.string().valid('csv', 'json').default('csv'),
      mediaType: Joi.string().valid('photo', 'video', 'all').default('all'),
      minConfidence: Joi.number().min(0).max(1).default(0)
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate, format, mediaType, minConfidence } = value;

    let query = `
      SELECT
        id, media_type, media_url, title, description,
        confidence_score, detection_method, source_platform,
        DATE_FORMAT(upload_date, '%Y-%m-%d %H:%i:%s') as upload_date,
        DATE_FORMAT(detected_date, '%Y-%m-%d %H:%i:%s') as detected_date,
        is_verified
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
        AND confidence_score >= ?
    `;

    const queryParams = [startDate, endDate, minConfidence];

    if (mediaType !== 'all') {
      query += ' AND media_type = ?';
      queryParams.push(mediaType);
    }

    query += ' ORDER BY detected_date DESC, confidence_score DESC';

    const [rows] = await pool.execute(query, queryParams);

    if (format === 'csv') {
      const headers = [
        'id', 'media_type', 'media_url', 'title', 'description',
        'confidence_score', 'detection_method', 'source_platform',
        'upload_date', 'detected_date', 'is_verified'
      ];
      const csv = convertToCSV(rows, headers);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=deepfakes_${startDate}_${endDate}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=deepfakes_${startDate}_${endDate}.json`);
      res.json({
        exportDate: new Date().toISOString(),
        period: { startDate, endDate },
        filters: { mediaType, minConfidence },
        totalRecords: rows.length,
        data: rows
      });
    }

  } catch (error) {
    console.error('Error exporting deepfakes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export statistics data
app.get('/api/export/stats', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
      format: Joi.string().valid('csv', 'json').default('csv')
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate, format } = value;

    // Get aggregated statistics
    const [stats] = await pool.execute(`
      SELECT
        DATE(detected_date) as date,
        COUNT(CASE WHEN media_type = 'photo' THEN 1 END) as photos_count,
        COUNT(CASE WHEN media_type = 'video' THEN 1 END) as videos_count,
        AVG(confidence_score) as avg_confidence,
        COUNT(*) as total_count,
        COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified_count
      FROM deepfake_media
      WHERE detected_date BETWEEN ? AND ?
      GROUP BY DATE(detected_date)
      ORDER BY date ASC
    `, [startDate, endDate]);

    if (format === 'csv') {
      const headers = ['date', 'photos_count', 'videos_count', 'avg_confidence', 'total_count', 'verified_count'];
      const csv = convertToCSV(stats, headers);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=stats_${startDate}_${endDate}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=stats_${startDate}_${endDate}.json`);
      res.json({
        exportDate: new Date().toISOString(),
        period: { startDate, endDate },
        totalDays: stats.length,
        data: stats
      });
    }

  } catch (error) {
    console.error('Error exporting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search deepfakes by keyword
app.get('/api/search', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      query: Joi.string().min(1).required(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
      mediaType: Joi.string().valid('photo', 'video', 'all').default('all'),
      minConfidence: Joi.number().min(0).max(1).default(0),
      platform: Joi.string().optional(),
      verified: Joi.boolean().optional(),
      limit: Joi.number().integer().min(1).max(100).default(50)
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { query: searchQuery, startDate, endDate, mediaType, minConfidence, platform, verified, limit } = value;

    let query = `
      SELECT
        id, media_type, media_url, thumbnail_url, title, description,
        confidence_score, detection_method, source_platform, upload_date,
        detected_date, is_verified, tags
      FROM deepfake_media
      WHERE (title LIKE ? OR description LIKE ? OR tags LIKE ?)
        AND confidence_score >= ?
    `;

    const searchPattern = `%${searchQuery}%`;
    const queryParams = [searchPattern, searchPattern, searchPattern, minConfidence];

    if (startDate && endDate) {
      query += ' AND detected_date BETWEEN ? AND ?';
      queryParams.push(startDate, endDate);
    }

    if (mediaType !== 'all') {
      query += ' AND media_type = ?';
      queryParams.push(mediaType);
    }

    if (platform) {
      query += ' AND source_platform = ?';
      queryParams.push(platform);
    }

    if (verified !== undefined) {
      query += ' AND is_verified = ?';
      queryParams.push(verified);
    }

    query += ' ORDER BY confidence_score DESC, detected_date DESC LIMIT ?';
    queryParams.push(limit);

    const [rows] = await pool.execute(query, queryParams);

    res.json({
      results: rows,
      query: searchQuery,
      total: rows.length
    });

  } catch (error) {
    console.error('Error searching deepfakes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get list of available platforms
app.get('/api/platforms/list', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT source_platform
      FROM deepfake_media
      WHERE source_platform IS NOT NULL
      ORDER BY source_platform ASC
    `);

    res.json({
      platforms: rows.map(row => row.source_platform)
    });

  } catch (error) {
    console.error('Error fetching platform list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check for new alerts based on criteria
app.get('/api/alerts/check', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      minConfidence: Joi.number().min(0).max(1).default(0.9),
      lastCheckTime: Joi.date().iso().optional(),
      platforms: Joi.string().optional(), // comma-separated platforms
      verifiedOnly: Joi.boolean().optional()
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { minConfidence, lastCheckTime, platforms, verifiedOnly } = value;

    // Query for new high-confidence detections
    let query = `
      SELECT
        id, media_type, media_url, title, confidence_score,
        source_platform, detected_date, is_verified
      FROM deepfake_media
      WHERE confidence_score >= ?
    `;

    const queryParams = [minConfidence];

    if (lastCheckTime) {
      query += ' AND detected_date > ?';
      queryParams.push(lastCheckTime);
    } else {
      // Default to last 24 hours if no lastCheckTime provided
      query += ' AND detected_date > DATE_SUB(NOW(), INTERVAL 24 HOUR)';
    }

    if (platforms) {
      const platformList = platforms.split(',');
      query += ` AND source_platform IN (${platformList.map(() => '?').join(',')})`;
      queryParams.push(...platformList);
    }

    if (verifiedOnly) {
      query += ' AND is_verified = 1';
    }

    query += ' ORDER BY detected_date DESC, confidence_score DESC LIMIT 50';

    const [alerts] = await pool.execute(query, queryParams);

    // Get daily statistics for spike detection
    const [dailyStats] = await pool.execute(`
      SELECT
        DATE(detected_date) as date,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM deepfake_media
      WHERE detected_date >= DATE_SUB(NOW(), INTERVAL 7 DAYS)
      GROUP BY DATE(detected_date)
      ORDER BY date DESC
    `);

    // Calculate if there's a spike (today's count > 150% of 7-day average)
    let spikeDetected = false;
    let spikeInfo = null;

    if (dailyStats.length > 1) {
      const todayCount = dailyStats[0].count;
      const avgCount = dailyStats.slice(1).reduce((sum, stat) => sum + stat.count, 0) / (dailyStats.length - 1);

      if (todayCount > avgCount * 1.5) {
        spikeDetected = true;
        spikeInfo = {
          todayCount,
          avgCount: Math.round(avgCount),
          percentIncrease: Math.round(((todayCount - avgCount) / avgCount) * 100)
        };
      }
    }

    res.json({
      alerts,
      totalAlerts: alerts.length,
      spikeDetected,
      spikeInfo,
      checkTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent statistics for monitoring
app.get('/api/monitoring/recent', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      hours: Joi.number().integer().min(1).max(168).default(24)
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { hours } = value;

    const [recentDetections] = await pool.execute(`
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN media_type = 'photo' THEN 1 END) as photo_count,
        COUNT(CASE WHEN media_type = 'video' THEN 1 END) as video_count,
        AVG(confidence_score) as avg_confidence,
        MAX(confidence_score) as max_confidence,
        COUNT(CASE WHEN confidence_score >= 0.9 THEN 1 END) as high_confidence_count
      FROM deepfake_media
      WHERE detected_date >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    `, [hours]);

    const [platformBreakdown] = await pool.execute(`
      SELECT
        source_platform,
        COUNT(*) as count
      FROM deepfake_media
      WHERE detected_date >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      GROUP BY source_platform
      ORDER BY count DESC
      LIMIT 5
    `, [hours]);

    res.json({
      period: `Last ${hours} hours`,
      summary: recentDetections[0],
      platforms: platformBreakdown,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export platform statistics
app.get('/api/export/platforms', async (req, res) => {
  try {
    const { error, value } = Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
      format: Joi.string().valid('csv', 'json').default('csv')
    }).validate(req.query);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { startDate, endDate, format } = value;

    const [platforms] = await pool.execute(`
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

    if (format === 'csv') {
      const headers = ['source_platform', 'total_count', 'photos_count', 'videos_count', 'avg_confidence', 'max_confidence', 'verified_count'];
      const csv = convertToCSV(platforms, headers);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=platforms_${startDate}_${endDate}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=platforms_${startDate}_${endDate}.json`);
      res.json({
        exportDate: new Date().toISOString(),
        period: { startDate, endDate },
        totalPlatforms: platforms.length,
        data: platforms
      });
    }

  } catch (error) {
    console.error('Error exporting platform stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Deepfake detection API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;