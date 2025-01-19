'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSupabase } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import {
  EventType,
  EVENT_COLORS,
  DAY_PIVOT_HOUR,
  HOURS_IN_DAY,
  ProcessedData,
  CustomTooltipProps,
  formatTimeToAMPM,
  generateYAxisTicks,
  processEventData,
  JournalEntry,
  TIMEZONE,
  calculateAverageTime,
  SleepData,
  processSleepData,
  processLocationData,
  DailyLocationStats
} from './lib';
import { Social } from './social';
import { Insights } from './insights';

interface Workout {
  id: string;
  workout_type: string;
  start_time: string;
  duration: string; // PostgreSQL interval comes as a string like '1 hour 30 minutes'
  total_energy_kj: string;
  distance_km: string | null;
}

// Custom tooltip type
interface TooltipPayloadItem {
  value: string | number;
  name: string;
  stroke?: string;
  dataKey?: string | number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-200 rounded-lg shadow-md">
      <p className="font-medium">{label}</p>
      {payload
        .filter((item: TooltipPayloadItem) => !item.dataKey?.toString().includes('_ma'))
        .map((item: TooltipPayloadItem, index: number) => {
          const value = typeof item.value === 'string' ? parseFloat(item.value) : item.value;
          const name = item.name.toLowerCase().replace(/ /g, '_');
          const isTimeValue = ['sleep_start', 'wake_up', 'journal_start', 'work_start', 'work_end'].includes(name);
          const isDuration = name === 'sleep_duration';
          const isScore = ['mood_score', 'energy_score'].includes(name);
          
          let displayValue: string | number = value;
          let unit = '';
          
          if (isTimeValue) {
            displayValue = formatTimeToAMPM(Number(value));
          } else if (isDuration) {
            displayValue = Number(value).toFixed(1);
            unit = ' hours';
          } else if (isScore) {
            displayValue = Number(value).toFixed(2);
            unit = ' points';
          }
          
          return (
            <p key={index} style={{ color: item.stroke }}>
              {`${item.name}: ${displayValue}${unit}`}
            </p>
          );
      })}
    </div>
  );
};

