// Notification center component with badge and history
import React, { useState } from 'react';
import { Badge, Drawer, List, Button, Empty, Tag, Space, Tooltip } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export interface Notification {
  id: string;
  type: 'high_confidence' | 'spike' | 'verified' | 'platform';
  title: string;
  message: string;
  timestamp: string;
  data?: any;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNotificationClick,
}) => {
  const [drawerVisible, setDrawerVisible] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'high_confidence':
        return '🚨';
      case 'spike':
        return '📈';
      case 'verified':
        return '✅';
      case 'platform':
        return '📱';
      default:
        return '🔔';
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical':
        return '#e74c3c';
      case 'high':
        return '#f39c12';
      case 'medium':
        return '#3498db';
      case 'low':
        return '#95a5a6';
      default:
        return '#95a5a6';
    }
  };

  const getPriorityLabel = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical':
        return '紧急';
      case 'high':
        return '重要';
      case 'medium':
        return '中等';
      case 'low':
        return '低';
      default:
        return '';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  return (
    <>
      {/* Bell Icon with Badge */}
      <Tooltip title="通知中心">
        <Badge count={unreadCount} offset={[-5, 5]}>
          <Button
            type="text"
            onClick={() => setDrawerVisible(true)}
            style={{
              fontSize: 24,
              color: '#fff',
              padding: '4px 12px',
            }}
          >
            🔔
          </Button>
        </Badge>
      </Tooltip>

      {/* Notification Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔔 通知中心</span>
            <Space>
              {unreadCount > 0 && (
                <Button size="small" type="link" onClick={onMarkAllAsRead}>
                  全部标记已读
                </Button>
              )}
              {notifications.length > 0 && (
                <Button size="small" type="link" danger onClick={onClearAll}>
                  清空全部
                </Button>
              )}
            </Space>
          </div>
        }
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={400}
        styles={{
          body: { padding: 0, background: '#0f1630' },
          header: { background: '#1f2433', borderBottom: '1px solid #2a3b6f', color: '#fff' },
        }}
      >
        {notifications.length === 0 ? (
          <Empty
            description="暂无通知"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 100, color: '#95a5a6' }}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  cursor: 'pointer',
                  background: notification.read ? '#1f2433' : '#2a3b6f',
                  borderBottom: '1px solid #2a3b6f',
                  padding: '12px 16px',
                  transition: 'background 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#3a4b7f';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notification.read ? '#1f2433' : '#2a3b6f';
                }}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{ fontSize: 28 }}>
                      {getNotificationIcon(notification.type)}
                    </div>
                  }
                  title={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#fff', fontWeight: notification.read ? 400 : 600 }}>
                        {notification.title}
                      </span>
                      <Tag color={getPriorityColor(notification.priority)} style={{ margin: 0 }}>
                        {getPriorityLabel(notification.priority)}
                      </Tag>
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ color: '#aaa', marginBottom: 4 }}>
                        {notification.message}
                      </div>
                      <div style={{ color: '#95a5a6', fontSize: 12 }}>
                        {dayjs(notification.timestamp).fromNow()}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
            style={{ background: '#0f1630' }}
          />
        )}
      </Drawer>
    </>
  );
};

export default NotificationCenter;
export type { Notification };