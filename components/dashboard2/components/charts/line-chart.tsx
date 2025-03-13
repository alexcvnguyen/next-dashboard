'use client';

import React from 'react';
import { Line, LineChart as RechartsLineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardSection } from '../../types';
import type { DashboardData } from '../visualization-section';

interface LineChartProps {
  section: DashboardSection;
  data: DashboardData;
}

interface DataPoint {
  date: string;
  value: number | null;
}

interface ChartDataPoint {
  date: string;
  [key: string]: number | null | string;
}

export function LineChart({ section, data }: LineChartProps) {
  const getDataForMetric = (metricId: string): DataPoint[] => {
    const metric = section.metrics.find(m => m === metricId);
    if (!metric) return [];

    switch (metric) {
      case 'sleep_duration':
        return data.sleep.map(d => ({
          date: d.date,
          value: d.inBed,
        }));
      case 'sleep_quality':
        return data.sleep.map(d => ({
          date: d.date,
          value: d.deep,
        }));
      case 'mood_score':
        return data.journals.map(d => ({
          date: d.date,
          value: d.moodScore,
        }));
      case 'energy_score':
        return data.journals.map(d => ({
          date: d.date,
          value: d.energyScore,
        }));
      case 'work_duration':
        return data.location.map(d => ({
          date: d.date,
          value: d.workDuration,
        }));
      case 'mood_average':
        return data.location.map(d => ({
          date: d.date,
          value: d.moodScoreAverage,
        }));
      case 'energy_average':
        return data.location.map(d => ({
          date: d.date,
          value: d.energyScoreAverage,
        }));
      default:
        return [];
    }
  };

  // Combine data from all metrics
  const chartData = section.metrics.reduce<ChartDataPoint[]>((acc, metricId) => {
    const metricData = getDataForMetric(metricId);
    metricData.forEach(d => {
      const existingDay = acc.find(day => day.date === d.date);
      if (existingDay) {
        existingDay[metricId] = d.value;
      } else {
        acc.push({ date: d.date, [metricId]: d.value });
      }
    });
    return acc;
  }, []);

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          {section.settings?.showLegend && <Legend />}
          {section.metrics.map(metricId => (
            <Line
              key={metricId}
              type="monotone"
              dataKey={metricId}
              stroke={`hsl(${Math.random() * 360}, 70%, 50%)`}
              dot={false}
              connectNulls
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
} 