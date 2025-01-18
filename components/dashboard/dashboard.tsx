'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  processSleepData
} from './lib';

interface Workout {
  id: string;
  workout_type: string;
  start_time: string;
  duration: string; // PostgreSQL interval comes as a string like '1 hour 30 minutes'
  total_energy_kj: string;
  distance_km: string | null;
}
import { Insights } from './insights';

// Custom tooltip type
interface TooltipPayloadItem {
  value: string | number;
  name: string;
  stroke?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-200 rounded-lg shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((item: TooltipPayloadItem, index: number) => {
        const value = typeof item.value === 'string' ? parseFloat(item.value) : item.value;
        const isSleep = item.name === 'asleep';
        const isNextDay = isSleep && value >= HOURS_IN_DAY;
        
        return (
          <p key={index} style={{ color: item.stroke }}>
            {`${item.name}: ${isSleep || item.name === 'awake' ? formatTimeToAMPM(value) : value.toFixed(2)}`}
            {isNextDay && ' (next day)'}
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
  const [selectedEvents, setSelectedEvents] = useState<EventType[]>(['mood_score', 'energy_score']);
  const [selectedSleepMetrics, setSelectedSleepMetrics] = useState<EventType[]>(['core', 'rem', 'deep']);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  // Get moving average window size based on time range
  const getMovingAverageWindow = (days: number) => {
    if (days <= 7) return 3;
    if (days <= 14) return 5;
    if (days <= 30) return 7;
    if (days <= 60) return 14;
    return 21;
  };

  // Calculate moving average for a data series
  const calculateMovingAverage = (data: ProcessedData[], field: keyof ProcessedData) => {
    const window = getMovingAverageWindow(parseInt(timeRange));
    return data.map((item, index) => {
      const start = Math.max(0, index - Math.floor(window / 2));
      const end = Math.min(data.length, start + window);
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
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      return avg;
    });
  };

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
          order: 'created_at.desc'
        });
        const processedSleepData = processSleepData(sleepExportData);
        setSleepData(processedSleepData);

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
          created_at: `gte.${startDate}`
        });

        // Fetch journal entries
        const journals = await fetchSupabase('journals', {
          select: '*',
          created_at: `gte.${startDate}`
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
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  // --- Event Handlers ---
  const toggleEventType = (eventType: EventType) => {
    setSelectedEvents(prev => 
      prev.includes(eventType) 
        ? prev.filter(e => e !== eventType)
        : [...prev, eventType]
    );
  };

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

  // Memoize enhanced timeline data with moving averages
  const enhancedTimelineData = useMemo(() => {
    if (!timelineData.length) return timelineData;

    const data = [...timelineData];
    if (showMovingAverage) {
      selectedEvents.forEach(eventType => {
        if (['mood_score', 'energy_score'].includes(eventType)) {
          const movingAverages = calculateMovingAverage(timelineData, eventType as keyof ProcessedData);
          data.forEach((item, index) => {
            item[`${eventType}_ma`] = movingAverages[index];
          });
        }
      });
    }
    return data;
  }, [showMovingAverage, selectedEvents, timelineData]);

  // Calculate chart lines
  const chartLines = useMemo(() => {
    if (!timelineData.length) return [];

    return selectedEvents.flatMap(eventType => {
      const isScore = ['mood_score', 'energy_score'].includes(eventType);
      const lines = [];
      
      // Main data line
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

      // Moving average line for scores
      if (showMovingAverage && isScore) {
        const maKey = `${eventType}_ma`;
        lines.push(
          <Line 
            key={maKey}
            type="monotone"
            dataKey={maKey}
            stroke={EVENT_COLORS[eventType]}
            strokeDasharray="5 5"
            name={`${eventType.replace('_', ' ')} (MA)`}
            dot={false}
            yAxisId="score"
          />
        );
      }
      
      return lines;
    });
  }, [selectedEvents, showMovingAverage, timelineData, EVENT_COLORS]);

  // --- Loading & Error States ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="custom-loader rounded-full h-32 w-32 border-4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="max-w-[1000px] mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="dashboard-header flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Personal Insights</h1>
          <p className="text-muted-foreground">Alex&apos;s daily patterns and wellness metrics</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white/95 transition-colors">
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

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Moving Average Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="moving-average"
            checked={showMovingAverage}
            onCheckedChange={() => setShowMovingAverage(prev => !prev)}
          />
          <label
            htmlFor="moving-average"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show Moving Average
          </label>
        </div>
        
        {/* Event Type Toggles */}
        {Object.entries(EVENT_COLORS).map(([eventType, color]) => (
          <div key={eventType} className="flex items-center space-x-2">
            <Checkbox
              id={eventType}
              checked={selectedEvents.includes(eventType as EventType)}
              onCheckedChange={() => toggleEventType(eventType as EventType)}
            />
            <label
              htmlFor={eventType}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              style={{ color }}
            >
              {eventType.replace('_', ' ')}
            </label>
          </div>
        ))}
      </div>

      {/* Average Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {selectedEvents.map(eventType => (
          <Card key={eventType} className="card">
            <CardHeader>
              <CardTitle className="text-sm">
                Avg {eventType.replace('_', ' ')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{averages[eventType]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Timeline */}
      <Card className="card">
        <CardHeader>
          <CardTitle>Daily Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="w-full h-[60vh] min-h-[300px]">
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
        </CardContent>
      </Card>

      {/* Sleep Timeline */}
      <Card className="card">
        <CardHeader>
          <CardTitle>Sleep Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-4 mb-4">
            {['core', 'rem', 'deep'].map((metric) => (
              <div key={metric} className="flex items-center space-x-2">
                <Checkbox
                  id={`sleep-${metric}`}
                  checked={selectedSleepMetrics.includes(metric as EventType)}
                  onCheckedChange={() => {
                    setSelectedSleepMetrics(prev => 
                      prev.includes(metric as EventType)
                        ? prev.filter(m => m !== metric)
                        : [...prev, metric as EventType]
                    );
                  }}
                />
                <label
                  htmlFor={`sleep-${metric}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  style={{ color: EVENT_COLORS[metric as EventType] }}
                >
                  {metric.toUpperCase()}
                </label>
              </div>
            ))}
          </div>

          <div className="w-full h-[60vh] min-h-[300px]">
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
                <YAxis 
                  yAxisId="duration"
                  orientation="right"
                  domain={[0, 10]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="asleep" 
                  stroke={EVENT_COLORS.asleep}
                  name="Sleep Start"
                  yAxisId="time"
                  dot={{ r: 2, fill: EVENT_COLORS.asleep, strokeWidth: 1, fillOpacity: 0.6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="awake" 
                  stroke={EVENT_COLORS.awake}
                  name="Wake Up"
                  yAxisId="time"
                  dot={{ r: 2, fill: EVENT_COLORS.awake, strokeWidth: 1, fillOpacity: 0.6 }}
                />
                {selectedSleepMetrics.map((metric) => (
                  <Line 
                    key={metric}
                    type="monotone" 
                    dataKey={metric.toLowerCase()}
                    stroke={EVENT_COLORS[metric]}
                    name={`${metric.toUpperCase()} Sleep`}
                    yAxisId="duration"
                    dot={{ r: 2, fill: EVENT_COLORS[metric], strokeWidth: 1, fillOpacity: 0.6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights Section */}
      <Card className="card">
        <CardHeader>
          <CardTitle>Insights & Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Insights data={timelineData} averages={averages} />
        </CardContent>
      </Card>

      {/* Workouts Section */}
      <Card className="card">
        <CardHeader>
          <CardTitle>Workouts</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Group workouts by type and show stats */}
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
                  <Card>
                    <CardHeader>
                      <CardTitle>{type}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                      <div className={`grid grid-cols-1 ${['Indoor Run', 'Outdoor Run', 'Outdoor Walk'].includes(type) ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 mb-6`}>
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
    </div>
  );
}
