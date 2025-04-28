// src/App.tsx
import React, { FC, useState } from 'react';
import dayjs from 'dayjs';
import seedrandom from 'seedrandom';
import {
  Layout,
  DatePicker,
  Table,
  Card,
  Row,
  Col,
  Spin,
  message,
} from 'antd';
import type { RangePickerProps } from 'antd/lib/date-picker';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { GoogleGenAI } from '@google/genai';

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;

const ai = new GoogleGenAI({
  apiKey: 'AIzaSyBqaJ1dK8F9klHNw-AVIoEn9KkTG_dN53k',
});

type DateRange = [string, string] | null;
interface DynamicNewsMetrics {
  days: number;
  fakeTotal: number;
  realTotal: number;
}

const weiboColumns = [
  { title: '排序', dataIndex: 'rank', key: 'rank' },
  { title: '短链名称', dataIndex: 'name', key: 'name' },
  { title: '点赞量', dataIndex: 'likes', key: 'likes' },
  { title: '转发量', dataIndex: 'shares', key: 'shares' },
  { title: '评论量', dataIndex: 'comments', key: 'comments' },
];

const douyinColumns = [
  { title: '排名', dataIndex: 'rank', key: 'rank' },
  { title: '视频名称', dataIndex: 'name', key: 'name' },
  { title: '点赞量', dataIndex: 'likes', key: 'likes' },
  { title: '转发量', dataIndex: 'shares', key: 'shares' },
  { title: '评论量', dataIndex: 'comments', key: 'comments' },
];

const chartBG = '#0f1630';
const chartTextColor = '#fff';
const axisLineColor = '#5a6a88';

// —— 通用解析函数 ——
const parseAIArray = (raw: string) => {
  const match = raw.match(/```(?:[a-z]*)?\s*([\s\S]*?)```/);
  let code = match ? match[1] : raw;
  code = code.replace(/^const\s+\w+\s*=\s*/i, '').replace(/;\s*$/, '').trim();
  return Function('"use strict";return (' + code + ')')();
};