export function Dashboard() {
  // --- State ---
  const [timelineData, setTimelineData] = useState<ProcessedData[]>([]);
  const [sleepData, setSleepData] = useState<SleepData[]>([]);
  const [timeRange, setTimeRange] = useState('14');
  const [showRawData, setShowRawData] = useState(false);
  const selectedEvents = ['mood_score', 'energy_score', 'journal_start', 'work_start', 'work_end'] as EventType[];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [locationData, setLocationData] = useState<DailyLocationStats[]>([]);

  // Get moving average window size based on time range
  const getMovingAverageWindow = (days: number) => {
    if (days <= 7) return 5;
    if (days <= 14) return 7;
    if (days <= 30) return 14;
    if (days <= 60) return 21;
    return 30;
  };

  // Calculate moving average for a data series
  const calculateMovingAverage = <T extends Record<string, string | number | null>>(data: T[], field: keyof T) => {
    const window = getMovingAverageWindow(parseInt(timeRange));
    return data.map((_, index) => {
      // Use a wider range for the moving average calculation
      const halfWindow = Math.floor(window / 2);
      const start = Math.max(0, index - halfWindow);
      const end = Math.min(data.length, index + halfWindow + 1);
      const values = data.slice(start, end)
        .map(d => {
          const value = d[field];
          // Handle time values (convert to decimal hours if needed)
          if (typeof value === 'string' && value.includes(':')) {
            const [hours, minutes] = value.split(':').map(Number);
            return hours + minutes / 60;
          }
          return Number(value);
        })
        .filter(v => !isNaN(v));
      
      if (values.length === 0) return null;
      
      // Use weighted average, giving more weight to closer points
      let weightedSum = 0;
      let weightSum = 0;
      values.forEach((val, i) => {
        const distance = Math.abs(i - halfWindow);
        const weight = 1 / (distance + 1);
        weightedSum += val * weight;
        weightSum += weight;
      });
      
      return weightedSum / weightSum;
    });
  };

  // Memoize enhanced timeline data with moving averages and durations
  const enhancedTimelineData = useMemo(() => {
    if (!timelineData.length) return timelineData;

    const data = [...timelineData];
    const allEvents = [...selectedEvents, 'work_start', 'work_end', 'journal_start'];
    
    // Calculate durations
    data.forEach(item => {
      // Calculate journaling duration (journal_start to work_start)
      if (item.journal_start !== null && item.work_start !== null) {
        const journalStart = Number(item.journal_start);
        const workStart = Number(item.work_start);
        item.journaling_duration = workStart - journalStart;
      }

      // Calculate work duration (work_start to work_end)
      if (item.work_start !== null && item.work_end !== null) {
        const workStart = Number(item.work_start);
        const workEnd = Number(item.work_end);
        item.work_duration = workEnd - workStart;
      }

      // Calculate leisure duration (work_end to asleep)
      if (item.work_end !== null && item.asleep !== null) {
        const workEnd = Number(item.work_end);
        let sleepTime = Number(item.asleep);
        // Adjust sleep time if it's after midnight
        if (sleepTime < DAY_PIVOT_HOUR) {
          sleepTime += HOURS_IN_DAY;
        }
        item.leisure_duration = sleepTime - workEnd;
      }
    });

    // Calculate moving averages for events
    allEvents.forEach(eventType => {
      const movingAverages = calculateMovingAverage(timelineData, eventType as keyof ProcessedData);
      data.forEach((item, index) => {
        item[`${eventType}_ma`] = movingAverages[index];
      });
    });

    return data;
  }, [selectedEvents, timelineData]);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');

        // Fetch sleep data
        const sleepExportData = await fetchSupabase('sleep_export', {
          select: '*',
          created_at: `gte.${startDate}`,
          order: 'created_at.asc'
        });
        
        // Process and filter sleep data for the selected time range
        const processedSleepData = processSleepData(sleepExportData)
          .filter(d => {
            const date = new Date(d.date);
            const start = new Date(startDate);
            return date >= start;
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Add moving averages to sleep data
        const asleepMA = calculateMovingAverage(processedSleepData, 'asleep');
        const awakeMA = calculateMovingAverage(processedSleepData, 'awake');
        const durationMA = calculateMovingAverage(processedSleepData, 'duration');
        
        const sleepDataWithMA = processedSleepData.map((data, index) => ({
          ...data,
          asleep_ma: asleepMA[index],
          awake_ma: awakeMA[index],
          duration_ma: durationMA[index]
        }));
        
        setSleepData(sleepDataWithMA);

        // Fetch workouts
        const workoutData = await fetchSupabase('workouts', {
          select: '*',
          start_time: `gte.${startDate}`,
          order: 'start_time.desc'
        });
        setWorkouts(workoutData);
        
        // Fetch daily logs
        const events = await fetchSupabase('daily_log', {
          select: '*',
          created_at: `gte.${startDate}`,
          order: 'created_at.asc'
        });

        // Fetch journal entries
        const journals = await fetchSupabase('journals', {
          select: '*',
          created_at: `gte.${startDate}`,
          order: 'created_at.asc'
        });

        // Process daily logs
        const processedEvents = processEventData(events);

        // Process and merge journal data
        const mergedData = processedEvents.map(dayData => {
          const date = dayData.date;
          const dayJournals = journals.filter((j: JournalEntry) => 
            formatInTimeZone(toZonedTime(j.created_at, TIMEZONE), TIMEZONE, 'yyyy-MM-dd') === date
          );

          if (dayJournals.length > 0) {
            // Use the latest journal entry for the day
            const latestJournal = dayJournals[dayJournals.length - 1];
            return {
              ...dayData,
              mood_score: latestJournal.mood_score,
              energy_score: latestJournal.energy_score
            };
          }
          return dayData;
        });

        setTimelineData(mergedData);

        // Fetch location data
        const locationLogs = await fetchSupabase('location_log', {
          select: '*',
          created_at: `gte.${startDate}`,
          order: 'created_at.desc'
        });
        const processedLocationData = processLocationData(locationLogs);
        setLocationData(processedLocationData);

      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  // --- Calculations ---
  const calculateAverages = () => {
    // Calculate averages for all event types, not just selected ones
    return Object.keys(EVENT_COLORS).reduce((acc: { [key: string]: string | number }, eventType) => {
      if (['mood_score', 'energy_score'].includes(eventType)) {
        const validValues = timelineData.filter(d => d[eventType] !== null);
        const avg = validValues.length ? 
          validValues.reduce((sum, d) => sum + (Number(d[eventType]) || 0), 0) / validValues.length : 
          0;
        acc[eventType] = avg.toFixed(2);
      } else {
        const avgTime = calculateAverageTime(timelineData, eventType as EventType);
        acc[eventType] = avgTime !== null ? formatTimeToAMPM(avgTime) : '-';
      }
      return acc;
    }, {});
  };

  const averages = calculateAverages();

  // Calculate sleep averages based on the filtered data
  const sleepAverages = useMemo(() => {
    if (!sleepData.length) return { asleep: 0, awake: 0, duration: 0 };

    const asleepSum = sleepData.reduce((sum, d) => sum + d.asleep, 0);
    const awakeSum = sleepData.reduce((sum, d) => sum + d.awake, 0);
    const durationSum = sleepData.reduce((sum, d) => sum + d.duration, 0);

    return {
      asleep: asleepSum / sleepData.length,
      awake: awakeSum / sleepData.length,
      duration: durationSum / sleepData.length
    };
  }, [sleepData]);

  // Calculate chart lines
  const chartLines = useMemo(() => {
    if (!timelineData.length) return [];

    return selectedEvents.flatMap(eventType => {
      const isScore = ['mood_score', 'energy_score'].includes(eventType);
      const lines = [];
      
      if (showRawData) {
        // Raw data line
        lines.push(
          <Line 
            key={eventType}
            type="monotone" 
            dataKey={eventType} 
            stroke={EVENT_COLORS[eventType]}
            name={eventType.replace('_', ' ')}
            dot={{ r: 2, fill: EVENT_COLORS[eventType], strokeWidth: 1, fillOpacity: 0.6 }}
            yAxisId={isScore ? 'score' : 'time'}
          />
        );
      }

      // Moving average line
      const maKey = `${eventType}_ma`;
      lines.push(
        <Line 
          key={maKey}
          type="monotone"
          dataKey={maKey}
          stroke={EVENT_COLORS[eventType]}
          strokeDasharray={showRawData ? "5 5" : undefined}
          dot={false}
          yAxisId={isScore ? 'score' : 'time'}
          connectNulls
          name={showRawData ? undefined : eventType.replace('_', ' ')}
          legendType={showRawData ? "none" : undefined}
        />
      );
      
      return lines;
    });
  }, [selectedEvents, timelineData, showRawData]);

  // --- Loading & Error States ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50/30">
        <div className="space-y-4 text-center">
          <div className="custom-loader rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">Loading your insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50/30">
        <div className="text-red-500 bg-red-50 p-4 rounded-lg border border-red-200 shadow-sm">
          <p className="font-medium">{error}</p>
          <p className="text-sm text-red-400 mt-1">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100 -mx-4 px-4 py-3 md:-mx-6 md:px-6">
        <div className="flex flex-row items-center justify-between gap-4 h-12">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Personal Insights</h1>
            <p className="text-xs text-muted-foreground truncate">Alex&apos;s daily patterns and wellness metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRawData(!showRawData)}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 text-xs font-medium ${
                showRawData 
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-800' 
                  : 'bg-gray-900 hover:bg-gray-800 text-white shadow-sm'
              }`}
            >
              {showRawData ? 'Show Smoothed' : 'Show Raw Data'}
            </button>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-8 w-24 text-xs bg-white shadow-sm border-gray-200 hover:border-gray-300 transition-colors">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Average Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {selectedEvents.map(eventType => (
          <Card key={eventType} className="bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-colors border-gray-100">
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg {eventType.split('_').join(' ')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-gray-900">{averages[eventType]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Timeline */}
      <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-semibold">Daily Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          <div className="w-full h-[50vh] md:h-[60vh] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enhancedTimelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(timelineData.length / 7)}
                />
                <YAxis 
                  yAxisId="time"
                  domain={[DAY_PIVOT_HOUR, DAY_PIVOT_HOUR + HOURS_IN_DAY]}
                  ticks={generateYAxisTicks()}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatTimeToAMPM(value).split(' ')[0]}
                />
                <YAxis 
                  yAxisId="score"
                  orientation="right"
                  domain={[0, 10]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {chartLines}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Durations */}
          <div className="w-full h-[25vh] md:h-[30vh] min-h-[200px] mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enhancedTimelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(timelineData.length / 7)}
                />
                <YAxis
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => `${value.toFixed(1)} hours`}
                />
                <Legend />
                <Bar 
                  dataKey="journaling_duration" 
                  name="Journaling Time"
                  fill={EVENT_COLORS.journal_start} 
                  stackId="a"
                />
                <Bar 
                  dataKey="work_duration" 
                  name="Work Time"
                  fill={EVENT_COLORS.work_start} 
                  stackId="a"
                />
                <Bar 
                  dataKey="leisure_duration" 
                  name="Leisure Time"
                  fill="#8884d8" 
                  stackId="a"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sleep Timeline */}
      <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-semibold">Sleep Insights</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Tracking your sleep patterns using Apple Health data</p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {/* Average Time Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
            <Card className="bg-white/80 border-gray-100">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-gray-600">Average Sleep Time</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-gray-900">{formatTimeToAMPM(sleepAverages.asleep)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/80 border-gray-100">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-gray-600">Average Wake Time</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-gray-900">{formatTimeToAMPM(sleepAverages.awake)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/80 border-gray-100">
              <CardHeader className="p-4">
                <CardTitle className="text-sm font-medium text-gray-600">Average Duration</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold text-gray-900">{sleepAverages.duration.toFixed(1)} hrs</p>
              </CardContent>
            </Card>
          </div>

          <div className="w-full h-[40vh] min-h-[200px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sleepData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(sleepData.length / 7)}
                />
                <YAxis 
                  yAxisId="time"
                  domain={[DAY_PIVOT_HOUR, DAY_PIVOT_HOUR + HOURS_IN_DAY]}
                  ticks={generateYAxisTicks()}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatTimeToAMPM(value).split(' ')[0]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {showRawData && (
                  <Line 
                    type="monotone" 
                    dataKey="asleep" 
                    stroke={EVENT_COLORS.asleep}
                    name="Sleep Start"
                    yAxisId="time"
                    dot={{ r: 2, fill: EVENT_COLORS.asleep, strokeWidth: 1, fillOpacity: 0.6 }}
                  />
                )}
                <Line 
                  type="monotone" 
                  dataKey="asleep_ma"
                  stroke={EVENT_COLORS.asleep}
                  yAxisId="time"
                  dot={false}
                  strokeDasharray={showRawData ? "5 5" : undefined}
                  connectNulls
                  name={showRawData ? undefined : "Sleep Start"}
                  legendType={showRawData ? "none" : undefined}
                />
                {showRawData && (
                  <Line 
                    type="monotone" 
                    dataKey="awake" 
                    stroke={EVENT_COLORS.awake}
                    name="Wake Up"
                    yAxisId="time"
                    dot={{ r: 2, fill: EVENT_COLORS.awake, strokeWidth: 1, fillOpacity: 0.6 }}
                  />
                )}
                <Line 
                  type="monotone" 
                  dataKey="awake_ma"
                  stroke={EVENT_COLORS.awake}
                  yAxisId="time"
                  dot={false}
                  strokeDasharray={showRawData ? "5 5" : undefined}
                  connectNulls
                  name={showRawData ? undefined : "Wake Up"}
                  legendType={showRawData ? "none" : undefined}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sleep Duration Chart */}
          <div className="w-full h-[30vh] min-h-[150px] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(sleepData.length / 7)}
                />
                <YAxis
                  domain={[0, 12]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number) => `${value.toFixed(1)} hours`}
                />
                <Legend />
                <Bar 
                  dataKey="duration" 
                  fill={EVENT_COLORS.duration}
                  name="Sleep Duration"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights Section */}
      <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-semibold">Insights & Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <Insights data={timelineData} averages={averages} />
        </CardContent>
      </Card>

      {/* Workouts Section */}
      <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-semibold">Workouts</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Track your fitness journey</p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-6">
            {/* Group workouts by type */}
            {Object.entries(
              workouts.reduce((acc, workout) => {
                const type = ['Indoor Run', 'Outdoor Run', 'Outdoor Walk'].includes(workout.workout_type) 
                  ? workout.workout_type 
                  : 'Other Exercises';
                if (!acc[type]) {
                  acc[type] = [];
                }
                acc[type].push(workout);
                return acc;
              }, {} as { [key: string]: Workout[] })
            )
            .sort(([a], [b]) => {
              const sortOrder = ['Outdoor Walk', 'Outdoor Run', 'Indoor Run', 'Other Exercises'];
              return sortOrder.indexOf(a) - sortOrder.indexOf(b);
            })
            .map(([type, typeWorkouts]) => {
              // Calculate averages
              const avgDuration = typeWorkouts.reduce((total, w) => {
                if (!w.duration) return total;
                const [hours, minutes, seconds] = w.duration.split(':').map(Number);
                return total + (hours * 60) + minutes + (seconds / 60);
              }, 0) / typeWorkouts.length;

              const avgDistance = typeWorkouts.reduce((total, w) => 
                total + (w.distance_km ? parseFloat(w.distance_km) : 0), 0
              ) / typeWorkouts.length;

              const avgEnergy = typeWorkouts.reduce((total, w) => 
                total + (parseFloat(w.total_energy_kj) / 4.184), 0
              ) / typeWorkouts.length;

              // Prepare chart data
              const chartData = typeWorkouts
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map(w => ({
                  date: format(new Date(w.start_time), 'MMM d'),
                  duration: (() => {
                    const [hours, minutes, seconds] = w.duration.split(':').map(Number);
                    return (hours * 60) + minutes + (seconds / 60);
                  })(),
                  distance: w.distance_km ? parseFloat(w.distance_km) : 0,
                  energy: parseFloat(w.total_energy_kj) / 4.184
                }));

              return (
                <div key={type} className="space-y-4">
                  <Card className="bg-white/80 border-gray-100">
                    <CardHeader className="p-4 md:p-6">
                      <CardTitle className="text-lg font-semibold">{type}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      <div className={`grid grid-cols-1 ${['Indoor Run', 'Outdoor Run', 'Outdoor Walk'].includes(type) ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3 md:gap-4 mb-6`}>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Total Workouts</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{typeWorkouts.length}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Avg Duration</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{avgDuration.toFixed(0)} mins</p>
                          </CardContent>
                        </Card>
                        {['Indoor Run', 'Outdoor Run', 'Outdoor Walk'].includes(type) && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Avg Distance</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-xl font-bold">{avgDistance.toFixed(2)} km</p>
                            </CardContent>
                          </Card>
                        )}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Avg Energy</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xl font-bold">{avgEnergy.toFixed(0)} kcal</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Only show trend chart for running/walking activities */}
                      {['Indoor Run', 'Outdoor Run', 'Outdoor Walk'].includes(type) && (
                        <div className="w-full h-[40vh] min-h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis 
                                yAxisId="duration"
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Duration (mins)', angle: -90, position: 'insideLeft' }}
                              />
                              <YAxis 
                                yAxisId="distance"
                                orientation="right"
                                tick={{ fontSize: 12 }}
                                label={{ value: 'Distance (km)', angle: 90, position: 'insideRight' }}
                              />
                              <Tooltip />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="duration" 
                                stroke="#8884d8" 
                                yAxisId="duration"
                                name="Duration"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="distance" 
                                stroke="#82ca9d" 
                                yAxisId="distance"
                                name="Distance"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Recent workouts list */}
                      <div className="mt-6 space-y-4">
                        <h4 className="font-semibold">recent {type === 'Other Exercises' ? 'Workouts' : `${type} workouts`}</h4>
                        {typeWorkouts.slice(0, type === 'Other Exercises' ? 5 : 3).map((workout) => (
                          <Card key={workout.id} className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                {type === 'Other Exercises' && (
                                  <p className="font-medium text-sm">{workout.workout_type}</p>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(workout.start_time), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm">Duration: {workout.duration}</p>
                                {['Indoor Run', 'Outdoor Run', 'Outdoor Walk'].includes(type) && workout.distance_km && (
                                  <p className="text-sm">Distance: {parseFloat(workout.distance_km).toFixed(2)} km</p>
                                )}
                                <p className="text-sm">Energy: {(parseFloat(workout.total_energy_kj) / 4.184).toFixed(0)} kcal</p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Social Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold px-1">Social</h2>
        <Social locationData={locationData} />
      </div>
    </div>
  );
}
