import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { tTest, standardDeviation } from 'simple-statistics';

// --- Types ---
export interface DailyLog {
  created_at: string;
  event_type: string;
}

export interface JournalEntry {
  created_at: string;
  mood_score: number;
  energy_score: number;
}

export interface SleepData {
  date: string;
  asleep: number;
  awake: number;
  core: number;
  rem: number;
  deep: number;
}

export interface ProcessedData {
  date: string;
  [key: string]: string | number | null;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number | string; name: string }[];
  label?: string;
}

export const EVENT_COLORS = {
  awake: '#8884d8',
  asleep: '#82ca9d',
  core: '#ffc658',
  rem: '#ff7300',
  deep: '#00C49F',
  work_start: '#ffc658',
  work_end: '#ff7300',
  journal_start: '#00C49F',
  mood_score: '#FF69B4',
  energy_score: '#4169E1'
} as const;

export type EventType = keyof typeof EVENT_COLORS;

// --- Constants ---
export const TIMEZONE = 'Australia/Melbourne';
export const DAY_PIVOT_HOUR = 18; // 6PM - Starting point for a "day"
export const HOURS_IN_DAY = 24;

// --- Time Utilities ---
export const normalizeHour = (dateStr: string) => {
  const melbourneDate = toZonedTime(dateStr, TIMEZONE);
  const hour = melbourneDate.getHours();
  const minutes = melbourneDate.getMinutes() / 60;
  
  // If time is between midnight and 6PM, add 24 to make it continuous with previous evening
  if (hour < DAY_PIVOT_HOUR) {
    return hour + HOURS_IN_DAY + minutes;
  }
  
  // Regular hours (6PM to midnight)
  return hour + minutes;
};

export const formatTimeToAMPM = (hours: number | null) => {
  if (hours === null) return '-';
  
  // Handle hours > 24 (early morning times)
  const normalizedHours = hours >= HOURS_IN_DAY ? hours - HOURS_IN_DAY : hours;
  
  const wholePart = Math.floor(normalizedHours);
  const minutePart = Math.round((normalizedHours - wholePart) * 60);
  
  let adjustedHours = wholePart % 12;
  if (adjustedHours === 0) adjustedHours = 12;
  
  const ampm = wholePart < 12 ? 'AM' : 'PM';
  return `${adjustedHours}:${minutePart.toString().padStart(2, '0')} ${ampm}`;
};

// --- Chart Utilities ---
export const generateYAxisTicks = () => {
  const ticks = [];
  // Generate ticks from 6PM (18) to 6PM next day (42)
  for (let i = DAY_PIVOT_HOUR; i <= DAY_PIVOT_HOUR + HOURS_IN_DAY; i += 2) {
    ticks.push(i);
  }
  return ticks;
};

interface RawSleepData {
  'Date/Time': string;
  Start: string;
  End: string;
  Core: string;
  REM: string;
  Deep: string;
}

