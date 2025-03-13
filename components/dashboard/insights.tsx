import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ProcessedData, 
  analyseEventScoreRelationship,
  analysePreviousDayImpact,
  analyseDurationImpact,
  analyseSequentialEvents,
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

// Define analysis configurations
interface AnalysisConfig {
  type: 'event' | 'previousDay' | 'duration' | 'sequential';
  title: string;
  params: {
    eventType?: EventType;
    scoreType: 'mood_score' | 'energy_score';
    threshold?: number;
    startEventType?: EventType;
    endEventType?: EventType;
    firstEventType?: EventType;
    secondEventType?: EventType;
  };
}

const ANALYSES: AnalysisConfig[] = [
  // Event timing analyses
  {
    type: 'event',
    title: 'Wake Time & Mood',
    params: {
      eventType: 'awake',
      scoreType: 'mood_score',
      threshold: DAY_PIVOT_HOUR + 7 // 7 AM
    }
  },
  {
    type: 'event',
    title: 'Wake Time & Energy',
    params: {
      eventType: 'awake',
      scoreType: 'energy_score',
      threshold: DAY_PIVOT_HOUR + 7 // 7 AM
    }
  },
  // Previous day impacts
  {
    type: 'previousDay',
    title: "Previous Night's Sleep & Mood",
    params: {
      eventType: 'asleep',
      scoreType: 'mood_score',
      threshold: DAY_PIVOT_HOUR + 22 // 10 PM
    }
  },
  {
    type: 'previousDay',
    title: "Previous Night's Sleep & Energy",
    params: {
      eventType: 'asleep',
      scoreType: 'energy_score',
      threshold: DAY_PIVOT_HOUR + 22 // 10 PM
    }
  },
  // Duration analyses
  {
    type: 'duration',
    title: 'Work Duration & Energy',
    params: {
      startEventType: 'work_start',
      endEventType: 'work_end',
      scoreType: 'energy_score',
      threshold: 8 // 8 hours
    }
  },
  // Sequential event analyses
  {
    type: 'sequential',
    title: 'Wake to Work Gap & Mood',
    params: {
      firstEventType: 'awake',
      secondEventType: 'work_start',
      scoreType: 'mood_score',
      threshold: 2 // 2 hours
    }
  }
];

export function Insights({ data, averages }: InsightsProps) {
  // Function to run analysis based on configuration
  const runAnalysis = (config: AnalysisConfig): AnalyticsResult => {
    switch (config.type) {
      case 'event':
        return analyseEventScoreRelationship(
          data,
          config.params.eventType!,
          config.params.scoreType,
          config.params.threshold!
        );
      case 'previousDay':
        return analysePreviousDayImpact(
          data,
          config.params.eventType!,
          config.params.scoreType,
          config.params.threshold!
        );
      case 'duration':
        return analyseDurationImpact(
          data,
          config.params.startEventType!,
          config.params.endEventType!,
          config.params.scoreType,
          config.params.threshold!
        );
      case 'sequential':
        return analyseSequentialEvents(
          data,
          config.params.firstEventType!,
          config.params.secondEventType!,
          config.params.scoreType,
          config.params.threshold!
        );
      default:
        throw new Error(`Unknown analysis type: ${config.type}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ANALYSES.map((config, index) => (
          <InsightsCard
            key={index}
            title={config.title}
            result={runAnalysis(config)}
          />
        ))}
      </div>
    </div>
  );
} 