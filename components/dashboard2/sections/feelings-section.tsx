'use client';

import React, { useMemo } from 'react';
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DataSection } from './data-section';
import type { JournalEntry } from '@/components/dashboard/lib';
import type { Metric } from './data-section';

interface FeelingSectionProps {
  journals: JournalEntry[];
}

export function FeelingsSection({ journals }: FeelingSectionProps) {
  const metrics: Metric[] = useMemo(() => [
    { key: 'mood_score', label: 'Mood', type: 'number' as const },
    { key: 'energy_score', label: 'Energy', type: 'number' as const }
  ], []);

  // Process journal data for visualization
  const processedData = useMemo(() => {
    return journals.map(journal => ({
      date: journal.created_at.split('T')[0],
      mood_score: journal.mood_score,
      energy_score: journal.energy_score
    }));
  }, [journals]);

  // Calculate feeling frequencies
  const feelingStats = useMemo(() => {
    const stats = {
      positive: {} as Record<string, number>,
      negative: {} as Record<string, number>,
      cognitive: {} as Record<string, number>,
      physical: {} as Record<string, number>
    };

    journals.forEach(journal => {
      journal.positive_feelings?.forEach(feeling => {
        stats.positive[feeling] = (stats.positive[feeling] || 0) + 1;
      });
      journal.negative_feelings?.forEach(feeling => {
        stats.negative[feeling] = (stats.negative[feeling] || 0) + 1;
      });
      journal.cognitive_states?.forEach(state => {
        stats.cognitive[state] = (stats.cognitive[state] || 0) + 1;
      });
      journal.physical_states?.forEach(state => {
        stats.physical[state] = (stats.physical[state] || 0) + 1;
      });
    });

    return {
      positive: Object.entries(stats.positive)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      negative: Object.entries(stats.negative)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      cognitive: Object.entries(stats.cognitive)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      physical: Object.entries(stats.physical)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    };
  }, [journals]);

  return (
    <>
      <CardHeader>
        <CardTitle>Feelings & States</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mood & Energy Chart */}
        <div className="mb-8">
          <DataSection
            title="Mood & Energy Trends"
            data={processedData}
            metrics={metrics}
          />
        </div>

        {/* Feeling Stats */}
        <div className="grid grid-cols-2 gap-6">
          {/* Positive & Negative Feelings */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Top Positive Feelings</h4>
              <div className="space-y-2">
                {feelingStats.positive.map(([feeling, count]) => (
                  <div key={feeling} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{feeling}</span>
                    <span className="font-medium">{count}x</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Top Negative Feelings</h4>
              <div className="space-y-2">
                {feelingStats.negative.map(([feeling, count]) => (
                  <div key={feeling} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{feeling}</span>
                    <span className="font-medium">{count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cognitive & Physical States */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Top Cognitive States</h4>
              <div className="space-y-2">
                {feelingStats.cognitive.map(([state, count]) => (
                  <div key={state} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{state}</span>
                    <span className="font-medium">{count}x</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Top Physical States</h4>
              <div className="space-y-2">
                {feelingStats.physical.map(([state, count]) => (
                  <div key={state} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{state}</span>
                    <span className="font-medium">{count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );
} 