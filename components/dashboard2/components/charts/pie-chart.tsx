'use client';

import React from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DashboardSection } from '../../types';
import type { DashboardData } from '../visualization-section';

interface PieChartProps {
  section: DashboardSection;
  data: DashboardData;
}

interface DataPoint {
  name: string;
  value: number;
}

export function PieChart({ section, data }: PieChartProps) {
  const getDataForMetric = (metricId: string): DataPoint[] => {
    const metric = section.metrics.find(m => m === metricId);
    if (!metric) return [];

    switch (metric) {
      case 'sleep_duration':
        return data.sleep.map(d => ({
          name: d.date,
          value: d.inBed || 0,
        }));
      case 'sleep_quality':
        return data.sleep.map(d => ({
          name: d.date,
          value: d.deep || 0,
        }));
      case 'mood_score':
        return data.journals.map(d => ({
          name: d.date,
          value: d.moodScore || 0,
        }));
      case 'energy_score':
        return data.journals.map(d => ({
          name: d.date,
          value: d.energyScore || 0,
        }));
      case 'work_duration':
        return data.location.map(d => ({
          name: d.date,
          value: d.workDuration || 0,
        }));
      case 'mood_average':
        return data.location.map(d => ({
          name: d.date,
          value: d.moodScoreAverage || 0,
        }));
      case 'energy_average':
        return data.location.map(d => ({
          name: d.date,
          value: d.energyScoreAverage || 0,
        }));
      default:
        return [];
    }
  };

  // Get data for the first metric only (pie chart can only show one metric at a time)
  const chartData = section.metrics.length > 0 ? getDataForMetric(section.metrics[0]) : [];

  // Generate colors for each slice
  const COLORS = chartData.map((_, index) => 
    `hsl(${(index * 360) / chartData.length}, 70%, 50%)`
  );

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip />
          {section.settings?.showLegend && <Legend />}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
} 