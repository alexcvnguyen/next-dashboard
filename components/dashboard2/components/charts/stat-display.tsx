'use client';

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardSection } from '../../types';
import type { DashboardData } from '../visualization-section';

interface StatDisplayProps {
  section: DashboardSection;
  data: DashboardData;
}

interface StatValue {
  name: string;
  value: number | null;
  unit?: string;
}

export function StatDisplay({ section, data }: StatDisplayProps) {
  const getStatForMetric = (metricId: string): StatValue => {
    const metric = section.metrics.find(m => m === metricId);
    if (!metric) return { name: metricId, value: null };

    const calculateAverage = (values: (number | null)[]): number | null => {
      const validValues = values.filter((v): v is number => v !== null);
      if (validValues.length === 0) return null;
      return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    };

    switch (metric) {
      case 'sleep_duration':
        return {
          name: 'Average Sleep Duration',
          value: calculateAverage(data.sleep.map(d => d.inBed)),
          unit: 'hours'
        };
      case 'sleep_quality':
        return {
          name: 'Average Deep Sleep',
          value: calculateAverage(data.sleep.map(d => d.deep)),
          unit: 'hours'
        };
      case 'mood_score':
        return {
          name: 'Average Mood',
          value: calculateAverage(data.journals.map(d => d.moodScore)),
          unit: 'points'
        };
      case 'energy_score':
        return {
          name: 'Average Energy',
          value: calculateAverage(data.journals.map(d => d.energyScore)),
          unit: 'points'
        };
      case 'work_duration':
        return {
          name: 'Average Work Duration',
          value: calculateAverage(data.location.map(d => d.workDuration)),
          unit: 'hours'
        };
      case 'mood_average':
        return {
          name: 'Overall Mood',
          value: calculateAverage(data.location.map(d => d.moodScoreAverage)),
          unit: 'points'
        };
      case 'energy_average':
        return {
          name: 'Overall Energy',
          value: calculateAverage(data.location.map(d => d.energyScoreAverage)),
          unit: 'points'
        };
      default:
        return { name: metricId, value: null };
    }
  };

  const stats = section.metrics.map(getStatForMetric);

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </p>
              <p className="text-2xl font-bold">
                {stat.value !== null
                  ? `${stat.value.toFixed(1)}${stat.unit ? ` ${stat.unit}` : ''}`
                  : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 