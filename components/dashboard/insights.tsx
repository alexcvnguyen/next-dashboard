import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  ProcessedData, 
  analyzeEventScoreRelationship, 
  DAY_PIVOT_HOUR,
  HOURS_IN_DAY,
  formatTimeToAMPM,
  EventType 
} from './lib';

interface InsightsProps {
  data: ProcessedData[];
  averages: { [key: string]: string | number };
}

interface ThresholdConfig {
  min: number;
  max: number;
  default: number;
  label: string;
  eventType: EventType;
}

const THRESHOLDS: Record<string, ThresholdConfig> = {
  wake: {
    min: DAY_PIVOT_HOUR + 4, // 4AM
    max: DAY_PIVOT_HOUR + 10, // 10AM
    default: DAY_PIVOT_HOUR + 6, // 6AM
    label: 'Early wake threshold',
    eventType: 'awake'
  },
  work: {
    min: DAY_PIVOT_HOUR + 6, // 6AM
    max: DAY_PIVOT_HOUR + 12, // 12PM
    default: DAY_PIVOT_HOUR + 8, // 8AM
    label: 'Early work threshold',
    eventType: 'work_start'
  },
  sleep: {
    min: DAY_PIVOT_HOUR + 20, // 8PM
    max: DAY_PIVOT_HOUR + 26, // 2AM next day
    default: DAY_PIVOT_HOUR + 22, // 10PM
    label: 'Early sleep threshold',
    eventType: 'asleep'
  }
};

// Helper to convert time string (e.g. "7:30 AM") to hour number (e.g. 7.5)
const parseTimeToHour = (timeStr: string, eventType: EventType): number | null => {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const time = hours + minutes / 60;
  
  // For sleep times, if it's early morning (e.g., 12:30 AM),
  // add 24 hours to put it in the next day range
  if (eventType === 'asleep' && period === 'AM') {
    return time + DAY_PIVOT_HOUR + HOURS_IN_DAY;
  }
  
  // For all other times, just adjust for day pivot
  return time + DAY_PIVOT_HOUR;
};

