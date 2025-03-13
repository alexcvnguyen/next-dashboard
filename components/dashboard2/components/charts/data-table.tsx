'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardSection } from '../../types';
import type { DashboardData } from '../visualization-section';

interface DataTableProps {
  section: DashboardSection;
  data: DashboardData;
}

interface TableRow {
  date: string;
  [key: string]: number | string | null;
}

export function DataTable({ section, data }: DataTableProps) {
  const getDataForMetric = (metricId: string, date: string): number | null => {
    switch (metricId) {
      case 'sleep_duration':
        return data.sleep.find(d => d.date === date)?.inBed || null;
      case 'sleep_quality':
        return data.sleep.find(d => d.date === date)?.deep || null;
      case 'mood_score':
        return data.journals.find(d => d.date === date)?.moodScore || null;
      case 'energy_score':
        return data.journals.find(d => d.date === date)?.energyScore || null;
      case 'work_duration':
        return data.location.find(d => d.date === date)?.workDuration || null;
      case 'mood_average':
        return data.location.find(d => d.date === date)?.moodScoreAverage || null;
      case 'energy_average':
        return data.location.find(d => d.date === date)?.energyScoreAverage || null;
      default:
        return null;
    }
  };

  // Get all unique dates
  const dates = new Set([
    ...data.sleep.map(d => d.date),
    ...data.journals.map(d => d.date),
    ...data.location.map(d => d.date),
  ]);

  // Create table data
  const tableData: TableRow[] = Array.from(dates).map(date => {
    const row: TableRow = { date };
    section.metrics.forEach(metricId => {
      row[metricId] = getDataForMetric(metricId, date);
    });
    return row;
  });

  // Sort by date descending
  tableData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getMetricName = (metricId: string): string => {
    switch (metricId) {
      case 'sleep_duration':
        return 'Sleep Duration';
      case 'sleep_quality':
        return 'Deep Sleep';
      case 'mood_score':
        return 'Mood Score';
      case 'energy_score':
        return 'Energy Score';
      case 'work_duration':
        return 'Work Duration';
      case 'mood_average':
        return 'Mood Average';
      case 'energy_average':
        return 'Energy Average';
      default:
        return metricId;
    }
  };

  const formatValue = (value: number | null, metricId: string): string => {
    if (value === null) return 'N/A';
    
    switch (metricId) {
      case 'sleep_duration':
      case 'sleep_quality':
      case 'work_duration':
        return `${value.toFixed(1)}h`;
      case 'mood_score':
      case 'energy_score':
      case 'mood_average':
      case 'energy_average':
        return value.toFixed(1);
      default:
        return value.toString();
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {section.metrics.map(metricId => (
              <TableHead key={metricId}>{getMetricName(metricId)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableData.map(row => (
            <TableRow key={row.date}>
              <TableCell>{row.date}</TableCell>
              {section.metrics.map(metricId => (
                <TableCell key={metricId}>
                  {formatValue(row[metricId] as number | null, metricId)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 