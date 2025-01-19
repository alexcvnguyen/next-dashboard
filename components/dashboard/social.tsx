'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyLocationStats, calculateAverageTimeOutside, CustomTooltipProps } from './lib';

interface SocialProps {
  locationData: DailyLocationStats[];
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-200 rounded-lg shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((item, index) => (
        <p key={index} style={{ color: item.stroke }}>
          {`${item.name}: ${Number(item.value).toFixed(2)} hours`}
        </p>
      ))}
    </div>
  );
};

export function Social({ locationData }: SocialProps) {
  const averageTimeOutside = calculateAverageTimeOutside(locationData);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time Outside</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageTimeOutside.toFixed(2)} hours</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Spent Outside</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={locationData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="timeOutside"
                  name="Time Outside"
                  stroke="#8884d8"
                  dot={{ r: 2, fill: '#8884d8', strokeWidth: 1, fillOpacity: 0.6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 