export function Insights({ data, averages }: InsightsProps) {
  // Get initial thresholds from averages or fall back to defaults
  const getInitialThreshold = (config: ThresholdConfig) => {
    const avgTimeStr = averages[config.eventType];
    if (typeof avgTimeStr === 'string' && avgTimeStr !== '-') {
      const avgTime = parseTimeToHour(avgTimeStr, config.eventType);
      if (avgTime !== null) {
        return avgTime;
      }
    }
    return config.default;
  };

  // State for thresholds
  const [wakeThreshold, setWakeThreshold] = useState(() => getInitialThreshold(THRESHOLDS.wake));
  const [workThreshold, setWorkThreshold] = useState(() => getInitialThreshold(THRESHOLDS.work));
  const [sleepThreshold, setSleepThreshold] = useState(() => getInitialThreshold(THRESHOLDS.sleep));

  // Update thresholds when averages change
  useEffect(() => {
    setWakeThreshold(getInitialThreshold(THRESHOLDS.wake));
    setWorkThreshold(getInitialThreshold(THRESHOLDS.work));
    setSleepThreshold(getInitialThreshold(THRESHOLDS.sleep));
  }, [averages]);

  // Analyze relationships between different events and scores
  const wakeAndMood = analyzeEventScoreRelationship(data, 'awake', 'mood_score', wakeThreshold);
  const wakeAndEnergy = analyzeEventScoreRelationship(data, 'awake', 'energy_score', wakeThreshold);
  const workAndMood = analyzeEventScoreRelationship(data, 'work_start', 'mood_score', workThreshold);
  const sleepAndEnergy = analyzeEventScoreRelationship(data, 'asleep', 'energy_score', sleepThreshold);

  const renderThresholdControl = (
    config: ThresholdConfig,
    value: number,
    onChange: (value: number[]) => void
  ) => {
    const avgTimeStr = averages[config.eventType];
    
    const handleAverageClick = () => {
      if (typeof avgTimeStr === 'string' && avgTimeStr !== '-') {
        const avgTime = parseTimeToHour(avgTimeStr, config.eventType);
        if (avgTime !== null) {
          onChange([avgTime]);
        }
      }
    };

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{config.label}</span>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleAverageClick}
              disabled={typeof avgTimeStr !== 'string' || avgTimeStr === '-'}
            >
              Average
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-right">
              {formatTimeToAMPM(value - DAY_PIVOT_HOUR)}
            </span>
          </div>
        </div>
        <Slider
          value={[value]}
          min={config.min}
          max={config.max}
          step={0.5}
          onValueChange={onChange}
          className="w-full"
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Threshold Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderThresholdControl(THRESHOLDS.wake, wakeThreshold, ([v]) => setWakeThreshold(v))}
          {renderThresholdControl(THRESHOLDS.work, workThreshold, ([v]) => setWorkThreshold(v))}
          {renderThresholdControl(THRESHOLDS.sleep, sleepThreshold, ([v]) => setSleepThreshold(v))}
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Wake Time & Mood</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{wakeAndMood.insight}</p>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <p>Sample size: {wakeAndMood.sampleSize} days</p>
              {wakeAndMood.standardDev !== null && (
                <p>Variability (SD): ±{wakeAndMood.standardDev.toFixed(1)} points</p>
              )}
              {wakeAndMood.effectSize !== null && (
                <p>Effect size (Cohen&apos;s d): {wakeAndMood.effectSize.toFixed(2)} 
                  {wakeAndMood.effectSize > 0.8 ? ' (large)' : 
                   wakeAndMood.effectSize > 0.5 ? ' (medium)' : 
                   wakeAndMood.effectSize > 0.2 ? ' (small)' : ' (minimal)'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wake Time & Energy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{wakeAndEnergy.insight}</p>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <p>Sample size: {wakeAndEnergy.sampleSize} days</p>
              {wakeAndEnergy.standardDev !== null && (
                <p>Variability (SD): ±{wakeAndEnergy.standardDev.toFixed(1)} points</p>
              )}
              {wakeAndEnergy.effectSize !== null && (
                <p>Effect size (Cohen&apos;s d): {wakeAndEnergy.effectSize.toFixed(2)}
                  {wakeAndEnergy.effectSize > 0.8 ? ' (large)' : 
                   wakeAndEnergy.effectSize > 0.5 ? ' (medium)' : 
                   wakeAndEnergy.effectSize > 0.2 ? ' (small)' : ' (minimal)'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Start Time & Mood</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{workAndMood.insight}</p>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <p>Sample size: {workAndMood.sampleSize} days</p>
              {workAndMood.standardDev !== null && (
                <p>Variability (SD): ±{workAndMood.standardDev.toFixed(1)} points</p>
              )}
              {workAndMood.effectSize !== null && (
                <p>Effect size (Cohen&apos;s d): {workAndMood.effectSize.toFixed(2)}
                  {workAndMood.effectSize > 0.8 ? ' (large)' : 
                   workAndMood.effectSize > 0.5 ? ' (medium)' : 
                   workAndMood.effectSize > 0.2 ? ' (small)' : ' (minimal)'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sleep Time & Energy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{sleepAndEnergy.insight}</p>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <p>Sample size: {sleepAndEnergy.sampleSize} days</p>
              {sleepAndEnergy.standardDev !== null && (
                <p>Variability (SD): ±{sleepAndEnergy.standardDev.toFixed(1)} points</p>
              )}
              {sleepAndEnergy.effectSize !== null && (
                <p>Effect size (Cohen&apos;s d): {sleepAndEnergy.effectSize.toFixed(2)}
                  {sleepAndEnergy.effectSize > 0.8 ? ' (large)' : 
                   sleepAndEnergy.effectSize > 0.5 ? ' (medium)' : 
                   sleepAndEnergy.effectSize > 0.2 ? ' (small)' : ' (minimal)'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 