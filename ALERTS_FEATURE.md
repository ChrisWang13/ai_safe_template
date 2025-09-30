# Real-time Alerts & Notifications System

## Overview
This document describes the Real-time Alerts & Notifications System added to the deepfake detection dashboard. The system provides proactive monitoring and immediate notifications for critical deepfake detections.

## Architecture

### Backend Components

#### 1. Alert Check Endpoint: `/api/alerts/check`
**Purpose**: Check for new high-confidence detections and anomalies

**Parameters**:
- `minConfidence` (optional): Minimum confidence threshold (0-1, default: 0.9)
- `lastCheckTime` (optional): ISO timestamp of last check
- `platforms` (optional): Comma-separated platform names
- `verifiedOnly` (optional): Filter for verified detections only

**Response**:
```json
{
  "alerts": [...],
  "totalAlerts": 5,
  "spikeDetected": true,
  "spikeInfo": {
    "todayCount": 150,
    "avgCount": 80,
    "percentIncrease": 87
  },
  "checkTime": "2024-01-15T10:30:00Z"
}
```

**Features**:
- Returns new detections since last check
- Calculates spike detection (today's count vs 7-day average)
- Supports platform and verification filtering
- Defaults to last 24 hours if no lastCheckTime provided

#### 2. Recent Monitoring Endpoint: `/api/monitoring/recent`
**Purpose**: Get summary statistics for recent detections

**Parameters**:
- `hours` (optional): Time window in hours (1-168, default: 24)

**Response**:
```json
{
  "period": "Last 24 hours",
  "summary": {
    "total_count": 120,
    "photo_count": 80,
    "video_count": 40,
    "avg_confidence": 0.85,
    "max_confidence": 0.98,
    "high_confidence_count": 45
  },
  "platforms": [
    { "source_platform": "Weibo", "count": 60 },
    { "source_platform": "Douyin", "count": 40 }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Frontend Components

#### 1. AlertConfig Component (`src/components/AlertConfig.tsx`)

**Purpose**: Configuration modal for alert settings

**Features**:
- **Main Switch**: Enable/disable entire alert system
- **Confidence Threshold**: Slider (0-100%) for minimum alert confidence
- **Check Interval**: How often to poll for new alerts (1-60 minutes)
- **Platform Filter**: Select specific platforms to monitor
- **Verified Only**: Toggle to only alert on verified detections
- **Spike Detection**: Enable/disable anomaly detection
- **Spike Threshold**: Percentage increase to trigger spike alert (20-200%)
- **Notification Methods**:
  - In-app notifications (always enabled)
  - Browser notifications (requires permission)
  - Sound alerts (customizable)

**Settings Persistence**: Saved to localStorage as `alertSettings`

**Props**:
```typescript
interface AlertConfigProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: AlertSettings) => void;
  availablePlatforms: string[];
  currentSettings?: AlertSettings;
}
```

#### 2. NotificationCenter Component (`src/components/NotificationCenter.tsx`)

**Purpose**: Display notification history with badge counter

**Features**:
- **Badge Counter**: Shows unread notification count
- **Drawer Interface**: Side panel with notification list
- **Notification Cards**: Rich display with:
  - Type icon (🚨 high confidence, 📈 spike, ✅ verified, 📱 platform)
  - Priority tag (critical/high/medium/low)
  - Title and message
  - Relative timestamp ("3 minutes ago")
  - Read/unread status
- **Actions**:
  - Mark individual as read (click)
  - Mark all as read
  - Clear all notifications
- **Empty State**: Friendly message when no notifications

**Props**:
```typescript
interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNotificationClick?: (notification: Notification) => void;
}
```

**Notification Structure**:
```typescript
interface Notification {
  id: string;
  type: 'high_confidence' | 'spike' | 'verified' | 'platform';
  title: string;
  message: string;
  timestamp: string;
  data?: any;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

#### 3. useAlertMonitoring Hook (`src/hooks/useAlertMonitoring.ts`)

**Purpose**: Custom React hook for alert monitoring logic

**Features**:
- **Automatic Polling**: Checks API at configured intervals
- **Notification Management**: Add, read, clear notifications
- **Browser Notifications**: Integrates with Notification API
- **Sound Alerts**: Plays synthesized alert sounds
- **Persistence**: Stores notifications in localStorage
- **Auto-start/stop**: Monitors when enabled, stops when disabled

**Returns**:
```typescript
{
  notifications: Notification[];
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  checkAlerts: () => Promise<void>;
}
```

**Logic Flow**:
1. Load stored settings and notifications on mount
2. Auto-start if enabled
3. Poll API every `checkInterval` minutes
4. Process alerts and create notifications
5. Show browser notification if enabled
6. Play sound if enabled
7. Display in-app message for critical/high priority
8. Store notification history
9. Auto-stop on disable or unmount

#### 4. Notification Utilities (`src/utils/notificationUtils.ts`)

**Purpose**: Helper functions for notification handling

**Functions**:

1. **`requestNotificationPermission()`**
   - Request browser notification permission
   - Returns: NotificationPermission

2. **`showBrowserNotification(options)`**
   - Display browser notification
   - Auto-close after 10 seconds (unless critical)
   - Returns: Notification object

3. **`playNotificationSound(soundType)`**
   - Synthesize and play alert sound
   - Types: 'alert', 'warning', 'info'
   - Uses Web Audio API

4. **`formatAlertMessage(type, data)`**
   - Format alert data into display message
   - Returns: { title, message, priority }

5. **`storeNotification()` / `loadNotifications()`**
   - Persist notifications to localStorage
   - Limit to 100 most recent

6. **`generateNotificationId()`**
   - Create unique notification ID

## User Interface

### Header Controls

**Alert Settings Button**:
- Default state: "⚙️ 警报设置" (gray)
- Active state: "⚡ 监控中" (green)
- Click to open configuration modal

**Notification Bell**:
- Shows badge with unread count
- Click to open notification drawer
- Red badge for attention

### Configuration Modal

**Sections**:
1. Main Switch
2. Confidence Threshold (slider with marks)
3. Check Frequency (input: 1-60 minutes)
4. Platform Filter (multi-select dropdown)
5. Additional Filters (verified only toggle)
6. Spike Detection (toggle + threshold slider)
7. Notification Methods (3 toggles)

**Actions**:
- Reset to defaults
- Cancel (no save)
- Save settings

### Notification Drawer

**Header**:
- Title: "🔔 通知中心"
- "全部标记已读" button
- "清空全部" button (danger)

**Content**:
- List of notifications (newest first)
- Hover effects for interactivity
- Click to mark as read
- Color-coded by read status
- Priority tags with colors

## Alert Types

### 1. High Confidence Detection
**Trigger**: New detections above confidence threshold

**Example**:
```
Title: 🚨 高置信度检测
Message: 发现 5 个高置信度深度伪造内容（置信度 ≥ 90%）
Priority: critical
```

### 2. Spike Detection
**Trigger**: Today's count > (7-day average × spike threshold)

**Example**:
```
Title: 📈 检测量激增
Message: 今日检测量 150 个，比平均值高 87%
Priority: high
```

### 3. Verified Detection
**Trigger**: New verified deepfakes (if enabled)

**Example**:
```
Title: ✅ 新增已验证内容
Message: 发现 3 个新的已验证深度伪造内容
Priority: medium
```

### 4. Platform-specific Alert
**Trigger**: High activity on specific platform

**Example**:
```
Title: 📱 Weibo 平台警报
Message: Weibo 平台发现 10 个新检测
Priority: medium
```

## Sound Design

### Alert Sound (Critical)
- Frequency: 880 Hz (A5)
- Duration: 300ms
- Volume: 0.3 → 0.01 (exponential decay)

### Warning Sound (High)
- Frequency: 440 Hz (A4)
- Duration: 500ms
- Volume: 0.3 → 0.01 (exponential decay)

### Info Sound (Medium/Low)
- Frequency: 523 Hz (C5)
- Duration: 200ms
- Volume: 0.2 → 0.01 (exponential decay)

## Browser Notification

### Permission Flow
1. User enables browser notifications in settings
2. Modal requests permission via Notification API
3. If granted: notifications appear system-wide
4. If denied: warning message, falls back to in-app only

### Notification Options
- Title: Alert type and priority
- Body: Detailed message
- Icon: App logo (logo192.png)
- Badge: App badge icon
- Tag: "deepfake-alert" (replaces previous)
- Require Interaction: True for critical, false otherwise
- Auto-close: 10 seconds for non-critical

### Compatibility
- Supported: Chrome, Firefox, Edge, Safari 16+
- Not supported: iOS Safari < 16, older browsers
- Graceful fallback to in-app notifications

## Data Storage

### localStorage Keys

1. **`alertSettings`**: Alert configuration
```json
{
  "enabled": true,
  "minConfidence": 90,
  "checkInterval": 5,
  "platforms": ["Weibo"],
  "verifiedOnly": false,
  "enableSound": true,
  "enableBrowserNotifications": true,
  "spikeDetection": true,
  "spikeThreshold": 50
}
```

2. **`notifications`**: Notification history (max 100)
```json
[
  {
    "id": "notif_1642234567890_abc123",
    "type": "high_confidence",
    "title": "🚨 高置信度检测",
    "message": "发现 5 个高置信度深度伪造内容",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {...},
    "read": false,
    "priority": "critical"
  }
]
```

## Performance Considerations

### Polling Strategy
- Default interval: 5 minutes (user configurable: 1-60)
- API timeout: 60 seconds
- Error handling: Silent fail, retry next interval
- No exponential backoff (simple periodic polling)

### Memory Management
- Max 100 notifications stored
- Old notifications pruned automatically
- Cleanup on component unmount
- Clear interval timers properly

### Network Optimization
- Only fetch new alerts (using lastCheckTime)
- Limit to 50 alerts per response
- Conditional requests based on user settings
- No polling when monitoring disabled

## Security & Privacy

### Permissions
- Browser notifications require user consent
- Audio playback doesn't require permission
- localStorage accessible only to this app

### Data Privacy
- No alert data sent to external servers
- Notifications stored locally only
- Can be cleared by user anytime
- No tracking or analytics on alerts

## Testing Scenarios

### Basic Functionality
1. Enable monitoring → Should start polling
2. Disable monitoring → Should stop polling
3. Change interval → Should restart with new interval
4. Adjust confidence → Should filter alerts correctly

### Alert Triggers
1. High confidence detection → Should create notification
2. Spike detection → Should calculate and alert correctly
3. Platform filter → Should only alert for selected platforms
4. Verified only → Should respect filter

### Notifications
1. Browser notification → Should show (if permission granted)
2. Sound alert → Should play appropriate sound
3. In-app notification → Should always show
4. Mark as read → Should update state
5. Clear all → Should empty list

### Edge Cases
1. No internet → Should handle gracefully
2. API error → Should retry next interval
3. No new alerts → Should not spam notifications
4. Browser tab inactive → Should still monitor
5. Multiple tabs → Each monitors independently

## Future Enhancements

### Phase 2 Features
1. **WebSocket Support**: Real-time push instead of polling
2. **Email Notifications**: Server-side email alerts
3. **Webhook Integration**: Send to external systems
4. **Alert Rules Engine**: Complex conditional logic
5. **Notification Grouping**: Combine similar alerts
6. **Snooze Functionality**: Temporarily silence alerts
7. **Alert History Dashboard**: Visualize alert trends
8. **Export Alert Logs**: Download alert history
9. **Custom Sound Upload**: User-provided alert sounds
10. **Mobile App Notifications**: Native mobile alerts

### Performance Optimizations
1. Server-sent events (SSE) for efficient real-time updates
2. Background service worker for offline monitoring
3. Smart polling (increase interval when no activity)
4. Batch notification display (prevent notification spam)

## API Usage Examples

### Check for alerts
```bash
GET /api/alerts/check?minConfidence=0.9&lastCheckTime=2024-01-15T09:00:00Z&platforms=Weibo,Douyin
```

### Get recent statistics
```bash
GET /api/monitoring/recent?hours=24
```

### Response handling
```typescript
const response = await fetch('/api/alerts/check?...');
const data = await response.json();

if (data.totalAlerts > 0) {
  // Process high-confidence alerts
  data.alerts.forEach(alert => {
    // Create notification
  });
}

if (data.spikeDetected) {
  // Show spike alert
}
```

## Troubleshooting

### Notifications not showing
1. Check monitoring is enabled
2. Verify confidence threshold isn't too high
3. Ensure browser notification permission granted
4. Check browser console for errors
5. Verify API endpoint responding

### Sound not playing
1. Check "声音提示" toggle enabled
2. Verify browser audio not muted
3. Check for browser audio policy restrictions
4. Test on user interaction (click something first)

### Alerts not triggering
1. Check API has data matching criteria
2. Verify lastCheckTime is recent
3. Ensure spike threshold not too high
4. Check platform filter settings
5. Verify database has recent detections

### Performance issues
1. Reduce check interval (increase minutes)
2. Add platform filters to reduce data
3. Increase confidence threshold
4. Clear old notifications
5. Check network connection stability