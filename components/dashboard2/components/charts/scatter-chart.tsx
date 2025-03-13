'use client';

import React from 'react';
import { ScatterChart as RechartsScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardSection } from '../../types';
import type { DashboardData } from '../visualization-section';

interface ScatterChartProps {
  section: DashboardSection;
  data: DashboardData;
}

interface DataPoint {
  x: number;
  y: number;
  date: string;
}

export function ScatterChart({ section, data }: ScatterChartProps) {
  const getDataForMetrics = (): DataPoint[] => {
    if (section.metrics.length < 2) return [];

    const [xMetric, yMetric] = section.metrics;
    const dates = new Set([
      ...data.sleep.map(d => d.date),
      ...data.journals.map(d => d.date),
      ...data.location.map(d => d.date),
    ]);

    return Array.from(dates).map(date => {
      let xValue: number | null = null;
      let yValue: number | null = null;

      // Get X value
      switch (xMetric) {
        case 'sleep_duration':
          xValue = data.sleep.find(d => d.date === date)?.inBed || null;
          break;
        case 'sleep_quality':
          xValue = data.sleep.find(d => d.date === date)?.deep || null;
          break;
        case 'mood_score':
          xValue = data.journals.find(d => d.date === date)?.moodScore || null;
          break;
        case 'energy_score':
          xValue = data.journals.find(d => d.date === date)?.energyScore || null;
          break;
        case 'work_duration':
          xValue = data.location.find(d => d.date === date)?.workDuration || null;
          break;
        case 'mood_average':
          xValue = data.location.find(d => d.date === date)?.moodScoreAverage || null;
          break;
        case 'energy_average':
          xValue = data.location.find(d => d.date === date)?.energyScoreAverage || null;
          break;
      }

      // Get Y value
      switch (yMetric) {
        case 'sleep_duration':
          yValue = data.sleep.find(d => d.date === date)?.inBed || null;
          break;
        case 'sleep_quality':
          yValue = data.sleep.find(d => d.date === date)?.deep || null;
          break;
        case 'mood_score':
          yValue = data.journals.find(d => d.date === date)?.moodScore || null;
          break;
        case 'energy_score':
          yValue = data.journals.find(d => d.date === date)?.energyScore || null;
          break;
        case 'work_duration':
          yValue = data.location.find(d => d.date === date)?.workDuration || null;
          break;
        case 'mood_average':
          yValue = data.location.find(d => d.date === date)?.moodScoreAverage || null;
          break;
        case 'energy_average':
          yValue = data.location.find(d => d.date === date)?.energyScoreAverage || null;
          break;
      }

      return {
        x: xValue || 0,
        y: yValue || 0,
        date,
      };
    }).filter(point => point.x !== null && point.y !== null);
  };

  const chartData = getDataForMetrics();

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsScatterChart
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name={section.metrics[0]}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={section.metrics[1]}
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          {section.settings?.showLegend && <Legend />}
          <Scatter
            name={`${section.metrics[0]} vs ${section.metrics[1]}`}
            data={chartData}
            fill={`hsl(${Math.random() * 360}, 70%, 50%)`}
          />
        </RechartsScatterChart>
      </ResponsiveContainer>
    </div>
  );
} 