'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSupabase } from '@/lib/supabase';
import { startOfDay, subDays, format } from 'date-fns';

interface DailyLog {
  created_at: string;
  event_type: string;
}

interface ProcessedData {
  date: string;
  wakeHour: number | null;
  sleepHour: number | null;
}

export default function Dashboard() {
  const [timelineData, setTimelineData] = useState<ProcessedData[]>([]);
  const [timeRange, setTimeRange] = useState('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');
        
        // Fetch sleep/wake events
        const events = await fetchSupabase('daily_log', {
          select: '*',
          created_at: `gte.${startDate}`,
          event_type: 'in.(awake,asleep)'
        });

        // Process the events into daily data
        const dailyData = events.reduce((acc: { [key: string]: ProcessedData }, event: DailyLog) => {
          const date = format(new Date(event.created_at), 'yyyy-MM-dd');
          const hour = new Date(event.created_at).getHours() + 
                      new Date(event.created_at).getMinutes() / 60;

          if (!acc[date]) {
            acc[date] = {
              date,
              wakeHour: null,
              sleepHour: null
            };
          }

          if (event.event_type === 'awake') {
            acc[date].wakeHour = hour;
          } else if (event.event_type === 'asleep') {
            acc[date].sleepHour = hour;
          }

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

  const calculateAverages = () => {
    const validWakeTimes = timelineData.filter(d => d.wakeHour !== null);
    const avgWakeTime = validWakeTimes.length ? 
      validWakeTimes.reduce((sum, d) => sum + (d.wakeHour || 0), 0) / validWakeTimes.length : 
      0;

    return {
      avgWakeTime: avgWakeTime.toFixed(2),
    };
  };

  const averages = calculateAverages();

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

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sleep Analysis</h1>
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

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Avg Wake Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{averages.avgWakeTime}h</p>
            <p className="text-sm text-gray-500">
              {timelineData.length} days analyzed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sleep/Wake Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
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
                />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="wakeHour" 
                  stroke="#8884d8" 
                  name="Wake Hour"
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sleepHour" 
                  stroke="#82ca9d" 
                  name="Sleep Hour"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}