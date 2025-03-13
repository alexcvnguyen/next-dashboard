'use client';

import React, { useMemo } from 'react';
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DataSection } from './data-section';
import type { DailyLocationStats } from '@/components/dashboard/lib';
import type { Workout } from '@/lib/supabase';
import type { Metric } from './data-section';

interface SocialSectionProps {
  data: {
    location: DailyLocationStats[];
    workouts: Workout[];
  };
}

interface WorkoutStats {
  totalWorkouts: number;
  avgDuration: number;
  topWorkouts: [string, number][];
}

export function SocialSection({ data }: SocialSectionProps) {
  const metrics: Metric[] = useMemo(() => [
    { key: 'timeOutside', label: 'Time Outside', type: 'duration' as const },
  ], []);

  // Process location data for visualization
  const processedData = useMemo(() => {
    return data.location.map(log => ({
      date: log.date,
      timeOutside: log.timeOutside
    }));
  }, [data.location]);

  // Calculate workout stats
  const workoutStats = useMemo((): WorkoutStats | null => {
    if (!data.workouts.length) return null;

    const totalWorkouts = data.workouts.length;
    const totalDuration = data.workouts.reduce((sum: number, w: Workout) => sum + (w.duration || 0), 0);
    const avgDuration = totalDuration / totalWorkouts;

    const workoutTypes = data.workouts.reduce((acc: Record<string, number>, workout: Workout) => {
      const type = workout.name || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const topWorkouts = Object.entries(workoutTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      totalWorkouts,
      avgDuration,
      topWorkouts
    };
  }, [data.workouts]);

  return (
    <>
      <CardHeader>
        <CardTitle>Social & Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Time Outside Chart */}
        <div className="mb-8">
          <DataSection
            title="Time Outside"
            data={processedData}
            metrics={metrics}
          />
        </div>

        {/* Workout Stats */}
        {workoutStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Workouts</p>
                <p className="text-2xl font-semibold">{workoutStats.totalWorkouts}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-semibold">{workoutStats.avgDuration.toFixed(1)}h</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Top Activities</h4>
              <div className="space-y-2">
                {workoutStats.topWorkouts.map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{type}</span>
                    <span className="font-medium">{count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
} 