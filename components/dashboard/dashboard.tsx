'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchSupabase } from '@/lib/supabase';
import { format, subDays } from 'date-fns';
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
} from './lib';

// --- Custom Components ---
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
      <p className="font-medium">{label}</p>
      {payload.map((item: any, index: number) => {
        const value = item.value;
        const isNextDay = value >= HOURS_IN_DAY;
        return (
          <p key={index} style={{ color: item.color }}>
            {`${item.name}: ${formatTimeToAMPM(value)}`}
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
  const [timeRange, setTimeRange] = useState('30');
  const [selectedEvents, setSelectedEvents] = useState<EventType[]>(['awake', 'asleep']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');
        
        const events = await fetchSupabase('daily_log', {
          select: '*',
          created_at: `gte.${startDate}`
        });

        const processedData = processEventData(events);
        setTimelineData(processedData);
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
    return selectedEvents.reduce((acc: { [key: string]: string }, eventType) => {
      const validTimes = timelineData.filter(d => d[eventType] !== null);
      const avg = validTimes.length ? 
        validTimes.reduce((sum, d) => sum + (Number(d[eventType]) || 0), 0) / validTimes.length : 
        0;
      acc[eventType] = formatTimeToAMPM(avg);
      return acc;
    }, {});
  };

  const averages = calculateAverages();

  // --- Loading & Error States ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
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
    <div className="p-4 space-y-4">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Personal Insights</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Event Type Toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
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
          <Card key={eventType}>
            <CardHeader>
              <CardTitle className="text-sm">
                Avg {eventType.replace('_', ' ')} Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{averages[eventType]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval={Math.floor(timelineData.length / 7)}
                />
                <YAxis 
                  domain={[DAY_PIVOT_HOUR, DAY_PIVOT_HOUR + HOURS_IN_DAY]}
                  ticks={generateYAxisTicks()}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatTimeToAMPM(value).split(' ')[0]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {selectedEvents.map(eventType => (
                  <Line 
                    key={eventType}
                    type="monotone" 
                    dataKey={eventType} 
                    stroke={EVENT_COLORS[eventType]}
                    name={eventType.replace('_', ' ')}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}