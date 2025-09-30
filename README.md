# Deepfake Detection Dashboard

A comprehensive dashboard system for detecting and analyzing deepfake media from MySQL database sources.

## System Architecture

- **Frontend**: React TypeScript application with Ant Design UI
- **Backend**: Node.js Express API server
- **Database**: MySQL for storing deepfake media metadata and statistics
- **AI Integration**: Google Gemini API for fallback data generation

## Features

### Database Protocol
- **MySQL Integration**: Connects to MySQL database containing deepfake media links
- **RESTful API**: Comprehensive API endpoints for data retrieval
- **Real-time Analytics**: Live statistics and trend analysis
- **Security**: Rate limiting, input validation, and CORS protection

### Dashboard Features
- **Date Range Filtering**: Analyze deepfake detection over time periods
- **Media Type Filtering**: Separate analysis for photos and videos
- **Confidence Scoring**: Sort and filter by detection confidence levels
- **Platform Analytics**: Statistics by source platform (Weibo, Douyin, etc.)
- **Top Rankings**: Highest confidence deepfake detections
- **Verification Status**: Track verified vs unverified detections

## Setup Instructions

### 1. Database Setup

1. Install MySQL and create the database:
```sql
mysql -u root -p
source database_schema.sql
```

2. The schema includes:
   - `deepfake_media` table for storing media metadata
   - `detection_stats` table for daily statistics
   - Sample data for testing

### 2. Backend Setup

1. Install backend dependencies:
```bash
npm install express mysql2 cors dotenv helmet express-rate-limit joi
npm install -g nodemon  # for development
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=deepfake_detection
DB_PORT=3306
PORT=3001
NODE_ENV=development
```

4. Start the backend server:
```bash
# Development mode
nodemon server.js

# Production mode
node server.js
```

The API will be available at `http://localhost:3001`

### 3. Frontend Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Create frontend environment file:
```bash
echo "REACT_APP_API_URL=http://localhost:3001/api" > .env.local
```

3. Start the React development server:
```bash
npm start
```

The dashboard will be available at `http://localhost:3000`

## API Endpoints

### Core Endpoints

- `GET /api/health` - Health check and database connectivity
- `GET /api/deepfakes` - Get deepfake media with filters
- `GET /api/stats` - Get detection statistics by date range
- `GET /api/rankings` - Get top deepfakes by confidence score
- `GET /api/platforms` - Get platform-specific statistics

### Query Parameters

#### `/api/deepfakes`
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `mediaType`: 'photo', 'video', or 'all' (default: 'all')
- `limit`: Number of results (1-1000, default: 100)
- `offset`: Pagination offset (default: 0)
- `minConfidence`: Minimum confidence score (0-1, default: 0)
- `platform`: Filter by source platform
- `verified`: Filter by verification status (true/false)

#### `/api/rankings`
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `mediaType`: 'photo', 'video', or 'all' (default: 'all')
- `limit`: Number of results (1-50, default: 10)

## Database Schema

### deepfake_media Table
- `id`: Primary key
- `media_type`: 'photo' or 'video'
- `media_url`: Link to the deepfake media
- `thumbnail_url`: Thumbnail image URL
- `title`: Media title/description
- `confidence_score`: AI detection confidence (0-1)
- `detection_method`: Algorithm used for detection
- `source_platform`: Platform where media was found
- `upload_date`: Original upload timestamp
- `detected_date`: When deepfake was detected
- `is_verified`: Manual verification status
- `tags`: JSON array of tags
- `metadata`: Additional technical metadata

### detection_stats Table
- `date`: Date of statistics
- `deepfake_photos_count`: Number of deepfake photos detected
- `deepfake_videos_count`: Number of deepfake videos detected
- `total_analyzed_photos`: Total photos analyzed
- `total_analyzed_videos`: Total videos analyzed
- `avg_confidence_score`: Average confidence score

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configurable allowed origins
- **SQL Injection Protection**: Parameterized queries
- **Helmet.js**: Security headers and protections

## Data Integration

The system replaces the previous mock data generation with real database queries:

1. **Date Range Selection**: Triggers API calls to fetch real deepfake data
2. **Statistics Generation**: Real-time calculation from database records
3. **Ranking Lists**: Actual deepfake media sorted by confidence scores
4. **Platform Analytics**: Aggregated statistics by source platform

## Error Handling

- **Database Errors**: Graceful fallback with error messages
- **Network Errors**: Retry mechanisms and user notifications
- **Validation Errors**: Clear error messages for invalid inputs
- **Rate Limiting**: User-friendly rate limit notifications

## Performance Considerations

- **Connection Pooling**: MySQL connection pool for efficient database access
- **Query Optimization**: Indexed columns for fast searches
- **Pagination**: Limit result sets to prevent memory issues
- **Caching**: Future enhancement for frequently accessed data

## Development

### Adding New Endpoints

1. Add route handler in `server.js`
2. Add validation schema using Joi
3. Create database query in `database.js`
4. Add TypeScript interface in `deepfakeAPI.ts`
5. Update frontend components to use new data

### Testing

```bash
# Test database connection
curl http://localhost:3001/api/health

# Test deepfake data retrieval
curl "http://localhost:3001/api/deepfakes?startDate=2024-01-01&endDate=2024-01-31"

# Test statistics
curl "http://localhost:3001/api/stats?startDate=2024-01-01&endDate=2024-01-31"
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database credentials
3. Set up reverse proxy (nginx)
4. Enable SSL/TLS
5. Configure monitoring and logging
6. Set up database backups

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL service is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **API Endpoints Not Found**
   - Check backend server is running on correct port
   - Verify `REACT_APP_API_URL` environment variable

3. **Empty Data Results**
   - Check date range includes sample data
   - Verify database has been populated with sample data
   - Check API query parameters

4. **CORS Errors**
   - Ensure frontend URL is in CORS whitelist
   - Check environment configuration