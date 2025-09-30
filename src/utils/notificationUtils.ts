// Utility functions for browser notifications and alerts

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Show browser notification
 */
export function showBrowserNotification(options: BrowserNotificationOptions): Notification | null {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return null;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/logo192.png',
      badge: options.icon || '/logo192.png',
      tag: options.tag || 'deepfake-alert',
      requireInteraction: options.requireInteraction || false,
      silent: false,
    });

    // Auto-close after 10 seconds unless requireInteraction is true
    if (!options.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 10000);
    }

    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
}

/**
 * Play notification sound
 */
export function playNotificationSound(soundType: 'alert' | 'warning' | 'info' = 'alert') {
  try {
    // Create audio context for sound synthesis
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set sound characteristics based on type
    switch (soundType) {
      case 'alert':
        oscillator.frequency.value = 880; // A5
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        break;

      case 'warning':
        oscillator.frequency.value = 440; // A4
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        break;

      case 'info':
        oscillator.frequency.value = 523; // C5
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
    }
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
}

/**
 * Generate unique notification ID
 */
export function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if browser notifications are supported
 */
export function isBrowserNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Get notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Format alert message for display
 */
export function formatAlertMessage(
  type: string,
  data: any
): { title: string; message: string; priority: 'low' | 'medium' | 'high' | 'critical' } {
  switch (type) {
    case 'high_confidence':
      return {
        title: '🚨 高置信度检测',
        message: `发现 ${data.count || 1} 个高置信度深度伪造内容（置信度 ≥ ${(data.minConfidence * 100).toFixed(0)}%）`,
        priority: 'critical',
      };

    case 'spike':
      return {
        title: '📈 检测量激增',
        message: `今日检测量 ${data.todayCount} 个，比平均值高 ${data.percentIncrease}%`,
        priority: 'high',
      };

    case 'verified':
      return {
        title: '✅ 新增已验证内容',
        message: `发现 ${data.count || 1} 个新的已验证深度伪造内容`,
        priority: 'medium',
      };

    case 'platform':
      return {
        title: `📱 ${data.platform} 平台警报`,
        message: `${data.platform} 平台发现 ${data.count || 1} 个新检测`,
        priority: 'medium',
      };

    default:
      return {
        title: '🔔 新通知',
        message: '系统检测到新的异常情况',
        priority: 'low',
      };
  }
}

/**
 * Store notification in localStorage
 */
export function storeNotification(notification: any) {
  try {
    const stored = localStorage.getItem('notifications');
    const notifications = stored ? JSON.parse(stored) : [];
    notifications.unshift(notification);

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }

    localStorage.setItem('notifications', JSON.stringify(notifications));
  } catch (error) {
    console.error('Failed to store notification:', error);
  }
}

/**
 * Load notifications from localStorage
 */
export function loadNotifications(): any[] {
  try {
    const stored = localStorage.getItem('notifications');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load notifications:', error);
    return [];
  }
}

/**
 * Clear all notifications from localStorage
 */
export function clearNotifications() {
  try {
    localStorage.removeItem('notifications');
  } catch (error) {
    console.error('Failed to clear notifications:', error);
  }
}