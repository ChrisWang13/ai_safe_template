// src/App.tsx
import React, { FC, useState, useEffect } from 'react';
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
  Skeleton,
  message,
  Space,
} from 'antd';
import type { RangePickerProps } from 'antd/lib/date-picker';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { GoogleGenAI } from '@google/genai';
import ExportButton from './components/ExportButton';

const { Header, Content } = Layout;
const { RangePicker } = DatePicker;

/* ——— Google Gemini ——— */
const ai = new GoogleGenAI({
  apiKey: '',
});

/* ——— 类型定义 ——— */
type DateRange = [string, string] | null;
interface DynamicNewsMetrics {
  days: number;
  fakeTotal: number;
  realTotal: number;
}

/* ——— 表格列定义 ——— */
/* 1. 虚假新闻列表 */
const fakeNewsColumns = [
  {
    title: '排名',
    dataIndex: 'rank',
    key: 'rank',
    align: 'center' as const,
    render: (text: number) => (
      <span style={{ color: '#e74c3c', fontWeight: 700 }}>{text}</span>
    ),
  },
  {
    title: '新闻标题',
    dataIndex: 'name',
    key: 'name',
    align: 'center' as const,
    // record.url 用来生成可点击链接
    render: (_: string, record: any) => (
      <span style={{ color: '#fff' }}>
        🚫{' '}
        <a
          href={record.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#e74c3c' }}
        >
          {record.name}
        </a>
      </span>
    ),
  },
];

/* 2. 舆论热议排行（抖音示例） */
const douyinColumns = [
  {
    title: '排名',
    dataIndex: 'rank',
    key: 'rank',
    align: 'center' as const,
  },
  {
    title: '视频名称',
    dataIndex: 'name',
    key: 'name',
    align: 'center' as const,
    render: (_: string, record: any) => (
      <a
        href={record.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#fff' }}
      >
        {record.name}
      </a>
    ),
  },
  { title: '点赞量', dataIndex: 'likes', key: 'likes', align: 'center' as const },
  // { title: '转发量', dataIndex: 'shares', key: 'shares', align: 'center' as const },
  // { title: '评论量', dataIndex: 'comments', key: 'comments', align: 'center' as const },
];

/* ——— 统一色彩参数 ——— */
const chartBG = '#0f1630';
const chartTextColor = '#fff';
const axisLineColor = '#5a6a88';

/* ——— 把 AI 返回的 JS 数组字符串安全地解析为对象 ——— */
const parseAIArray = (raw:string) => {
  // 1. Extract the first [...] substring (greedy, including newlines)
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error("No array literal found in input");
  }
  const code = arrayMatch[0];

  // 2. Wrap in a Function to safely evaluate just that literal
  //    (this avoids accidentally running any other code in "raw")
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + code + ');')();
};


/**
 * Call Gemini with prompt and parse out a JS array, retrying on parse errors.
 */
