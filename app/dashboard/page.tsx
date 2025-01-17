'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchSupabase } from '@/lib/supabase';
import { startOfDay, subDays, format } from 'date-fns';

// --- Types ---
interface DailyLog {
  created_at: string;
  event_type: string;
}

interface ProcessedData {
  date: string;
  [key: string]: string | number | null;
}

// --- Constants ---
// Remove or modify these colors as needed
const EVENT_COLORS = {
  awake: '#8884d8',
  asleep: '#82ca9d',
  work_start: '#ffc658',
  work_end: '#ff7300',
  journal_start: '#00C49F'
};

type EventType = keyof typeof EVENT_COLORS;

// --- Utility Functions ---
// REMOVABLE: Time formatting utilities - can be replaced with your preferred format
const formatTimeToAMPM = (hours: number | null) => {
  if (hours === null) return '-';
  const wholePart = Math.floor(hours);
  const minutePart = Math.round((hours - wholePart) * 60);
  
  let adjustedHours = wholePart % 12;
  if (adjustedHours === 0) adjustedHours = 12;
  
  const ampm = wholePart < 12 ? 'AM' : 'PM';
  return `${adjustedHours}:${minutePart.toString().padStart(2, '0')} ${ampm}`;
};

// --- Custom Components ---
// REMOVABLE: Custom tooltip component - can be replaced with default Recharts tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
      <p className="font-medium">{label}</p>
      {payload.map((item: any, index: number) => (
        <p key={index} style={{ color: item.color }}>
          {`${item.name}: ${formatTimeToAMPM(item.value)}`}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
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
        
        // Fetch all event types
        const events = await fetchSupabase('daily_log', {
          select: '*',
          created_at: `gte.${startDate}`
        });

        // Process the events into daily data
        const dailyData = events.reduce((acc: { [key: string]: ProcessedData }, event: DailyLog) => {
          const date = format(new Date(event.created_at), 'yyyy-MM-dd');
          const hour = new Date(event.created_at).getHours() + 
                      new Date(event.created_at).getMinutes() / 60;

          if (!acc[date]) {
            acc[date] = { date };
          }

          acc[date][event.event_type] = hour;
          return acc;
        }, {});

        const processedData = Object.values(dailyData).sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
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

  // --- Data Processing ---
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

  // --- Event Handlers ---
  const toggleEventType = (eventType: EventType) => {
    setSelectedEvents(prev => 
      prev.includes(eventType) 
        ? prev.filter(e => e !== eventType)
        : [...prev, eventType]
    );
  };

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
                  domain={[0, 24]} 
                  ticks={[0, 4, 8, 12, 16, 20, 24]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatTimeToAMPM(value).split(' ')[0]} // Show time without AM/PM
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