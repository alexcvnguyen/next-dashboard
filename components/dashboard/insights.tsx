import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { 
  ProcessedData, 
  analyseEventScoreRelationship,
  analysePreviousDayImpact,
  DAY_PIVOT_HOUR,
  HOURS_IN_DAY,
  formatTimeToAMPM,
  EventType,
  AnalyticsResult 
} from './lib';

interface StatisticsDisplayProps {
  result: AnalyticsResult;
}

function StatisticsDisplay({ result }: StatisticsDisplayProps) {
  return (
    <div className="mt-4 space-y-2 text-xs text-gray-500">
      <p>Based on {result.sampleSize} days of data</p>
      {result.standardDev !== null && (
        <div className="space-y-1">
          <p>Day-to-day variation: ±{result.standardDev.toFixed(1)} points</p>
          <div className="flex items-center gap-2">
            <span>Consistency:</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  result.standardDev <= 1 ? 'bg-green-500' :
                  result.standardDev <= 2 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, 100 - (result.standardDev * 20)))}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {result.effectSize !== null && (
        <div className="mt-3 space-y-1">
          <p className="text-sm font-medium text-gray-700">
            Impact Strength: {
              result.effectSize > 0.8 ? 'Very Strong' : 
              result.effectSize > 0.5 ? 'Strong' : 
              result.effectSize > 0.2 ? 'Moderate' :
              'Weak'
            }
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(100, result.effectSize * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {result.pValue !== null && !result.insight.includes('Need more varied timing data') && (
        <div className="mt-2">
          <p className={`text-sm font-medium ${
            result.pValue < 0.1 ? 'text-blue-600' : 'text-gray-500'
          }`}>
            Statistical Significance: {
              result.pValue < 0.01 ? 'p < 0.01 (99% confidence)' :
              result.pValue < 0.05 ? 'p < 0.05 (95% confidence)' :
              result.pValue < 0.1 ? 'p < 0.1 (90% confidence)' :
              `p = ${result.pValue.toFixed(3)}`
            }
          </p>
        </div>
      )}
    </div>
  );
}

interface InsightsCardProps {
  title: string;
  result: AnalyticsResult;
}

function InsightsCard({ title, result }: InsightsCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {result.correlationStrength !== 'negligible' && (
            <span className={`text-sm px-2 py-1 rounded ${
              result.correlation > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {result.correlation > 0 ? 'Earlier is better' : 'Later is better'}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{result.insight}</p>
        <StatisticsDisplay result={result} />
      </CardContent>
    </Card>
  );
}

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
    label: 'Wake-up time threshold',
    eventType: 'awake'
  },
  work: {
    min: DAY_PIVOT_HOUR + 6, // 6AM
    max: DAY_PIVOT_HOUR + 12, // 12PM
    default: DAY_PIVOT_HOUR + 8, // 8AM
    label: 'Work start time threshold',
    eventType: 'work_start'
  },
  sleep: {
    min: DAY_PIVOT_HOUR + 20, // 8PM
    max: DAY_PIVOT_HOUR + 26, // 2AM next day
    default: DAY_PIVOT_HOUR + 22, // 10PM
    label: 'Bedtime threshold',
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

// Helper to get descriptive text for threshold impact
const getThresholdDescription = (config: ThresholdConfig, value: number) => {
  const timeStr = formatTimeToAMPM(value - DAY_PIVOT_HOUR);
  switch (config.eventType) {
    case 'awake':
      return `Days when you wake up before ${timeStr} will be considered "early wake-ups"`;
    case 'work_start':
      return `Days when you start work before ${timeStr} will be considered "early starts"`;
    case 'asleep':
      return `Days when you go to bed before ${timeStr} will be considered "early bedtimes"`;
    default:
      return '';
  }
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

  // analyse relationships between different events and scores
  const wakeAndMood = analyseEventScoreRelationship(data, 'awake', 'mood_score', wakeThreshold);
  const wakeAndEnergy = analyseEventScoreRelationship(data, 'awake', 'energy_score', wakeThreshold);
  
  // analyse how previous day's events affect today's scores
  const prevDaySleepAndMood = analysePreviousDayImpact(data, 'asleep', 'mood_score', sleepThreshold);
  const prevDaySleepAndEnergy = analysePreviousDayImpact(data, 'asleep', 'energy_score', sleepThreshold);
  const prevDayWorkEndAndMood = analysePreviousDayImpact(data, 'work_end', 'mood_score', DAY_PIVOT_HOUR + 19); // 7PM
  const prevDayWorkEndAndEnergy = analysePreviousDayImpact(data, 'work_end', 'energy_score', DAY_PIVOT_HOUR + 19);

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
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50/80 backdrop-blur-sm hover:bg-gray-50 transition-colors">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{config.label}</h3>
              <p className="text-sm text-gray-600 mt-1 pr-4">
                {getThresholdDescription(config, value)}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleAverageClick}
                disabled={typeof avgTimeStr !== 'string' || avgTimeStr === '-'}
                className="whitespace-nowrap text-xs"
              >
                Set to Average
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
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Threshold Controls */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg font-semibold">Analysis Settings</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Adjust these thresholds to analyse how different timing patterns affect your mood and energy.
            The analysis compares days when you perform activities before vs. after these times.
          </p>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4">
          {renderThresholdControl(THRESHOLDS.wake, wakeThreshold, ([v]) => setWakeThreshold(v))}
          {renderThresholdControl(THRESHOLDS.work, workThreshold, ([v]) => setWorkThreshold(v))}
          {renderThresholdControl(THRESHOLDS.sleep, sleepThreshold, ([v]) => setSleepThreshold(v))}
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightsCard title="Wake Time & Mood" result={wakeAndMood} />
        <InsightsCard title="Wake Time & Energy" result={wakeAndEnergy} />
        <InsightsCard title="Previous Night&apos;s Sleep & Mood" result={prevDaySleepAndMood} />
        <InsightsCard title="Previous Night&apos;s Sleep & Energy" result={prevDaySleepAndEnergy} />
        <InsightsCard title="Previous Day&apos;s Work End & Mood" result={prevDayWorkEndAndMood} />
        <InsightsCard title="Previous Day&apos;s Work End & Energy" result={prevDayWorkEndAndEnergy} />
      </div>
    </div>
  );
} 