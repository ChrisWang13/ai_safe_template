// Export button component with format selection
import React, { useState } from 'react';
import { Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { exportViaAPI } from '../utils/exportUtils';

// Simple download icon using Unicode
const DownloadIcon = () => <span>⬇</span>;

export interface ExportButtonProps {
  exportType: 'deepfakes' | 'stats' | 'platforms';
  startDate: string;
  endDate: string;
  filters?: Record<string, any>;
  disabled?: boolean;
  buttonText?: string;
  style?: React.CSSProperties;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  exportType,
  startDate,
  endDate,
  filters = {},
  disabled = false,
  buttonText = '导出数据',
  style
}) => {
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  const handleExport = async (format: 'csv' | 'json') => {
    if (!startDate || !endDate) {
      message.warning('请先选择日期范围');
      return;
    }

    setLoading(true);

    try {
      const endpoint = `${API_BASE_URL}/export/${exportType}`;
      const params = {
        startDate,
        endDate,
        format,
        ...filters
      };

      const filename = `${exportType}_${startDate}_${endDate}.${format}`;

      await exportViaAPI(endpoint, params, filename);

      message.success(`${format.toUpperCase()} 文件导出成功`);
    } catch (error) {
      console.error('Export error:', error);
      message.error('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'csv',
      label: '导出为 CSV',
      onClick: () => handleExport('csv'),
    },
    {
      key: 'json',
      label: '导出为 JSON',
      onClick: () => handleExport('json'),
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} disabled={disabled || loading}>
      <Button
        type="primary"
        loading={loading}
        disabled={disabled}
        style={style}
      >
        {!loading && <DownloadIcon />} {buttonText}
      </Button>
    </Dropdown>
  );
};

export default ExportButton;