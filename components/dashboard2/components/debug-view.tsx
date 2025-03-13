'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { ProcessedData, SleepData, DailyLocationStats, JournalEntry } from '@/components/dashboard/lib';
import type { Workout } from '@/lib/supabase';
import styles from './debug-view.module.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DebugViewProps {
  data: {
    timeline: ProcessedData[];
    sleep: SleepData[];
    location: DailyLocationStats[];
    workouts: Workout[];
    journals: JournalEntry[];
  };
}

interface DataTableProps<T> {
  title: string;
  data: T[];
}

function DataTable<T extends object>({ title, data }: DataTableProps<T>) {
  if (!data || data.length === 0) return null;
  
  const columns = Object.keys(data[0]);
  
  return (
    <Card className={`h-full overflow-hidden ${styles.debugCard}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className={styles.tableContainer}>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {columns.map((col) => (
                <th key={col} className="text-left p-2 text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b">
                {columns.map((col) => (
                  <td key={col} className="p-2">
                    {typeof (row as any)[col] === 'object' 
                      ? JSON.stringify((row as any)[col]) 
                      : String((row as any)[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function DebugView({ data }: DebugViewProps) {
  const layouts = {
    lg: [
      { i: 'timeline', x: 0, y: 0, w: 6, h: 4 },
      { i: 'sleep', x: 6, y: 0, w: 6, h: 4 },
      { i: 'location', x: 0, y: 4, w: 6, h: 4 },
      { i: 'workouts', x: 6, y: 4, w: 6, h: 4 },
      { i: 'journals', x: 0, y: 8, w: 12, h: 4 },
    ]
  };

  return (
    <div className={styles.debugContainer}>
      <h2 className="text-2xl font-bold mb-4">Debug View - Raw Data</h2>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        isDraggable={true}
        isResizable={true}
      >
        <div key="timeline">
          <DataTable<ProcessedData> title="Timeline Data" data={data.timeline} />
        </div>
        <div key="sleep">
          <DataTable<SleepData> title="Sleep Data" data={data.sleep} />
        </div>
        <div key="location">
          <DataTable<DailyLocationStats> title="Location Data" data={data.location} />
        </div>
        <div key="workouts">
          <DataTable<Workout> title="Workout Data" data={data.workouts} />
        </div>
        <div key="journals">
          <DataTable<JournalEntry> title="Journal Data" data={data.journals} />
        </div>
      </ResponsiveGridLayout>
    </div>
  );
} 