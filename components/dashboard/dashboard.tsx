p'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import {
  EventType,
  EVENT_COLORS,
  DAY_PIVOT_HOUR,
  HOURS_IN_DAY,
  ProcessedData,
  CustomTooltipProps,
  formatTimeToAMPM,
  generateYAxisTicks,
  JournalEntry,
  SleepData,
  DailyLocationStats,
  calculateAverageTime
} from './lib';
import { Social } from './social';
import { Insights } from './insights';
import { FeelingsChart } from './feelings-chart';
import type { Workout } from '@/lib/supabase';
import { getDashboardData } from '@/lib/data';

interface DashboardProps {
  initialTimelineData: ProcessedData[];
  initialSleepData: SleepData[];
  initialLocationData: DailyLocationStats[];
  initialWorkouts: Workout[];
  initialJournals: JournalEntry[];
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
      {payload.map((item, index) => (
        <p key={index} style={{ color: item.dataKey ? EVENT_COLORS[item.dataKey as EventType] : item.name }}>
          {item.name}: {typeof item.value === 'number' ? formatTimeToAMPM(item.value.toString()) : item.value}
        </p>
      ))}
    </div>
  );
};

export function Dashboard({ 
  initialTimelineData,
  initialSleepData,
  initialLocationData,
  initialWorkouts,
  initialJournals 
}: DashboardProps) {
  // --- State ---
  const [timelineData, setTimelineData] = useState<ProcessedData[]>(initialTimelineData);
  const [sleepData, setSleepData] = useState<SleepData[]>(initialSleepData);
  const [timeRange, setTimeRange] = useState('14');
  const [showRawData, setShowRawData] = useState(false);
  const selectedEvents = ['mood_score', 'energy_score', 'journal_start', 'work_start', 'work_end'] as EventType[];
  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [locationData, setLocationData] = useState<DailyLocationStats[]>(initialLocationData);
  const [journals, setJournals] = useState<JournalEntry[]>(initialJournals);
  const [loading, setLoading] = useState(false);

  // Fetch data when timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getDashboardData(parseInt(timeRange));
        
        // Process the data into the required formats
        const processedTimelineData = data.flatMap(day => {
          return day.daily_log_event_type.map((type, index) => ({
            time: day.daily_log_created_at[index],
            type: type as EventType,
            value: type === 'work_end' && day.work_duration ? day.work_duration : undefined
          }));
        });

        const processedSleepData = data.map(day => ({
          date: day.date,
          sleepStart: day.sleep_sleepstart,
          rem: parseFloat(day.sleep_rem),
          core: parseFloat(day.sleep_core),
          source: day.sleep_source,
          inBedStart: day.sleep_inbedstart,
          inBedEnd: day.sleep_inbedend,
          inBed: parseFloat(day.sleep_inbed),
          asleep: parseFloat(day.sleep_asleep),
          awake: parseFloat(day.sleep_awake),
          deep: parseFloat(day.sleep_deep),
          sleepEnd: day.sleep_sleepend
        }));

        const processedLocationData = data.map(day => ({
          date: day.date,
          eventTypes: day.daily_log_event_type,
          createdAt: day.daily_log_created_at,
          workDuration: day.work_duration,
          moodScoreAverage: day.mood_score_average,
          energyScoreAverage: day.energy_score_average
        }));

        const processedJournals = data.map(day => ({
          date: day.date,
          createdAt: day.journals_created_at,
          mood: day.journals_mood,
          moodScore: day.journals_mood_score,
          energyScore: day.journals_energy_score
        }));

        setTimelineData(processedTimelineData);
        setSleepData(processedSleepData);
        setLocationData(processedLocationData);
        setJournals(processedJournals);
        setWorkouts(data.workouts);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  // Calculate averages for insights
  const averages = useMemo(() => {
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
  }, [timelineData]);

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
    if (!timelineData || !timelineData.length) return timelineData;

    const data = [...timelineData];
    const allEvents = [...selectedEvents, 'work_start', 'work_end', 'journal_start'];
    
    // Calculate durations
    data.forEach(item => {
      // Initialize properties if they don't exist
      item.journal_start = item.journal_start || null;
      item.work_start = item.work_start || null;
      item.work_end = item.work_end || null;
      item.asleep = item.asleep || null;
      
      // Calculate journaling duration (journal_start to work_start)
      if (item.journal_start && item.work_start) {
        const journalStart = Number(item.journal_start);
        const workStart = Number(item.work_start);
        if (!isNaN(journalStart) && !isNaN(workStart)) {
          item.journaling_duration = workStart - journalStart;
        }
      }

      // Calculate work duration (work_start to work_end)
      if (item.work_start && item.work_end) {
        const workStart = Number(item.work_start);
        const workEnd = Number(item.work_end);
        if (!isNaN(workStart) && !isNaN(workEnd)) {
          item.work_duration = workEnd - workStart;
        }
      }

      // Calculate leisure duration (work_end to asleep)
      if (item.work_end && item.asleep) {
        const workEnd = Number(item.work_end);
        let sleepTime = Number(item.asleep);
        // Adjust sleep time if it's after midnight
        if (!isNaN(workEnd) && !isNaN(sleepTime)) {
          if (sleepTime < DAY_PIVOT_HOUR) {
            sleepTime += HOURS_IN_DAY;
          }
          item.leisure_duration = sleepTime - workEnd;
        }
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
  }, [selectedEvents, timelineData, timeRange]);

  // Calculate chart lines
  const chartLines = useMemo(() => {
    if (!timelineData || !timelineData.length) return [];

    return selectedEvents.flatMap(eventType => {
      const isScore = ['mood_score', 'energy_score'].includes(eventType);
      const lines = [];
      
      if (showRawData) {
        // Raw data line
        lines.push(
          <Line 
            key={eventType}
            type="monotoneX" 
            dataKey={eventType} 
            stroke={EVENT_COLORS[eventType]}
            name={eventType.replace('_', ' ')}
            dot={{ r: 2, fill: EVENT_COLORS[eventType], strokeWidth: 1, fillOpacity: 0.6 }}
            yAxisId={isScore ? 'score' : 'time'}
            strokeWidth={2}
          />
        );
      }

      // Moving average line
      const maKey = `${eventType}_ma`;
      lines.push(
        <Line 
          key={maKey}
          type="monotoneX"
          dataKey={maKey}
          stroke={EVENT_COLORS[eventType]}
          strokeWidth={2}
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

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50/30">
        <div className="space-y-4 text-center">
          <div className="custom-loader rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">Loading insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-6 space-y-6">
      {/* Header Section */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-100 -mx-4 px-4 py-3 md:-mx-6 md:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
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
              <SelectTrigger className="w-[120px]">
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

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sleep Chart */}
        <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-xl font-semibold">Sleep Patterns</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="w-full h-[40vh] min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sleepData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="time"
                    domain={[0, 24]} 
                    ticks={generateYAxisTicks()} 
                    tickFormatter={formatTimeToAMPM}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  {showRawData && (
                    <>
                      <Line 
                        type="monotoneX" 
                        dataKey="asleep" 
                        stroke={EVENT_COLORS.asleep}
                        name="Sleep Time"
                        dot={{ r: 2, fill: EVENT_COLORS.asleep, strokeWidth: 1, fillOpacity: 0.6 }}
                        yAxisId="time"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotoneX" 
                        dataKey="awake" 
                        stroke={EVENT_COLORS.awake}
                        name="Wake Time"
                        dot={{ r: 2, fill: EVENT_COLORS.awake, strokeWidth: 1, fillOpacity: 0.6 }}
                        yAxisId="time"
                        strokeWidth={2}
                      />
                    </>
                  )}
                  <Line 
                    type="monotoneX"
                    dataKey="asleep_ma"
                    stroke={EVENT_COLORS.asleep}
                    strokeWidth={2}
                    strokeDasharray={showRawData ? "5 5" : undefined}
                    dot={false}
                    yAxisId="time"
                    connectNulls
                    name={showRawData ? undefined : "Sleep Time"}
                    legendType={showRawData ? "none" : undefined}
                  />
                  <Line 
                    type="monotoneX"
                    dataKey="awake_ma"
                    stroke={EVENT_COLORS.awake}
                    strokeWidth={2}
                    strokeDasharray={showRawData ? "5 5" : undefined}
                    dot={false}
                    yAxisId="time"
                    connectNulls
                    name={showRawData ? undefined : "Wake Time"}
                    legendType={showRawData ? "none" : undefined}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Chart */}
        <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-xl font-semibold">Daily Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="w-full h-[40vh] min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={enhancedTimelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="time"
                    domain={[0, 24]} 
                    ticks={generateYAxisTicks()} 
                    tickFormatter={formatTimeToAMPM}
                    tick={{ fontSize: 12 }}
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
          </CardContent>
        </Card>
      </div>

      {/* Social Section */}
      <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-semibold">Social & Location</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <Social locationData={locationData} />
        </CardContent>
      </Card>

      {/* Feelings Chart */}
      <Card className="bg-white/50 backdrop-blur-sm border-gray-100">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-xl font-semibold">Feelings & States</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <FeelingsChart data={journals} />
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
          <p className="text-sm text-muted-foreground mt-1">Tracking fitness using Apple Health data - dubious accuracy lol</p>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-6">
            {/* Group workouts by type */}
            {Object.entries(
              (workouts || []).reduce((acc, workout) => {
                const type = workout.workout_type || 'Other';
                if (!acc[type]) acc[type] = [];
                acc[type].push(workout);
                return acc;
              }, {} as Record<string, Workout[]>)
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
                                orientation="left"
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
                                type="monotoneX"
                                dataKey="duration"
                                stroke="#10b981"
                                name="Duration"
                                yAxisId="duration"
                                dot={{ r: 2, strokeWidth: 1, fillOpacity: 0.6 }}
                              />
                              <Line 
                                type="monotoneX"
                                dataKey="distance"
                                stroke="#3b82f6"
                                name="Distance"
                                yAxisId="distance"
                                dot={{ r: 2, strokeWidth: 1, fillOpacity: 0.6 }}
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
                                <p className="font-medium text-sm">{workout.workout_type}</p>
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
    </div>
  );
}
