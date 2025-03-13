'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, LineChart, PieChart, Table, LayoutDashboard, Activity } from 'lucide-react';
import type { DashboardSection } from '../types';

interface DashboardControlsProps {
  onAddSection: (type: DashboardSection['type']) => void;
}

const VISUALIZATION_TYPES: Array<{
  type: DashboardSection['type'];
  icon: React.ReactNode;
  label: string;
}> = [
  { type: 'line', icon: <LineChart className="w-4 h-4" />, label: 'Line Chart' },
  { type: 'bar', icon: <BarChart className="w-4 h-4" />, label: 'Bar Chart' },
  { type: 'pie', icon: <PieChart className="w-4 h-4" />, label: 'Pie Chart' },
  { type: 'scatter', icon: <Activity className="w-4 h-4" />, label: 'Scatter Plot' },
  { type: 'stat', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Stats' },
  { type: 'table', icon: <Table className="w-4 h-4" />, label: 'Table' },
];

export function DashboardControls({ onAddSection }: DashboardControlsProps) {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <h3 className="font-medium mb-2">Add Visualization</h3>
        <div className="grid grid-cols-3 gap-2">
          {VISUALIZATION_TYPES.map(({ type, icon, label }) => (
            <Button
              key={type}
              variant="outline"
              className="flex flex-col items-center gap-1 h-auto py-4"
              onClick={() => onAddSection(type)}
            >
              {icon}
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 