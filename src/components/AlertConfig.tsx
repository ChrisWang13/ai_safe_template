// Alert configuration component
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Switch,
  Slider,
  Select,
  InputNumber,
  Button,
  Space,
  Divider,
  message,
  Tooltip,
} from 'antd';

export interface AlertSettings {
  enabled: boolean;
  minConfidence: number; // 0-100
  checkInterval: number; // minutes
  platforms: string[];
  verifiedOnly: boolean;
  enableSound: boolean;
  enableBrowserNotifications: boolean;
  spikeDetection: boolean;
  spikeThreshold: number; // percentage
}

interface AlertConfigProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: AlertSettings) => void;
  availablePlatforms: string[];
  currentSettings?: AlertSettings;
}

const DEFAULT_SETTINGS: AlertSettings = {
  enabled: true,
  minConfidence: 90,
  checkInterval: 5,
  platforms: [],
  verifiedOnly: false,
  enableSound: true,
  enableBrowserNotifications: true,
  spikeDetection: true,
  spikeThreshold: 50,
};

const AlertConfig: React.FC<AlertConfigProps> = ({
  visible,
  onClose,
  onSave,
  availablePlatforms,
  currentSettings,
}) => {
  const [settings, setSettings] = useState<AlertSettings>(
    currentSettings || DEFAULT_SETTINGS
  );

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  const handleSave = () => {
    // Validate settings
    if (settings.minConfidence < 0 || settings.minConfidence > 100) {
      message.error('置信度必须在 0-100 之间');
      return;
    }

    if (settings.checkInterval < 1 || settings.checkInterval > 60) {
      message.error('检查间隔必须在 1-60 分钟之间');
      return;
    }

    // Request browser notification permission if enabled
    if (settings.enableBrowserNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            message.success('浏览器通知已启用');
          } else {
            message.warning('浏览器通知权限被拒绝');
          }
        });
      }
    }

    onSave(settings);
    message.success('警报设置已保存');
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    message.info('已重置为默认设置');
  };

  const marks = {
    0: '0%',
    50: '50%',
    80: '80%',
    90: '90%',
    100: '100%',
  };

  return (
    <Modal
      title="⚙️ 警报配置"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={
        <Space>
          <Button onClick={handleReset}>重置默认</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            保存设置
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Enable/Disable Alerts */}
        <Card size="small" title="主开关">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>启用实时警报</span>
            <Switch
              checked={settings.enabled}
              onChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>
        </Card>

        {/* Confidence Threshold */}
        <Card size="small" title="置信度阈值">
          <div style={{ marginBottom: 8 }}>
            <Tooltip title="只警报置信度高于此值的检测">
              <span>最低置信度: {settings.minConfidence}%</span>
            </Tooltip>
          </div>
          <Slider
            min={0}
            max={100}
            marks={marks}
            value={settings.minConfidence}
            onChange={(value) => setSettings({ ...settings, minConfidence: value })}
            disabled={!settings.enabled}
          />
        </Card>

        {/* Check Interval */}
        <Card size="small" title="检查频率">
          <Space>
            <span>每</span>
            <InputNumber
              min={1}
              max={60}
              value={settings.checkInterval}
              onChange={(value) =>
                setSettings({ ...settings, checkInterval: value || 5 })
              }
              disabled={!settings.enabled}
            />
            <span>分钟检查一次</span>
          </Space>
        </Card>

        {/* Platform Filter */}
        <Card size="small" title="平台筛选">
          <Tooltip title="留空则监控所有平台">
            <Select
              mode="multiple"
              placeholder="选择要监控的平台（留空=全部）"
              value={settings.platforms}
              onChange={(value) => setSettings({ ...settings, platforms: value })}
              style={{ width: '100%' }}
              allowClear
              disabled={!settings.enabled}
            >
              {availablePlatforms.map((platform) => (
                <Select.Option key={platform} value={platform}>
                  {platform}
                </Select.Option>
              ))}
            </Select>
          </Tooltip>
        </Card>

        {/* Additional Filters */}
        <Card size="small" title="额外筛选">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>仅警报已验证的检测</span>
              <Switch
                checked={settings.verifiedOnly}
                onChange={(checked) => setSettings({ ...settings, verifiedOnly: checked })}
                disabled={!settings.enabled}
              />
            </div>
          </Space>
        </Card>

        {/* Spike Detection */}
        <Card size="small" title="异常激增检测">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>启用激增检测</span>
              <Switch
                checked={settings.spikeDetection}
                onChange={(checked) => setSettings({ ...settings, spikeDetection: checked })}
                disabled={!settings.enabled}
              />
            </div>
            {settings.spikeDetection && (
              <div style={{ marginTop: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <span>激增阈值: 比平均值高 {settings.spikeThreshold}%</span>
                </div>
                <Slider
                  min={20}
                  max={200}
                  value={settings.spikeThreshold}
                  onChange={(value) => setSettings({ ...settings, spikeThreshold: value })}
                  marks={{ 20: '20%', 50: '50%', 100: '100%', 200: '200%' }}
                  disabled={!settings.enabled}
                />
              </div>
            )}
          </Space>
        </Card>

        <Divider />

        {/* Notification Methods */}
        <Card size="small" title="通知方式">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tooltip title="在应用内显示通知">
                <span>应用内通知</span>
              </Tooltip>
              <Switch checked disabled />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tooltip title="使用浏览器原生通知（需授权）">
                <span>浏览器通知</span>
              </Tooltip>
              <Switch
                checked={settings.enableBrowserNotifications}
                onChange={(checked) =>
                  setSettings({ ...settings, enableBrowserNotifications: checked })
                }
                disabled={!settings.enabled}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tooltip title="警报时播放提示音">
                <span>声音提示</span>
              </Tooltip>
              <Switch
                checked={settings.enableSound}
                onChange={(checked) => setSettings({ ...settings, enableSound: checked })}
                disabled={!settings.enabled}
              />
            </div>
          </Space>
        </Card>
      </Space>
    </Modal>
  );
};

export default AlertConfig;
export type { AlertSettings };