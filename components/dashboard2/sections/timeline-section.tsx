'use client';

import React, { useMemo } from 'react';
import { DataSection } from './data-section';
import { EVENT_COLORS, ProcessedData } from '@/components/dashboard/lib';
import type { Metric } from './data-section';

interface TimelineSectionProps {
  data: ProcessedData[];
}

export function TimelineSection({ data }: TimelineSectionProps) {
  const metrics = useMemo((): Metric[] => [
    { key: 'mood_score', label: 'Mood', type: 'number', color: EVENT_COLORS.mood_score },
    { key: 'energy_score', label: 'Energy', type: 'number', color: EVENT_COLORS.energy_score },
    { key: 'journal_start', label: 'Journal Time', type: 'time', color: EVENT_COLORS.journal_start },
    { key: 'work_start', label: 'Work Start', type: 'time', color: EVENT_COLORS.work_start },
    { key: 'work_end', label: 'Work End', type: 'time', color: EVENT_COLORS.work_end }
  ], []);

  return (
    <DataSection<ProcessedData>
      title="Daily Timeline"
      data={data}
      metrics={metrics}
    />
  );
} 