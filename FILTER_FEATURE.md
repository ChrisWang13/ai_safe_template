# Advanced Filtering & Search Feature

## Overview
This document describes the Advanced Filtering & Search UI feature added to the deepfake detection dashboard.

## Backend Changes

### New API Endpoints

#### 1. Search Endpoint: `/api/search`
- **Method**: GET
- **Purpose**: Search deepfakes by keyword in title, description, or tags
- **Parameters**:
  - `query` (required): Search keyword
  - `startDate` (optional): Start date filter
  - `endDate` (optional): End date filter
  - `mediaType` (optional): 'photo', 'video', or 'all'
  - `minConfidence` (optional): Minimum confidence score (0-1)
  - `platform` (optional): Source platform filter
  - `verified` (optional): Verification status filter
  - `limit` (optional): Max results (default: 50)

- **Response**:
```json
{
  "results": [...],
  "query": "search term",
  "total": 10
}
```

#### 2. Platform List Endpoint: `/api/platforms/list`
- **Method**: GET
- **Purpose**: Get list of all available platforms
- **Response**:
```json
{
  "platforms": ["Weibo", "Douyin", "WeChat", ...]
}
```

## Frontend Components

### 1. FilterPanel Component (`src/components/FilterPanel.tsx`)

**Features**:
- **Keyword Search**: Full-text search in titles, descriptions, and tags
- **Confidence Score Slider**: Range slider (0-100%) with visual marks
- **Platform Multi-selector**: Select multiple platforms to filter
- **Media Type Selector**: Filter by photo, video, or all
- **Verification Toggle**: Show only verified deepfakes
- **Collapsible Panel**: Expand/collapse to save screen space

**Filter Presets**:
- Save current filter configuration with custom name
- Load saved presets instantly
- Delete presets with double-click
- Stored in browser localStorage
- Persists across sessions

**Props**:
```typescript
interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
  availablePlatforms?: string[];
  style?: React.CSSProperties;
}
```

**Filter State**:
```typescript
interface FilterState {
  searchQuery: string;
  confidenceRange: [number, number];
  platforms: string[];
  mediaType: 'all' | 'photo' | 'video';
  verifiedOnly: boolean | undefined;
}
```

### 2. Search Results Table

**Display**:
- Shows when search query is active
- Columns: Media Type, Title, Confidence, Platform, Date, Verified
- Color-coded confidence scores:
  - Red (>80%): High confidence
  - Orange (50-80%): Medium confidence
  - Green (<50%): Low confidence
- Sortable by confidence score
- Pagination (10 items per page)
- Dark theme styling

### 3. API Service Updates (`src/services/deepfakeAPI.ts`)

Added methods:
```typescript
deepfakeAPI.search(params) // Search deepfakes
deepfakeAPI.getPlatformList() // Get available platforms
```

## User Workflows

### Basic Search
1. Expand filter panel (click "展开")
2. Enter search term in "关键词搜索"
3. Click search icon or press Enter
4. Results appear in table below filter panel

### Advanced Filtering
1. Set confidence range using slider
2. Select one or more platforms
3. Choose media type (photo/video/all)
4. Toggle "仅显示已验证" for verified only
5. Click "应用筛选" to apply all filters

### Using Filter Presets
1. Configure desired filters
2. Enter preset name in input field
3. Click "保存预设"
4. Load preset by clicking its button
5. Delete preset by double-clicking

### Combined Filtering
- All filters work together
- Search query + filters = narrowed results
- Date range from main date picker also applies
- Real-time result count feedback

## Technical Implementation

### State Management
- Filter state managed in App.tsx
- Separate state for search mode vs. normal mode
- Platform list loaded on component mount
- Filter changes trigger API calls

### Data Flow
1. User adjusts filters → `handleFilterChange()` called
2. If search query exists → API search request
3. Results filtered client-side for additional criteria
4. Search results displayed in dedicated table
5. Success/error messages via Ant Design message API

### Performance Optimizations
- Client-side filtering for multi-platform selection
- Debounced search (via Enter key or search button)
- Limited result sets (50 max by default)
- Lazy loading of platform list

## Styling

### Dark Theme Consistency
- Background: `#1f2433`
- Borders: `#2a3b6f`
- Text: `#fff` (white)
- Inputs: `#2a2f3e`
- Accent colors match existing dashboard

### Responsive Layout
- Filter panel uses Ant Design Grid (Row/Col)
- Mobile-friendly with responsive spacing
- Tags use `maxTagCount="responsive"`

## Storage

### localStorage Keys
- `filterPresets`: Array of saved filter presets

### Data Structure
```json
{
  "name": "High Confidence Weibo",
  "filters": {
    "searchQuery": "",
    "confidenceRange": [80, 100],
    "platforms": ["Weibo"],
    "mediaType": "all",
    "verifiedOnly": true
  }
}
```

## Future Enhancements

Potential improvements:
1. Export filtered results directly
2. Share filter presets via URL
3. Advanced query syntax (AND/OR/NOT)
4. Filter by date range within search
5. Recent searches history
6. Popular filter suggestions
7. Batch operations on filtered results
8. Custom column visibility in results table

## Testing Checklist

- [ ] Search returns relevant results
- [ ] Confidence slider filters correctly
- [ ] Multi-platform selection works
- [ ] Media type filter applies properly
- [ ] Verified-only toggle functions
- [ ] Presets save and load correctly
- [ ] Reset button clears all filters
- [ ] UI responsive on mobile
- [ ] Error handling for failed API calls
- [ ] Empty states display properly
- [ ] Performance acceptable with large datasets

## API Examples

### Search with filters
```bash
GET /api/search?query=deepfake&startDate=2024-01-01&endDate=2024-01-31&mediaType=photo&minConfidence=0.8&platform=Weibo&verified=true
```

### Get platforms
```bash
GET /api/platforms/list
```

### Response format
```json
{
  "results": [
    {
      "id": 1,
      "media_type": "photo",
      "title": "Suspected deepfake image",
      "confidence_score": 0.92,
      "source_platform": "Weibo",
      "detected_date": "2024-01-15",
      "is_verified": true
    }
  ],
  "query": "deepfake",
  "total": 1
}
```