const App: FC = () => {
  // —— 状态区 ——
  const [range, setRange] = useState<DateRange>(null);
  const [loading, setLoading] = useState(false);
  const [weiboData, setWeiboData] = useState<any[]>([]);
  const [douyinData, setDouyinData] = useState<any[]>([]);

  // 图表 / 统计数据
  const [dates, setDates] = useState<string[]>([]);
  const [dynamicNews, setDynamicNews] = useState<DynamicNewsMetrics>({
    days: 0,
    fakeTotal: 0,
    realTotal: 0,
  });
  const [fakeSeries, setFakeSeries] = useState<number[]>([]);
  const [realSeries, setRealSeries] = useState<number[]>([]);
  const [posSeries, setPosSeries] = useState<number[]>([]);
  const [negSeries, setNegSeries] = useState<number[]>([]);
  const [neuSeries, setNeuSeries] = useState<number[]>([]);

  // —— 工具函数 ——
  const buildDateArray = (start: string, end: string) => {
    const s = dayjs(start);
    const e = dayjs(end);
    const len = e.diff(s, 'day') + 1;
    return Array.from({ length: len }, (_, i) => s.add(i, 'day').format('YYYY-MM-DD'));
  };

  const disabledDate = (current: dayjs.Dayjs) =>
    !current ||
    current.isAfter(dayjs(), 'day') ||
    current.isBefore(dayjs('2018-01-01', 'YYYY-MM-DD'), 'day');

  // —— 主逻辑：选日期→AI→生成全部数据 ——
  const onDateChange: RangePickerProps['onChange'] = async (_, datesPicked) => {
    const newRange = datesPicked as DateRange;
    setRange(newRange);
    if (!newRange) return;

    setLoading(true);
    const [start, end] = newRange;

    try {
      // ——— 1. 获取微博热搜 ———
      const weiboPrompt =
        `${start} 至 ${end} 的新闻热搜，请仅返回一个 JavaScript 数组（不要代码块、不要 const 声明、不要注释）。` +
        `数组元素格式与下列示例一致，key 与 rank 必须 1-10 递增：` +
        `[ { key: 1, rank: 1, name: '示例标题', likes: '100万', shares: '50万', comments: '10万' }, … ]`;

      const weiboResp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: weiboPrompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const weiboRaw = (weiboResp.text || '').trim();
      const weiboList = parseAIArray(weiboRaw) as any[];
      setWeiboData(weiboList);

      // ——— 2. 获取抖音热门视频排行 ———
      const douyinPrompt =
        `${start} 至 ${end} 的短视频热门话题排行，请仅返回一个 JavaScript 数组（不要代码块、不要 const 声明、不要注释）。` +
        `数组元素格式与下列示例一致，key 与 rank 必须 1-10 递增：` +
        `[ { key: 1, rank: 1, name: '示例视频标题', likes: '100万', shares: '50万', comments: '10万' }, … ]`;

      const douyinResp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: douyinPrompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const douyinRaw = (douyinResp.text || '').trim();
      const douyinList = parseAIArray(douyinRaw) as any[];
      setDouyinData(douyinList);

      // ——— 3. 生成日期 & 图表数据 ———
      const dateArr = buildDateArray(start, end);
      setDates(dateArr);

      const seedKey = `${start}_${end}`;
      const days = dateArr.length;

      // 虚假 / 真实新闻
      const rngF0 = seedrandom(`fake0-${seedKey}`);
      const rngR0 = seedrandom(`real0-${seedKey}`);
      const fakeTotals = Array.from({ length: days }, () => Math.round(100 + (rngF0() * 400 - 200)));
      const realTotals = Array.from({ length: days }, () => Math.round(400 + (rngR0() * 400 - 200)));
      const fakeTotal = fakeTotals.reduce((s, v) => s + v, 0);
      const realTotal = realTotals.reduce((s, v) => s + v, 0);

      const makeSeries = (avg: number, seed: string) => {
        const rng = seedrandom(seed);
        let arr = Array.from({ length: days }, () => Math.round(avg * (0.2 + rng() * 1.8)));
        for (let i = 0; i < 3; i++) {
          const idx = Math.floor(rng() * days);
          arr[idx] = Math.round(arr[idx] * (3 + rng() * 2));
        }
        const sum0 = arr.reduce((s, v) => s + v, 0);
        return arr.map(v => Math.max(0, Math.round((v * avg * days) / sum0)));
      };
      setFakeSeries(makeSeries(fakeTotal / days, `fakeSeries-${seedKey}`));
      setRealSeries(makeSeries(realTotal / days, `realSeries-${seedKey}`));
      setDynamicNews({ days, fakeTotal, realTotal });

      // 情绪短视频
      const rngV = seedrandom(`video-${seedKey}`);
      const videoPerDay = Array.from({ length: days }, () => Math.round(50 + rngV() * 150));
      const rngP = seedrandom(`pos-${seedKey}`);
      const rngN = seedrandom(`neg-${seedKey}`);
      const pArr = videoPerDay.map(v => Math.round(v * (0.05 + rngP() * 0.3)));
      const nArr = videoPerDay.map(v => Math.round(v * (0.05 + rngN() * 0.3)));
      const uArr = videoPerDay.map((v, i) => v - pArr[i] - nArr[i]);
      setPosSeries(pArr);
      setNegSeries(nArr);
      setNeuSeries(uArr);
    } catch (err) {
      console.error('生成失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // —— 图表配置 ——
  const buildLineOption = (): EChartsOption => ({
    backgroundColor: chartBG,
    textStyle: { color: chartTextColor },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.7)', textStyle: { color: chartTextColor } },
    legend: { bottom: 0, textStyle: { color: chartTextColor } },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: chartTextColor },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: chartTextColor },
      splitLine: { lineStyle: { color: '#223057' } },
    },
    series: [
      { name: '虚假新闻', type: 'line', data: fakeSeries, lineStyle: { color: '#e74c3c' }, itemStyle: { color: '#e74c3c' } },
      { name: '真实新闻', type: 'line', data: realSeries, lineStyle: { color: '#27ae60' }, itemStyle: { color: '#27ae60' } },
    ],
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
  });

  const buildSentimentOption = (): EChartsOption => ({
    backgroundColor: chartBG,
    textStyle: { color: chartTextColor },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(0,0,0,0.7)', textStyle: { color: chartTextColor } },
    legend: { bottom: 0, textStyle: { color: chartTextColor } },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: chartTextColor },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: axisLineColor } },
      axisLabel: { color: chartTextColor },
      splitLine: { lineStyle: { color: '#223057' } },
    },
    series: [
      { name: '积极短视频', type: 'bar', data: posSeries, itemStyle: { color: '#f4d03f' } },
      { name: '消极短视频', type: 'bar', data: negSeries, itemStyle: { color: '#e74c3c' } },
      { name: '中立短视频', type: 'bar', data: neuSeries, itemStyle: { color: '#5dade2' } },
    ],
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
  });

  // —— 临时样式：暗色表格 ——
  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .dark-table .ant-table-thead > tr > th {
        background: ${chartBG} !important;
        color: #fff !important;
        border-color: #2a3b6f !important;
      }
      .dark-table .ant-table-tbody > tr > td {
        background: ${chartBG} !important;
        color: #fff !important;
        border-color: #2a3b6f !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // —— 统计卡片数据 ——
  const newsMetrics = [
    { title: '虚假新闻总数', value: dynamicNews.fakeTotal, color: '#e74c3c' },
    { title: '真实新闻总数', value: dynamicNews.realTotal, color: '#27ae60' },
  ];
  const posTotal = posSeries.reduce((s, v) => s + v, 0);
  const negTotal = negSeries.reduce((s, v) => s + v, 0);
  const neuTotal = neuSeries.reduce((s, v) => s + v, 0);
  const sentimentSum = posTotal + negTotal + neuTotal;
  const sentimentMetrics = [
    { title: '积极情绪短视频总数', value: posTotal, color: '#f4d03f', emoji: '😊' },
    { title: '消极情绪短视频总数', value: negTotal, color: '#e74c3c', emoji: '😞' },
    { title: '中立情绪短视频总数', value: neuTotal, color: '#5dade2', emoji: '😐' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: chartBG }}>
      <Header style={{ background: chartBG, padding: 16, borderBottom: '1px solid #1f2a4a' }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker
              disabledDate={disabledDate}
              onChange={onDateChange}
              style={{
                width: 240,
                background: '#1d264e',
                color: '#fff',
                border: '1px solid #2a3b6f',
              }}
              dropdownClassName="dark-range-picker"
            />
          </Col>
        </Row>
      </Header>

      <Content style={{ margin: 16 }}>
        {loading ? (
          <Spin tip="AI 数据生成中…" style={{ color: '#fff', width: '100%' }} />
        ) : (
          <>
            {dynamicNews.days > 0 && (
              <>
                {/* —— 虚假新闻检测 —— */}
                <Card size="small" style={{ marginBottom: 16, background: '#1f2433', borderRadius: 8, padding: 16 }}>
                  <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}>
                    虚假新闻检测（共 {dynamicNews.days} 天）
                  </div>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    {newsMetrics.map(m => (
                      <Col span={12} key={m.title}>
                        <Card
                          bordered
                          style={{
                            background: '#2a2f3e',
                            border: `2px solid ${m.color}`,
                            borderRadius: 8,
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontWeight: 'bold', color: m.color }}>{m.title}</div>
                          <div style={{ fontSize: 24, marginTop: 8, color: '#fff' }}>{m.value}</div>
                          <div style={{ marginTop: 4, color: '#aaa' }}>
                            占比 {((m.value / (dynamicNews.fakeTotal + dynamicNews.realTotal)) * 100).toFixed(2)}%
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                  <ReactECharts option={buildLineOption()} style={{ height: 300 }} />
                </Card>

                {/* —— 情绪识别 —— */}
                <Card size="small" style={{ marginBottom: 16, background: '#1f2433', borderRadius: 8, padding: 16 }}>
                  <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}>
                    短视频情绪识别（共 {dynamicNews.days} 天）
                  </div>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    {sentimentMetrics.map(m => (
                      <Col span={8} key={m.title}>
                        <Card
                          bordered={false}
                          style={{ background: '#2b3350', borderRadius: 8, textAlign: 'center', padding: '16px 0' }}
                        >
                          <div style={{ color: m.color, fontSize: 16, fontWeight: 'bold' }}>
                            {m.emoji} {m.title}
                          </div>
                          <div style={{ fontSize: 24, marginTop: 8, color: m.color }}>{m.value}</div>
                          <div style={{ marginTop: 4, color: '#aaa' }}>
                            占比 {((m.value / sentimentSum) * 100).toFixed(2)}%
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                  <ReactECharts option={buildSentimentOption()} style={{ height: 300 }} />
                </Card>
              </>
            )}

            {/* —— 圆饼图（固定） —— */}
            {/* <Card style={{ background: '#171f3c', borderRadius: 10, marginBottom: 16 }}>
              <ReactECharts option={pieOption} style={{ height: 600 }} />
            </Card> */}

            {/* —— 表格区 —— */}
            <Row gutter={16}>
              <Col span={12}>
                <Card
                  size="small"
                  title="舆论热议排行"
                  style={{ background: '#1f2433', borderRadius: 8 }}
                  headStyle={{ color: '#fff', borderBottom: '1px solid #2a3b6f' }}
                  bodyStyle={{ padding: 0 }}
                >
                  <Table
                    className="dark-table"
                    columns={weiboColumns}
                    dataSource={weiboData}
                    pagination={false}
                    style={{ background: '#2b3350' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  title="短视频话题量排行"
                  style={{ background: '#1f2433', borderRadius: 8 }}
                  headStyle={{ color: '#fff', borderBottom: '1px solid #2a3b6f' }}
                  bodyStyle={{ padding: 0 }}
                >
                  <Table
                    className="dark-table"
                    columns={douyinColumns}
                    dataSource={douyinData}
                    pagination={false}
                    style={{ background: '#2b3350' }}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Content>
    </Layout>
  );
};

export default App;
