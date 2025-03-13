'use client';

import React from 'react';
import { Dashboard2 } from './dashboard';
import type { DashboardConfig } from './types';
import type { ProcessedData, SleepData, DailyLocationStats, JournalEntry } from '@/components/dashboard/lib';
import type { Workout } from '@/lib/supabase';

interface DashboardData {
  timeline: ProcessedData[];
  sleep: SleepData[];
  location: DailyLocationStats[];
  workouts: Workout[];
  journals: JournalEntry[];
}

interface Dashboard2WrapperProps {
  initialConfig: DashboardConfig;
  data: DashboardData;
}

export function Dashboard2Wrapper({ initialConfig, data }: Dashboard2WrapperProps) {
  const handleConfigChange = (config: DashboardConfig) => {
    // Save config to local storage or database
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardConfig', JSON.stringify(config));
    }
    console.log('Saving config:', config);
  };

  return (
    <Dashboard2
      initialConfig={initialConfig}
      data={data}
      onConfigChange={handleConfigChange}
    />
  );
} 