async function fetchAIArray<T>(
  prompt: string,
  maxRetries = 3,
  delayMs = 0
): Promise<T[]> {
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const text = (resp.text || '').trim();
      console.log('AI response:', text);
      return parseAIArray(text);
    } catch (err) {
      lastErr = err;
      console.warn(`Attempt ${attempt} failed to parse AI response:`, err);
      if (attempt < maxRetries) {
        // wait a bit before retrying
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}


const App: FC = () => {
  /* ——— 状态区 ——— */
  const [range, setRange] = useState<DateRange>(null);

  // 分段加载状态
  const [loadingFake, setLoadingFake] = useState(false);
  const [loadingDouyin, setLoadingDouyin] = useState(false);

  /* 表格数据 */
  const [fakeNewsData, setFakeNewsData] = useState<any[]>([]);
  const [douyinData, setDouyinData] = useState<any[]>([]);

  /* 折线图 & 柱状图数据 */
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

  /* ——— 工具函数 ——— */
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

  /* ——— 核心：选择日期后，调用 AI 并生成所有数据 ——— */
  const onDateChange: RangePickerProps['onChange'] = (_, datesPicked) => {
    const newRange = datesPicked as DateRange;
    setRange(newRange);
    if (!newRange) return;

    const [start, end] = newRange;

    // 初始化加载状态
    setLoadingFake(true);
    setLoadingDouyin(true);

    const dateArr = buildDateArray(start, end);
    setDates(dateArr);

    /* ① 虚假新闻 */
    (async () => {
      try {
        const fakeNewsPrompt =
          `使用google Search搜索 ${start} 至 ${end} 期间与"虚假新闻”, "辟谣”相关的大陆中文条目结果. 请仅返回一个 JavaScript 数组（不要包裹代码块，不要 const 声明，不要注释）。` +
          `格式示例: [{ rank: 1, name: '中文虚假新闻'}, ...], rank 必须 1-5 递增.`;

        const fakeNewsList = await fetchAIArray<{rank:number;name:string;}>(fakeNewsPrompt);
        const fakeNewsData = fakeNewsList.map((item: any) => ({
          ...item,
          url: `https://www.baidu.com/s?tn=news&word=${encodeURIComponent(item.name)}`,
        }));

        setFakeNewsData(fakeNewsData);

        // 生成折线图数据 (Mock)
        const seedKey = `${start}_${end}`;
        const days = dateArr.length;
        const rngF0 = seedrandom(`fake0-${seedKey}`);
        const rngR0 = seedrandom(`real0-${seedKey}`);
        const fakeTotals = Array.from({ length: days }, () => Math.max(0, Math.round(100 + (rngF0() * 400 - 200))));
        const realTotals = Array.from({ length: days }, () => Math.max(0, Math.round(400 + (rngR0() * 400 - 200))));
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
      } catch (err) {
        console.error('虚假新闻生成失败:', err);
        message.error('虚假新闻生成失败，请稍后重试');
      } finally {
        setLoadingFake(false);
      }
    })();

    /* ② 舆论热议排行 */
    (async () => {
      try {
        const douyinPrompt =
          `使用google Search搜索 ${start} 至 ${end} 期间的热门搜索的大陆中文条目结果。请仅返回一个 JavaScript 数组（不要包裹代码块，不要 const 声明，不要注释）。` +
          `格式示例：[{ rank: 1, name: '中文热门搜索舆情', likes: '100万'}, ...], rank 1-5 递增， likes字段数值依次递减。`;

        const douyinList = await fetchAIArray<{rank:number;name:string;likes:string;}>(douyinPrompt);
        const douyinData = douyinList.map((item: any) => ({
          ...item,
          url: `https://www.baidu.com/s?tn=news&word=${encodeURIComponent(item.name)}`,
        }));
        setDouyinData(douyinData);

        // 生成柱状图数据 (Mock)
        const seedKey = `${start}_${end}`;
        const days = dateArr.length;
        const rngV = seedrandom(`video-${seedKey}`);
        const rngP = seedrandom(`pos-${seedKey}`);
        const rngN = seedrandom(`neg-${seedKey}`);

        const videoPerDay = Array.from({ length: days }, () => Math.round(50 + rngV() * 150));
        const pArr = videoPerDay.map(v => Math.round(v * (0.05 + rngP() * 0.3)));
        const nArr = videoPerDay.map(v => Math.round(v * (0.05 + rngN() * 0.3)));
        const uArr = videoPerDay.map((v, i) => v - pArr[i] - nArr[i]);

        setPosSeries(pArr);
        setNegSeries(nArr);
        setNeuSeries(uArr);
      } catch (err) {
        console.error('舆论排行生成失败:', err);
        message.error('舆论热议排行生成失败，请稍后重试');
      } finally {
        setLoadingDouyin(false);
      }
    })();
  };


  /* ——— 折线图配置 ——— */
  const buildLineOption = (): EChartsOption => ({
    backgroundColor: chartBG,
    textStyle: { color: chartTextColor },
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.7)', textStyle: { color: chartTextColor } },
    legend: { bottom: 0, textStyle: { color: chartTextColor } },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: axisLineColor } }, axisLabel: { color: chartTextColor } },
    yAxis: { type: 'value', min: 0, axisLine: { lineStyle: { color: axisLineColor } }, axisLabel: { color: chartTextColor }, splitLine: { lineStyle: { color: '#223057' } } },
    series: [
      {
        name: '虚假新闻',
        type: 'line',
        data: fakeSeries,
        lineStyle: { color: '#e74c3c' },
        itemStyle: { color: '#e74c3c' },
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
      },
      {
        name: '真实新闻',
        type: 'line',
        data: realSeries,
        lineStyle: { color: '#27ae60' },
        itemStyle: { color: '#27ae60' },
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
  });

  /* ——— 柱状图配置（情绪识别） ——— */
  const buildSentimentOption = (): EChartsOption => ({
    backgroundColor: chartBG,
    textStyle: { color: chartTextColor },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(0,0,0,0.7)', textStyle: { color: chartTextColor } },
    legend: { bottom: 0, textStyle: { color: chartTextColor } },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: axisLineColor } }, axisLabel: { color: chartTextColor } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: axisLineColor } }, axisLabel: { color: chartTextColor }, splitLine: { lineStyle: { color: '#223057' } } },
    series: [
      { name: '积极短视频', type: 'bar', data: posSeries, itemStyle: { color: '#f4d03f' } },
      { name: '消极短视频', type: 'bar', data: negSeries, itemStyle: { color: '#e74c3c' } },
      { name: '中立短视频', type: 'bar', data: neuSeries, itemStyle: { color: '#5dade2' } },
    ],
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
  });

  /* ——— 全局深色表格样式（去除竖线） ——— */
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .dark-table .ant-table-thead > tr > th,
      .dark-table .ant-table-tbody > tr > td {
        background: ${chartBG} !important;
        color: #fff !important;
        border-color: #2a3b6f !important;
        border-right: none !important;
        border-left: none !important;
      }
      .dark-table .ant-table-cell {
        border-right: none !important;
        border-left: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  /* ——— 统计卡片数据 ——— */
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

  /* ——— 占位行构造函数 ——— */
  const buildNA = (len = 5) =>
    Array.from({ length: len }, (_, i) => ({
      key: `na-${i}`,
      rank: i + 1,
      name: 'N/A',
      likes: 'N/A',
      shares: 'N/A',
      comments: 'N/A',
    }));

  /* ——— 渲染 ——— */
  return (
    <Layout style={{ minHeight: '100vh', background: chartBG }}>
      {/* Header：日期选择器 + 导出按钮 */}
      <Header
        style={{
          background: chartBG,
          padding: 16,
          borderBottom: '1px solid #1f2a4a',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
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
        <Space>
          <ExportButton
            exportType="deepfakes"
            startDate={range?.[0] || ''}
            endDate={range?.[1] || ''}
            disabled={!range}
            buttonText="导出虚假新闻"
            style={{ background: '#e74c3c', borderColor: '#e74c3c' }}
          />
          <ExportButton
            exportType="stats"
            startDate={range?.[0] || ''}
            endDate={range?.[1] || ''}
            disabled={!range}
            buttonText="导出统计数据"
            style={{ background: '#3498db', borderColor: '#3498db' }}
          />
        </Space>
      </Header>

      {/* 主内容区 */}
      <Content style={{ margin: 16 }}>
        {dynamicNews.days === 0 ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            {/* —— 虚假新闻检测 —— */}
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: '#1f2433',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}
              >
                虚假新闻检测（共 {dynamicNews.days} 天）
              </div>

              {/* 统计卡片 */}
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
                      <div style={{ fontWeight: 'bold', color: m.color }}>
                        {m.title}
                      </div>
                      <div style={{ fontSize: 24, marginTop: 8, color: '#fff' }}>
                        {m.value}
                      </div>
                      <div style={{ marginTop: 4, color: '#aaa' }}>
                        占比 {(
                          (m.value / (dynamicNews.fakeTotal + dynamicNews.realTotal)) *
                          100
                        ).toFixed(2)}%
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* 折线图 */}
              <Spin spinning={loadingFake}>
                <ReactECharts option={buildLineOption()} style={{ height: 300 }} />
              </Spin>

              {/* —— 虚假新闻列表 —— */}
              <Table
                loading={loadingFake}
                title={() => (
                  <span
                    style={{ color: '#e74c3c', fontWeight: 700, fontSize: 16 }}
                  >
                    🚫 虚假新闻
                  </span>
                )}
                className="dark-table fake-news-table"
                columns={fakeNewsColumns}
                dataSource={fakeNewsData.length ? fakeNewsData : buildNA()}
                rowKey="rank"
                pagination={false}
                style={{ background: '#2b3350', marginTop: 24 }}
              />
            </Card>

            {/* —— 情绪识别 —— */}
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: '#1f2433',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{ color: '#fff', fontWeight: 'bold', marginBottom: 12 }}
              >
                短视频情绪识别（共 {dynamicNews.days} 天）
              </div>

              {/* 情绪统计卡片 */}
              <Row gutter={16} style={{ marginBottom: 16 }}>
                {sentimentMetrics.map(m => (
                  <Col span={8} key={m.title}>
                    <Card
                      bordered={false}
                      style={{
                        background: '#2b3350',
                        borderRadius: 8,
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      <div style={{ color: m.color, fontSize: 16, fontWeight: 'bold' }}>
                        {m.emoji} {m.title}
                      </div>
                      <div style={{ fontSize: 24, marginTop: 8, color: m.color }}>
                        {m.value}
                      </div>
                      <div style={{ marginTop: 4, color: '#aaa' }}>
                        占比 {((m.value / sentimentSum) * 100).toFixed(2)}%
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* 柱状图 */}
              <Spin spinning={loadingDouyin}>
                <ReactECharts option={buildSentimentOption()} style={{ height: 300 }} />
              </Spin>
            </Card>

            {/* —— 舆论热议排行 —— */}
            <Card
              size="small"
              title={<span style={{ color: '#fff' }}>舆论热议排行</span>}
              style={{ background: '#1f2433', borderRadius: 8, marginTop: 16 }}
              headStyle={{ color: '#fff', borderBottom: '1px solid #2a3b6f' }}
              bodyStyle={{ padding: 0 }}
            >
              <Table
                loading={loadingDouyin}
                className="dark-table"
                columns={douyinColumns}
                dataSource={douyinData.length ? douyinData : buildNA()}
                rowKey="rank"
                pagination={false}
                style={{ background: '#2b3350' }}
              />
            </Card>
          </>
        )}
      </Content>
    </Layout>
  );
};

export default App;
