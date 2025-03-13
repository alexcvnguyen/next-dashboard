'use client';

import React, { useMemo } from 'react';
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { analyseEventScoreRelationship, analyseDurationImpact, analyseSequentialEvents, analysePreviousDayImpact } from '@/components/dashboard/lib';
import type { ProcessedData, SleepData, DailyLocationStats, JournalEntry, Workout } from '@/components/dashboard/lib';

interface DashboardData {
  timeline: ProcessedData[];
  sleep: SleepData[];
  location: DailyLocationStats[];
  workouts: Workout[];
  journals: JournalEntry[];
}

interface InsightSectionProps {
  data: DashboardData;
}

interface InsightCardProps {
  title: string;
  insight: string;
  stats?: {
    label: string;
    value: string;
  }[];
}

function InsightCard({ title, insight, stats }: InsightCardProps) {
  return (
    <div className="p-4 border rounded-lg bg-white/50 hover:bg-white/80 transition-colors">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{insight}</p>
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div key={index}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-medium">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightsSection({ data }: InsightSectionProps) {
  const insights = useMemo(() => {
    const timelineData = data.timeline;
    
    // Sleep timing impact on mood
    const sleepMoodAnalysis = analyseEventScoreRelationship(
      timelineData,
      'asleep',
      'mood_score',
      23 // 11 PM threshold
    );

    // Sleep timing impact on energy
    const sleepEnergyAnalysis = analyseEventScoreRelationship(
      timelineData,
      'asleep',
      'energy_score',
      23 // 11 PM threshold
    );

    // Work duration impact on mood
    const workDurationMoodAnalysis = analyseDurationImpact(
      timelineData,
      'work_start',
      'work_end',
      'mood_score',
      8 // 8 hours threshold
    );

    // Journal to work start gap impact
    const journalWorkGapAnalysis = analyseSequentialEvents(
      timelineData,
      'journal_start',
      'work_start',
      'mood_score',
      1 // 1 hour threshold
    );

    // Previous day's sleep impact on next day's energy
    const prevSleepEnergyAnalysis = analysePreviousDayImpact(
      timelineData,
      'asleep',
      'energy_score',
      23 // 11 PM threshold
    );

    return [
      {
        title: 'Sleep & Mood',
        insight: sleepMoodAnalysis.insight,
        stats: [
          { label: 'Correlation', value: sleepMoodAnalysis.correlationStrength },
          { label: 'Sample Size', value: sleepMoodAnalysis.sampleSize.toString() }
        ]
      },
      {
        title: 'Sleep & Energy',
        insight: sleepEnergyAnalysis.insight,
        stats: [
          { label: 'Correlation', value: sleepEnergyAnalysis.correlationStrength },
          { label: 'Sample Size', value: sleepEnergyAnalysis.sampleSize.toString() }
        ]
      },
      {
        title: 'Work Duration Impact',
        insight: workDurationMoodAnalysis.insight,
        stats: [
          { label: 'Effect Size', value: workDurationMoodAnalysis.effectSize?.toFixed(2) || 'N/A' },
          { label: 'Sample Size', value: workDurationMoodAnalysis.sampleSize.toString() }
        ]
      },
      {
        title: 'Morning Routine',
        insight: journalWorkGapAnalysis.insight,
        stats: [
          { label: 'Effect Size', value: journalWorkGapAnalysis.effectSize?.toFixed(2) || 'N/A' },
          { label: 'Sample Size', value: journalWorkGapAnalysis.sampleSize.toString() }
        ]
      },
      {
        title: 'Sleep Impact on Next Day',
        insight: prevSleepEnergyAnalysis.insight,
        stats: [
          { label: 'Effect Size', value: prevSleepEnergyAnalysis.effectSize?.toFixed(2) || 'N/A' },
          { label: 'Sample Size', value: prevSleepEnergyAnalysis.sampleSize.toString() }
        ]
      }
    ];
  }, [data]);

  return (
    <>
      <CardHeader>
        <CardTitle>Insights & Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((insight, index) => (
            <InsightCard key={index} {...insight} />
          ))}
        </div>
      </CardContent>
    </>
  );
} 