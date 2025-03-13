import { Suspense } from 'react'
import { getDashboardData, getSleepData, getWorkouts, getJournals, getDailyLogs } from '@/lib/data'
import { Dashboard2Wrapper } from '@/components/dashboard2/dashboard-wrapper'
import type { DashboardConfig } from '@/components/dashboard2/types'
import { ProcessedData, EventType } from '@/components/dashboard/lib'

export const revalidate = 300 // Revalidate every 5 minutes

// Initial dashboard configuration
const initialConfig: DashboardConfig = {
  id: 'main-dashboard',
  name: 'Health & Activity Dashboard',
  sections: [
    {
      id: 'timeline',
      title: 'Daily Activity',
      type: 'line',
      metrics: ['work_duration', 'mood'],
      layout: { x: 0, y: 0, w: 12, h: 4 },
      settings: {
        showGrid: true,
        showLegend: true,
        showMovingAverage: true,
        movingAverageWindow: 7
      }
    },
    {
      id: 'sleep',
      title: 'Sleep Patterns',
      type: 'bar',
      metrics: ['sleep_duration', 'deep_sleep', 'rem_sleep'],
      layout: { x: 0, y: 4, w: 6, h: 4 },
      settings: {
        showGrid: true,
        showLegend: true
      }
    },
    {
      id: 'energy',
      title: 'Energy & Mood Trends',
      type: 'line',
      metrics: ['energy', 'mood'],
      layout: { x: 6, y: 4, w: 6, h: 4 },
      settings: {
        showGrid: true,
        showLegend: true,
        showMovingAverage: true,
        movingAverageWindow: 7
      }
    },
    {
      id: 'activity',
      title: 'Daily Activity Stats',
      type: 'stat',
      metrics: ['time_outside', 'work_duration', 'sleep_duration'],
      layout: { x: 0, y: 8, w: 12, h: 2 },
      settings: {
        showLabels: true
      }
    }
  ],
  availableMetrics: [
    {
      id: 'mood',
      name: 'Mood Score',
      description: 'Daily mood rating (1-10)',
      type: 'number',
      dataSource: 'timeline',
      dataKey: 'mood_score',
      color: '#FF69B4',
      format: '0.0'
    },
    {
      id: 'energy',
      name: 'Energy Level',
      description: 'Daily energy rating (1-10)',
      type: 'number',
      dataSource: 'timeline',
      dataKey: 'energy_score',
      color: '#4169E1',
      format: '0.0'
    },
    {
      id: 'work_duration',
      name: 'Work Duration',
      description: 'Total work hours',
      type: 'duration',
      dataSource: 'timeline',
      dataKey: 'work_duration',
      color: '#FFA500',
      format: '0.0h',
      aggregation: 'sum'
    },
    {
      id: 'journal_time',
      name: 'Journal Time',
      description: 'Time spent journaling',
      type: 'time',
      dataSource: 'timeline',
      dataKey: 'journal_start',
      color: '#00C49F'
    },
    {
      id: 'work_start',
      name: 'Work Start',
      description: 'Work start time',
      type: 'time',
      dataSource: 'timeline',
      dataKey: 'work_start',
      color: '#ffc658'
    },
    {
      id: 'work_end',
      name: 'Work End',
      description: 'Work end time',
      type: 'time',
      dataSource: 'timeline',
      dataKey: 'work_end',
      color: '#ff7300'
    },
    {
      id: 'sleep_start',
      name: 'Sleep Start',
      description: 'Sleep start time',
      type: 'time',
      dataSource: 'sleep',
      dataKey: 'sleepStart',
      color: '#8884d8'
    },
    {
      id: 'sleep_end',
      name: 'Sleep End',
      description: 'Sleep end time',
      type: 'time',
      dataSource: 'sleep',
      dataKey: 'sleepEnd',
      color: '#82ca9d'
    },
    {
      id: 'sleep_duration',
      name: 'Sleep Duration',
      description: 'Total sleep duration',
      type: 'duration',
      dataSource: 'sleep',
      dataKey: 'duration',
      color: '#8884d8',
      format: '0.0h',
      aggregation: 'average'
    },
    {
      id: 'deep_sleep',
      name: 'Deep Sleep',
      description: 'Deep sleep duration',
      type: 'duration',
      dataSource: 'sleep',
      dataKey: 'deep',
      color: '#413ea0',
      format: '0.0h',
      aggregation: 'average'
    },
    {
      id: 'rem_sleep',
      name: 'REM Sleep',
      description: 'REM sleep duration',
      type: 'duration',
      dataSource: 'sleep',
      dataKey: 'rem',
      color: '#ff7300',
      format: '0.0h',
      aggregation: 'average'
    },
    {
      id: 'time_outside',
      name: 'Time Outside',
      description: 'Time spent outside',
      type: 'duration',
      dataSource: 'location',
      dataKey: 'timeOutside',
      color: '#82ca9d',
      format: '0.0h',
      aggregation: 'sum'
    }
  ],
  layout: {
    cols: 12,
    rowHeight: 100,
    padding: 16
  }
};

export default async function Dashboard2Page() {
  // Get raw data from database
  const data = await getDashboardData();

  // Get individual data sets using the helper functions
  const sleepData = await getSleepData();
  const workouts = await getWorkouts(); // This now fetches the correctly typed workouts
  const journals = await getJournals();
  const locationData = await getDailyLogs();

  // Process the data into the required formats for the Dashboard component
  const processedTimelineData = data.flatMap(day => {
    return day.daily_log_event_type.map((type, index) => ({
      time: day.daily_log_created_at[index],
      type: type as EventType,
      work_duration: day.work_duration,
      mood_score: day.journals_mood_score,
      energy_score: day.journals_energy_score,
      work_start: day.daily_log_event_type.includes('work_start') 
        ? day.daily_log_created_at[day.daily_log_event_type.indexOf('work_start')] 
        : null,
      work_end: day.daily_log_event_type.includes('work_end')
        ? day.daily_log_created_at[day.daily_log_event_type.indexOf('work_end')]
        : null,
      journal_start: day.daily_log_event_type.includes('journal_start')
        ? day.daily_log_created_at[day.daily_log_event_type.indexOf('journal_start')]
        : null
    })) as ProcessedData[];
  });

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50/30">
        <div className="space-y-4 text-center">
          <div className="custom-loader rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">Loading insights...</p>
        </div>
      </div>
    }>
      <Dashboard2Wrapper 
        initialConfig={initialConfig}
        data={{
          timeline: processedTimelineData,
          sleep: sleepData,
          location: locationData,
          workouts: workouts,
          journals: journals
        }}
      />
    </Suspense>
  )
} 