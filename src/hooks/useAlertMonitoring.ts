// Custom hook for real-time alert monitoring
import { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import { AlertSettings } from '../components/AlertConfig';
import { Notification } from '../components/NotificationCenter';
import {
  showBrowserNotification,
  playNotificationSound,
  generateNotificationId,
  formatAlertMessage,
  storeNotification,
  loadNotifications,
} from '../utils/notificationUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface AlertCheckResponse {
  alerts: any[];
  totalAlerts: number;
  spikeDetected: boolean;
  spikeInfo: {
    todayCount: number;
    avgCount: number;
    percentIncrease: number;
  } | null;
  checkTime: string;
}

export function useAlertMonitoring(
  alertSettings: AlertSettings,
  availablePlatforms: string[]
) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load notifications from localStorage on mount
  useEffect(() => {
    const stored = loadNotifications();
    setNotifications(stored);
  }, []);

  // Add notification
  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      const updated = [notification, ...prev];
      storeNotification(notification);
      return updated;
    });

    // Show browser notification if enabled
    if (alertSettings.enableBrowserNotifications) {
      showBrowserNotification({
        title: notification.title,
        body: notification.message,
        requireInteraction: notification.priority === 'critical',
      });
    }

    // Play sound if enabled
    if (alertSettings.enableSound) {
      const soundType = notification.priority === 'critical' ? 'alert' :
                       notification.priority === 'high' ? 'warning' : 'info';
      playNotificationSound(soundType);
    }

    // Show in-app message
    if (notification.priority === 'critical' || notification.priority === 'high') {
      message.warning(`${notification.title}: ${notification.message}`, 5);
    }
  }, [alertSettings.enableBrowserNotifications, alertSettings.enableSound]);

  // Check for alerts
  const checkAlerts = useCallback(async () => {
    if (!alertSettings.enabled) {
      return;
    }

    try {
      const params = new URLSearchParams({
        minConfidence: (alertSettings.minConfidence / 100).toString(),
      });

      if (lastCheckTime) {
        params.append('lastCheckTime', lastCheckTime);
      }

      if (alertSettings.platforms.length > 0) {
        params.append('platforms', alertSettings.platforms.join(','));
      }

      if (alertSettings.verifiedOnly) {
        params.append('verifiedOnly', 'true');
      }

      const response = await fetch(`${API_BASE_URL}/alerts/check?${params}`);

      if (!response.ok) {
        throw new Error('Failed to check alerts');
      }

      const data: AlertCheckResponse = await response.json();

      // Process high-confidence alerts
      if (data.totalAlerts > 0) {
        const alertInfo = formatAlertMessage('high_confidence', {
          count: data.totalAlerts,
          minConfidence: alertSettings.minConfidence / 100,
        });

        addNotification({
          id: generateNotificationId(),
          type: 'high_confidence',
          title: alertInfo.title,
          message: alertInfo.message,
          timestamp: new Date().toISOString(),
          data: { alerts: data.alerts },
          read: false,
          priority: alertInfo.priority,
        });
      }

      // Process spike detection
      if (alertSettings.spikeDetection && data.spikeDetected && data.spikeInfo) {
        // Only trigger if spike exceeds user's threshold
        if (data.spikeInfo.percentIncrease >= alertSettings.spikeThreshold) {
          const spikeInfo = formatAlertMessage('spike', data.spikeInfo);

          addNotification({
            id: generateNotificationId(),
            type: 'spike',
            title: spikeInfo.title,
            message: spikeInfo.message,
            timestamp: new Date().toISOString(),
            data: data.spikeInfo,
            read: false,
            priority: spikeInfo.priority,
          });
        }
      }

      setLastCheckTime(data.checkTime);
    } catch (error) {
      console.error('Alert check failed:', error);
    }
  }, [alertSettings, lastCheckTime, addNotification]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!alertSettings.enabled) {
      return;
    }

    setIsMonitoring(true);

    // Initial check
    checkAlerts();

    // Set up interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      checkAlerts();
    }, alertSettings.checkInterval * 60 * 1000);

    message.success(`警报监控已启动，每 ${alertSettings.checkInterval} 分钟检查一次`);
  }, [alertSettings, checkAlerts]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    message.info('警报监控已停止');
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    message.success('已标记全部为已读');
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem('notifications');
    message.success('已清空所有通知');
  }, []);

  // Auto-start monitoring when settings change
  useEffect(() => {
    if (alertSettings.enabled && !isMonitoring) {
      startMonitoring();
    } else if (!alertSettings.enabled && isMonitoring) {
      stopMonitoring();
    }
  }, [alertSettings.enabled, isMonitoring, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    notifications,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    markAsRead,
    markAllAsRead,
    clearAll,
    checkAlerts,
  };
}