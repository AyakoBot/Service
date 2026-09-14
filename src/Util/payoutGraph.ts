/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutCurve } from '@ayako/database';

import { payoutFor } from './payoutCurve.js';

const commonOptions = {
 backgroundColor: 'transparent',
 grid: {
  left: '8%',
  right: '8%',
  bottom: '18%',
  top: '5%',
  containLabel: true,
 },
 title: {
  left: 'center',
  textStyle: {
   color: '#f7f1ee',
   fontWeight: 'bold',
   fontSize: 16,
   fontFamily: 'sans-serif',
  },
  top: 10,
 },
};

const xAxisOpts = {
 type: 'category' as const,
 nameLocation: 'middle' as const,
 nameTextStyle: {
  fontStyle: 'italic',
  fontWeight: 'bold',
  color: '#f7f1ee',
  padding: [10, 0, 0, 0],
 },
 nameGap: 35,
 axisLine: { lineStyle: { color: '#666', width: 1 } },
 axisTick: { alignWithLabel: true, lineStyle: { color: '#555' } },
 axisLabel: { color: '#f7f1ee', fontSize: 12, rotate: 0, margin: 12 },
};

const yAxisOpts = {
 type: 'value' as const,
 nameLocation: 'middle' as const,
 nameGap: 45,
 nameTextStyle: {
  fontStyle: 'italic',
  fontWeight: 'bold',
  color: '#f7f1ee',
  fontSize: 13,
 },
 axisLine: {
  show: true,
  lineStyle: { color: '#666' },
 },
 splitLine: {
  lineStyle: {
   color: 'rgba(120, 120, 120, 0.2)',
   type: [2, 4] as [number, number],
  },
 },
 axisLabel: { color: '#f7f1ee', formatter: '{value}', fontSize: 11 },
};

const colors = {
 primary: [
  '#f4651c',
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#9b59b6',
  '#f1c40f',
  '#1abc9c',
  '#e67e22',
  '#34495e',
  '#1a5276',
 ],
};

const chartOpts = {
 renderer: 'canvas',
 width: 800,
 height: 500,
};

const payouts = 25;
const labelEvery = 5;

export const renderPayoutGraph = async (
 base: number,
 modifier: number,
 selected: PayoutCurve,
 title: string,
): Promise<Buffer> => {
 const { createCanvas } = await import('canvas');
 const echarts = await import('echarts');

 const nodeCanvas = createCanvas(chartOpts.width, chartOpts.height);
 const chart = echarts.init(nodeCanvas as never, null, chartOpts as never);

 const steps = Array.from({ length: payouts }, (_, index) => index + 1);

 const index = Object.values(PayoutCurve).indexOf(selected);

 const curveData = [
  {
   name: selected.charAt(0).toUpperCase() + selected.slice(1),
   type: 'line',
   smooth: true,
   symbol: 'none',
   lineStyle: {
    width: 2.5,
    color: colors.primary[Math.max(0, index) % colors.primary.length],
   },
   emphasis: {
    lineStyle: {
     width: 4,
     shadowBlur: 10,
     shadowColor: 'rgba(0,0,0,0.3)',
    },
   },
   data: steps.map((step) => payoutFor(base, selected, modifier, step)),
  },
 ];

 chart.setOption({
  ...commonOptions,
  backgroundColor: '#2b2d31',
  title: {
   ...commonOptions.title,
   text: title,
   subtextStyle: {
    color: 'rgba(247, 241, 238, 0.65)',
    fontSize: 12,
    fontWeight: 'normal',
   },
  },
  legend: {
   data: curveData.map((series) => ({
    name: series.name,
    textStyle: {
     color: series.lineStyle.color,
    },
   })),
   textStyle: { fontSize: 11 },
   top: 'bottom',
   icon: 'line',
   itemWidth: 20,
   itemHeight: 12,
   itemGap: 15,
   padding: 10,
  },
  xAxis: {
   ...xAxisOpts,
   data: steps,
   name: 'Payout',
   axisLabel: {
    ...xAxisOpts.axisLabel,
    interval: (index: number) => index % labelEvery === 0,
    formatter: (value: string) => value,
   },
  },
  yAxis: {
   ...yAxisOpts,
   name: 'Amount',
   axisLabel: {
    ...yAxisOpts.axisLabel,
    formatter: (value: number) => {
     if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
     if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
     return value.toString();
    },
   },
  },
  series: curveData,
 } as any);

 const buffer = nodeCanvas.toBuffer('image/png');

 chart.dispose();

 return buffer;
};