export const processSleepData = (sleepData: RawSleepData[]): SleepData[] => {
  return sleepData.map(entry => {
    const date = formatInTimeZone(toZonedTime(entry['Date/Time'], TIMEZONE), TIMEZONE, 'yyyy-MM-dd');
    const startHour = normalizeHour(entry.Start);
    const endHour = normalizeHour(entry.End);
    
    return {
      date,
      asleep: startHour,
      awake: endHour,
      core: parseFloat(entry.Core),
      rem: parseFloat(entry.REM),
      deep: parseFloat(entry.Deep)
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const processEventData = (events: DailyLog[]): ProcessedData[] => {
  const dailyData = events.reduce((acc: { [key: string]: ProcessedData }, event) => {
    // Convert UTC time to Melbourne time
    const melbourneDate = toZonedTime(event.created_at, TIMEZONE);
    const hour = melbourneDate.getHours();
    
    // Calculate normalized hour in Melbourne time
    const normalizedHour = hour + (melbourneDate.getMinutes() / 60);
    
    // For sleep events:
    // - If time is between midnight and 6PM, count it as previous day's sleep
    const shouldAdjustDate = event.event_type === 'asleep' && hour < DAY_PIVOT_HOUR;
    const adjustedDate = shouldAdjustDate
      ? new Date(melbourneDate.getTime() - 24 * 60 * 60 * 1000)  // Subtract 24 hours
      : melbourneDate;
    
    // Get Melbourne date string for the adjusted date
    const date = formatInTimeZone(adjustedDate, TIMEZONE, 'yyyy-MM-dd');

    if (!acc[date]) {
      acc[date] = { date };
    }

    // Store the normalized hour
    const adjustedHour = shouldAdjustDate ? normalizedHour + HOURS_IN_DAY : normalizedHour;
    acc[date][event.event_type] = adjustedHour;

    return acc;
  }, {});

  return Object.values(dailyData).sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

// --- Analytics Utilities ---
export interface AnalyticsResult {
  correlation: number;
  averageScore: number;
  sampleSize: number;
  insight: string;
  pValue: number | null;
  effectSize: number | null;
  standardDev: number | null;
  correlationStrength: string;
}

// Helper function to calculate Cohen's d effect size
const calculateEffectSize = (group1: number[], group2: number[]): number => {
  const n1 = group1.length;
  const n2 = group2.length;
  const mean1 = group1.reduce((a, b) => a + b) / n1;
  const mean2 = group2.reduce((a, b) => a + b) / n2;
  
  const pooledStdev = Math.sqrt(
    ((n1 - 1) * standardDeviation(group1) ** 2 + (n2 - 1) * standardDeviation(group2) ** 2) / 
    (n1 + n2 - 2)
  );
  
  return Math.abs(mean1 - mean2) / pooledStdev;
};

// Helper function to get correlation strength description
const getCorrelationStrength = (correlation: number): string => {
  const absCorr = Math.abs(correlation);
  if (absCorr < 0.1) return 'negligible';
  if (absCorr < 0.3) return 'weak';
  if (absCorr < 0.5) return 'moderate';
  if (absCorr < 0.7) return 'strong';
  return 'very strong';
};

// Helper function to calculate correlation coefficient
const calculateCorrelation = (x: number[], y: number[]): number => {
  try {
    const n = x.length;
    if (n < 2) return 0;  // Need at least 2 points for correlation

    // Calculate means
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    // Calculate variances and covariance
    let xxVar = 0;
    let yyVar = 0;
    let xyVar = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      xxVar += xDiff * xDiff;
      yyVar += yDiff * yDiff;
      xyVar += xDiff * yDiff;
    }

    // Check for zero variance
    if (xxVar === 0 || yyVar === 0) return 0;

    const correlation = xyVar / Math.sqrt(xxVar * yyVar);
    
    // Handle potential floating point errors
    if (correlation > 1) return 1;
    if (correlation < -1) return -1;
    if (isNaN(correlation)) return 0;
    
    return correlation;
  } catch (error) {
    console.error('Error calculating correlation:', error);
    return 0;
  }
};

export const analyzeEventScoreRelationship = (
  data: ProcessedData[],
  eventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  earlyThreshold: number
): AnalyticsResult => {
  // Filter data points where both event and score exist
  const validData = data.filter(d => 
    d[eventType] !== null && 
    d[scoreType] !== null &&
    // Ensure we're only analyzing full days where we have both event and score
    typeof d[eventType] === 'number' &&
    typeof d[scoreType] === 'number'
  );

  console.log(`Valid data points for ${eventType} and ${scoreType}: ${validData.length}`);

  if (validData.length < 3) {
    return {
      correlation: 0,
      averageScore: 0,
      sampleSize: validData.length,
      insight: 'Not enough data for analysis',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Split into early vs late groups based on Melbourne time
  const earlyDays = validData.filter(d => {
    const eventTime = Number(d[eventType]);
    // For sleep times, we need to handle the day boundary differently
    let normalizedTime = eventTime;
    if (eventType === 'asleep') {
      // If time is after midnight but before pivot, it's still considered "previous day's sleep"
      if (eventTime < DAY_PIVOT_HOUR) {
        normalizedTime = eventTime + HOURS_IN_DAY;
      }
    } else {
      // For other events, just normalize to 0-24 range
      normalizedTime = eventTime >= HOURS_IN_DAY ? eventTime - HOURS_IN_DAY : eventTime;
    }
    const isEarly = normalizedTime <= (earlyThreshold - DAY_PIVOT_HOUR);
    console.log(`Event time: ${eventTime}, Normalized: ${normalizedTime}, Threshold: ${earlyThreshold - DAY_PIVOT_HOUR}, Is Early: ${isEarly}`);
    return isEarly;
  });
  const lateDays = validData.filter(d => !earlyDays.includes(d));

  console.log(`Early days: ${earlyDays.length}, Late days: ${lateDays.length}`);

  // Common variables used throughout the analysis
  const eventName = eventType.replace('_', ' ');
  const scoreTypeName = scoreType.replace('_', ' ');

  // Calculate averages with better handling of empty groups
  const earlyScores = earlyDays.map(d => Number(d[scoreType]));
  const lateScores = lateDays.map(d => Number(d[scoreType]));

  console.log('Early scores:', earlyScores);
  console.log('Late scores:', lateScores);

  const earlyAvg = earlyScores.length > 0
    ? earlyScores.reduce((sum, score) => sum + score, 0) / earlyScores.length
    : null;
  const lateAvg = lateScores.length > 0
    ? lateScores.reduce((sum, score) => sum + score, 0) / lateScores.length
    : null;

  console.log(`Early average: ${earlyAvg}, Late average: ${lateAvg}`);

  // If either group has no data, we can't make a meaningful comparison
  if (earlyAvg === null || lateAvg === null) {
    return {
      correlation: 0,
      averageScore: earlyAvg ?? lateAvg ?? 0,
      sampleSize: validData.length,
      insight: `Not enough data to compare early vs late ${eventName} times.`,
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Calculate correlation using normalized times
  const times = validData.map(d => {
    const time = Number(d[eventType]);
    return time >= HOURS_IN_DAY ? time - HOURS_IN_DAY : time;
  });
  const scores = validData.map(d => Number(d[scoreType]));
  
  // Ensure we have valid data for correlation
  const correlation = times.length >= 2 ? calculateCorrelation(times, scores) : 0;
  const correlationStrength = getCorrelationStrength(correlation);
  
  let pValue = null;
  let effectSize = null;
  let standardDev = null;

  try {
    if (earlyScores.length >= 2 && lateScores.length >= 2) {
      // @ts-expect-error - simple-statistics type definition is incorrect, it actually accepts arrays
      const tTestResult = tTest(earlyScores, lateScores);
      pValue = tTestResult;
      effectSize = calculateEffectSize(earlyScores, lateScores);
    }
    standardDev = scores.length >= 2 ? standardDeviation(scores) : null;
  } catch (error) {
    console.error('Error calculating statistics:', error);
  }

  // Generate insight
  const scoreDiff = earlyAvg - lateAvg;
  const normalizedThreshold = earlyThreshold - DAY_PIVOT_HOUR;
  
  let insight = '';
  if (Math.abs(correlation) < 0.1 || isNaN(correlation)) {
    insight = `No clear relationship found between ${eventName} time and ${scoreTypeName}.`;
  } else {
    const betterTime = scoreDiff > 0 ? 'earlier' : 'later';
    const threshold = formatTimeToAMPM(normalizedThreshold);
    const betterAvg = (betterTime === 'earlier' ? earlyAvg : lateAvg).toFixed(1);
    const worseAvg = (betterTime === 'earlier' ? lateAvg : earlyAvg).toFixed(1);

    // Add group sizes to the insight
    const earlyCount = earlyScores.length;
    const lateCount = lateScores.length;
    
    insight = `When you ${eventName} ${betterTime} (${betterTime === 'earlier' ? 'before' : 'after'} ${threshold}), ` +
      `your ${scoreTypeName} averages ${Math.abs(scoreDiff).toFixed(1)} points higher ` +
      `(${betterAvg} vs ${worseAvg}, based on ${earlyCount} early vs ${lateCount} late days). ` +
      `This shows a ${correlationStrength} relationship (r=${correlation.toFixed(2)})` +
      `${pValue !== null && pValue < 0.05 ? ' and is statistically significant' : ''}.`;
  }

  return {
    correlation,
    averageScore: earlyAvg,
    sampleSize: validData.length,
    insight,
    pValue,
    effectSize,
    standardDev,
    correlationStrength
  };
};

// Calculate average time for an event
export const calculateAverageTime = (data: ProcessedData[], eventType: EventType): number | null => {
  const validTimes = data
    .filter(d => d[eventType] !== null && typeof d[eventType] === 'number')
    .map(d => {
      const time = Number(d[eventType]);
      
      // For sleep events, if the time is after midnight but before the day pivot,
      // it should be counted as part of the previous day's sleep
      if (eventType === 'asleep' && time < DAY_PIVOT_HOUR) {
        return time + HOURS_IN_DAY;
      }
      
      return time;
    });

  if (validTimes.length === 0) return null;

  const avgTime = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;
  return avgTime;
};
