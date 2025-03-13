'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart } from './charts/line-chart';
import { BarChart } from './charts/bar-chart';
import { PieChart } from './charts/pie-chart';
import { ScatterChart } from './charts/scatter-chart';
import { StatDisplay } from './charts/stat-display';
import { DataTable } from './charts/data-table';
import type { DashboardSection } from '../types';
import type { ProcessedData, SleepData, DailyLocationStats, JournalEntry } from '@/components/dashboard/lib';

export interface DashboardData {
  timeline: ProcessedData[];
  sleep: SleepData[];
  location: DailyLocationStats[];
  journals: JournalEntry[];
}

interface VisualizationSectionProps {
  section: DashboardSection;
  data: DashboardData;
  isEditing: boolean;
  onRemove: () => void;
}

export function VisualizationSection({ section, data, isEditing, onRemove }: VisualizationSectionProps) {
  const renderVisualization = () => {
    const props = { section, data };
    
    switch (section.type) {
      case 'line':
        return <LineChart {...props} />;
      case 'bar':
        return <BarChart {...props} />;
      case 'pie':
        return <PieChart {...props} />;
      case 'scatter':
        return <ScatterChart {...props} />;
      case 'stat':
        return <StatDisplay {...props} />;
      case 'table':
        return <DataTable {...props} />;
      default:
        return <div>Unsupported visualization type</div>;
    }
  };

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {section.title}
        </CardTitle>
        {isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {renderVisualization()}
      </CardContent>
    </>
  );
} 