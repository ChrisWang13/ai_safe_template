// Advanced filtering panel component
import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Slider,
  Select,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Divider,
  message,
  Tooltip,
} from 'antd';

const { Search } = Input;

export interface FilterState {
  searchQuery: string;
  confidenceRange: [number, number];
  platforms: string[];
  mediaType: 'all' | 'photo' | 'video';
  verifiedOnly: boolean | undefined;
}

export interface FilterPreset {
  name: string;
  filters: FilterState;
}

interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
  availablePlatforms?: string[];
  style?: React.CSSProperties;
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  confidenceRange: [0, 100],
  platforms: [],
  mediaType: 'all',
  verifiedOnly: undefined,
};

const FilterPanel: React.FC<FilterPanelProps> = ({
  onFilterChange,
  availablePlatforms = [],
  style,
}) => {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load presets from localStorage on mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('filterPresets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    }
  }, []);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    onFilterChange(DEFAULT_FILTERS);
    message.info('筛选条件已重置');
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.warning('请输入预设名称');
      return;
    }

    const newPreset: FilterPreset = {
      name: presetName.trim(),
      filters: { ...filters },
    };

    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
    setPresetName('');
    message.success(`预设 "${newPreset.name}" 已保存`);
  };

  const handleLoadPreset = (preset: FilterPreset) => {
    setFilters(preset.filters);
    onFilterChange(preset.filters);
    message.success(`已加载预设 "${preset.name}"`);
  };

  const handleDeletePreset = (index: number) => {
    const updatedPresets = presets.filter((_, i) => i !== index);
    setPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
    message.success('预设已删除');
  };

  const marks = {
    0: '0%',
    25: '25%',
    50: '50%',
    75: '75%',
    100: '100%',
  };

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff' }}>🔍 高级筛选</span>
          <Button
            type="link"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ color: '#3498db' }}
          >
            {isExpanded ? '收起' : '展开'}
          </Button>
        </div>
      }
      style={{
        background: '#1f2433',
        marginBottom: 16,
        ...style,
      }}
      headStyle={{ color: '#fff', borderBottom: '1px solid #2a3b6f' }}
      bodyStyle={{ display: isExpanded ? 'block' : 'none' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Search */}
        <div>
          <label style={{ color: '#aaa', display: 'block', marginBottom: 8 }}>
            关键词搜索
          </label>
          <Search
            placeholder="搜索标题、描述或标签..."
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            onSearch={() => onFilterChange(filters)}
            allowClear
            style={{ background: '#2a2f3e' }}
          />
        </div>

        {/* Confidence Score Range */}
        <div>
          <label style={{ color: '#aaa', display: 'block', marginBottom: 8 }}>
            置信度范围: {filters.confidenceRange[0]}% - {filters.confidenceRange[1]}%
          </label>
          <Slider
            range
            min={0}
            max={100}
            marks={marks}
            value={filters.confidenceRange}
            onChange={(value) => handleFilterChange('confidenceRange', value as [number, number])}
            tooltip={{ formatter: (value) => `${value}%` }}
          />
        </div>

        <Row gutter={16}>
          {/* Platform Selector */}
          <Col span={12}>
            <label style={{ color: '#aaa', display: 'block', marginBottom: 8 }}>
              来源平台
            </label>
            <Select
              mode="multiple"
              placeholder="选择平台..."
              value={filters.platforms}
              onChange={(value) => handleFilterChange('platforms', value)}
              style={{ width: '100%' }}
              allowClear
              maxTagCount="responsive"
            >
              {availablePlatforms.map((platform) => (
                <Select.Option key={platform} value={platform}>
                  {platform}
                </Select.Option>
              ))}
            </Select>
          </Col>

          {/* Media Type */}
          <Col span={12}>
            <label style={{ color: '#aaa', display: 'block', marginBottom: 8 }}>
              媒体类型
            </label>
            <Select
              value={filters.mediaType}
              onChange={(value) => handleFilterChange('mediaType', value)}
              style={{ width: '100%' }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="photo">图片</Select.Option>
              <Select.Option value="video">视频</Select.Option>
            </Select>
          </Col>
        </Row>

        {/* Verification Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ color: '#aaa' }}>仅显示已验证</label>
          <Switch
            checked={filters.verifiedOnly === true}
            onChange={(checked) =>
              handleFilterChange('verifiedOnly', checked ? true : undefined)
            }
          />
        </div>

        <Divider style={{ margin: '12px 0', borderColor: '#2a3b6f' }} />

        {/* Action Buttons */}
        <Space wrap>
          <Button onClick={handleReset}>重置筛选</Button>
          <Button type="primary" onClick={() => onFilterChange(filters)}>
            应用筛选
          </Button>
        </Space>

        <Divider style={{ margin: '12px 0', borderColor: '#2a3b6f' }} />

        {/* Presets */}
        <div>
          <label style={{ color: '#aaa', display: 'block', marginBottom: 8 }}>
            筛选预设
          </label>

          <Space direction="vertical" style={{ width: '100%' }}>
            {/* Save new preset */}
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="输入预设名称..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onPressEnter={handleSavePreset}
                style={{ flex: 1 }}
              />
              <Button type="primary" onClick={handleSavePreset}>
                保存预设
              </Button>
            </Space.Compact>

            {/* Load presets */}
            {presets.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {presets.map((preset, index) => (
                    <Tooltip key={index} title="点击加载，长按删除">
                      <Button
                        size="small"
                        onClick={() => handleLoadPreset(preset)}
                        onDoubleClick={() => handleDeletePreset(index)}
                        style={{
                          background: '#2a3b6f',
                          color: '#fff',
                          border: '1px solid #3498db',
                        }}
                      >
                        {preset.name}
                      </Button>
                    </Tooltip>
                  ))}
                </Space>
              </div>
            )}
          </div>
        </div>
      </Space>
    </Card>
  );
};

export default FilterPanel;
export type { FilterState, FilterPreset };