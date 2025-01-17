import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  ProcessedData, 
  analyzeEventScoreRelationship, 
  DAY_PIVOT_HOUR, 
  formatTimeToAMPM,
  calculateAverageTime,
  EventType 
} from './lib';

interface InsightsProps {
  data: ProcessedData[];
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

export function Insights({ data }: InsightsProps) {
  // State for thresholds
  const [wakeThreshold, setWakeThreshold] = useState(THRESHOLDS.wake.default);
  const [workThreshold, setWorkThreshold] = useState(THRESHOLDS.work.default);
  const [sleepThreshold, setSleepThreshold] = useState(THRESHOLDS.sleep.default);

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
    const avgTime = calculateAverageTime(data, config.eventType);
    
    const handleAverageClick = () => {
      if (avgTime !== null) {
        onChange([avgTime]);
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
              disabled={avgTime === null}
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
            <p className="text-xs text-gray-500 mt-2">Based on {wakeAndMood.sampleSize} days of data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wake Time & Energy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{wakeAndEnergy.insight}</p>
            <p className="text-xs text-gray-500 mt-2">Based on {wakeAndEnergy.sampleSize} days of data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work Start Time & Mood</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{workAndMood.insight}</p>
            <p className="text-xs text-gray-500 mt-2">Based on {workAndMood.sampleSize} days of data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sleep Time & Energy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{sleepAndEnergy.insight}</p>
            <p className="text-xs text-gray-500 mt-2">Based on {sleepAndEnergy.sampleSize} days of data</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 