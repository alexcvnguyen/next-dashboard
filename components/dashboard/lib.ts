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
  positive_feelings?: string[];
  negative_feelings?: string[];
  cognitive_states?: string[];
  physical_states?: string[];
}

export interface SleepData extends ProcessedData {
  asleep: number;
  awake: number;
  duration: number;
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
  work_start: '#ffc658',
  work_end: '#ff7300',
  journal_start: '#00C49F',
  mood_score: '#FF69B4',
  energy_score: '#4169E1',
  // Sleep timeline colors
  awake: '#8884d8',
  asleep: '#82ca9d',
  duration: '#ffa07a'
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
  'In Bed (hr)': string;
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
      duration: parseFloat(entry['In Bed (hr)']),
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

// Helper function to safely calculate t-test p-value
const calculatePValue = (group1: number[], group2: number[]): number => {
  try {
    // If we don't have enough data, return 1 (no statistical significance)
    if (group1.length < 2 || group2.length < 2) return 1;
    
    // Check if all values in either group are identical
    const isGroup1Constant = group1.every(val => val === group1[0]);
    const isGroup2Constant = group2.every(val => val === group2[0]);
    
    // If both groups are identical, there's no difference (p = 1)
    if (isGroup1Constant && isGroup2Constant && group1[0] === group2[0]) return 1;
    // If both groups are constant but different, they're completely distinct (p ≈ 0)
    if (isGroup1Constant && isGroup2Constant) return 0.0001;
    
    // Calculate means for a simple difference test if t-test fails
    const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
    const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;
    
    try {
      // Try the t-test first
      // @ts-expect-error - simple-statistics type definition is incorrect
      const tTestResult = tTest(group1, group2);
      
      // Validate the t-test result
      if (typeof tTestResult === 'number' && !isNaN(tTestResult) && tTestResult >= 0 && tTestResult <= 1) {
        return tTestResult;
      }
    } catch (error) {
      console.error('T-test failed, falling back to simple difference test:', error);
    }
    
    // Fallback: Calculate a pseudo p-value based on the difference of means
    // This is not a real p-value but provides a number between 0 and 1
    // that indicates the relative difference between groups
    const maxPossibleDiff = 10; // Maximum possible difference in scores
    const actualDiff = Math.abs(mean1 - mean2);
    const pseudoPValue = Math.min(1, actualDiff / maxPossibleDiff);
    
    return 1 - pseudoPValue; // Invert so larger differences give smaller p-values
    
  } catch (error) {
    console.error('Error calculating p-value:', error);
    return 1; // Return 1 (no significance) in case of any error
  }
};

export const analyseEventScoreRelationship = (
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

  if (validData.length < 3) {
    return {
      correlation: 0,
      averageScore: 0,
      sampleSize: validData.length,
      insight: 'Not enough data yet. Keep logging your daily activities to see patterns emerge.',
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
    return normalizedTime <= (earlyThreshold - DAY_PIVOT_HOUR);
  });
  const lateDays = validData.filter(d => !earlyDays.includes(d));

  // Calculate averages
  const earlyScores = earlyDays.map(d => Number(d[scoreType]));
  const lateScores = lateDays.map(d => Number(d[scoreType]));

  const earlyAvg = earlyScores.length > 0
    ? earlyScores.reduce((sum, score) => sum + score, 0) / earlyScores.length
    : null;
  const lateAvg = lateScores.length > 0
    ? lateScores.reduce((sum, score) => sum + score, 0) / lateScores.length
    : null;

  // If either group has no data, we can't make a meaningful comparison
  if (earlyAvg === null || lateAvg === null) {
    return {
      correlation: 0,
      averageScore: earlyAvg ?? lateAvg ?? 0,
      sampleSize: validData.length,
      insight: `Need more varied timing data to analyse the impact of ${eventType.replace('_', ' ')} times.`,
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
  
  const correlation = times.length >= 2 ? calculateCorrelation(times, scores) : 0;
  const correlationStrength = getCorrelationStrength(correlation);
  
  let pValue = null;
  let effectSize = null;
  let standardDev = null;

  try {
    if (earlyScores.length >= 2 && lateScores.length >= 2) {
      pValue = calculatePValue(earlyScores, lateScores);
      effectSize = calculateEffectSize(earlyScores, lateScores);
    }
    standardDev = scores.length >= 2 ? standardDeviation(scores) : null;
  } catch (error) {
    console.error('Error calculating statistics:', error);
  }

  // Generate insight
  const scoreDiff = earlyAvg - lateAvg;
  const normalizedThreshold = earlyThreshold - DAY_PIVOT_HOUR;
  const timeStr = formatTimeToAMPM(normalizedThreshold);
  
  let insight = '';
  const eventName = eventType.replace('_', ' ');
  const scoreTypeName = scoreType.replace('_', ' ');

  if (Math.abs(correlation) < 0.1 || isNaN(correlation)) {
    insight = `Your ${scoreTypeName} doesn't seem to be affected by ${eventName} timing. ` +
      `This suggests you may have flexibility in when you ${eventName}.`;
  } else {
    const betterTime = scoreDiff > 0 ? 'earlier' : 'later';
    const difference = Math.abs(scoreDiff).toFixed(1);
    const betterAvg = (betterTime === 'earlier' ? earlyAvg : lateAvg).toFixed(1);
    const worseAvg = (betterTime === 'earlier' ? lateAvg : earlyAvg).toFixed(1);

    // Add statistical significance and confidence level
    let confidencePhrase = '';
    if (pValue !== null && effectSize !== null) {
      if (pValue < 0.01 && effectSize > 0.8) {
        confidencePhrase = 'There is very strong evidence that ';
      } else if (pValue < 0.05 && effectSize > 0.5) {
        confidencePhrase = 'There is strong evidence that ';
      } else if (pValue < 0.1 && effectSize > 0.2) {
        confidencePhrase = 'There is some evidence that ';
      }
    }

    insight = `${confidencePhrase}${eventName === 'asleep' ? 'going to bed' : eventName} ${betterTime} ` +
      `than ${timeStr} tends to boost your ${scoreTypeName} by ${difference} points ` +
      `(averaging ${betterAvg} vs ${worseAvg}). ` +
      (effectSize !== null && effectSize > 0.5 ? 
        `This is a substantial difference-consider taking note.` : 
        `The difference is small, though it may be worth noting.`);
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

// Calculate average duration
export const calculateAverageDuration = (data: SleepData[]): number | null => {
  const validDurations = data
    .filter(d => d.duration !== null && typeof d.duration === 'number')
    .map(d => d.duration);

  if (validDurations.length === 0) return null;

  const avgDuration = validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length;
  return avgDuration;
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

// Location data interfaces
export interface LocationLog {
  id: string;
  created_at: string;
  location: 'home' | 'not_home';
  home_state: boolean;
}

export interface DailyLocationStats {
  date: string;
  timeOutside: number; // hours spent outside
}

// Process location data to calculate daily time spent outside
export const processLocationData = (locationLogs: LocationLog[]): DailyLocationStats[] => {
  const dailyStats: { [key: string]: { timeOutside: number, lastHomeTime?: Date, lastNotHomeTime?: Date } } = {};

  // Sort logs by creation time
  const sortedLogs = [...locationLogs].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  sortedLogs.forEach(log => {
    const melbourneDate = toZonedTime(log.created_at, TIMEZONE);
    const date = formatInTimeZone(melbourneDate, TIMEZONE, 'yyyy-MM-dd');
    
    if (!dailyStats[date]) {
      dailyStats[date] = { timeOutside: 0 };
    }

    const currentTime = new Date(log.created_at);

    if (log.location === 'not_home') {
      dailyStats[date].lastNotHomeTime = currentTime;
    } else if (log.location === 'home' && dailyStats[date].lastNotHomeTime) {
      // Calculate time spent outside
      const timeOutside = (currentTime.getTime() - dailyStats[date].lastNotHomeTime!.getTime()) / (1000 * 60 * 60);
      dailyStats[date].timeOutside += timeOutside;
      dailyStats[date].lastNotHomeTime = undefined;
    }
  });

  return Object.entries(dailyStats).map(([date, stats]) => ({
    date,
    timeOutside: Number(stats.timeOutside.toFixed(2))
  }));
};

// Calculate average time outside per day
export const calculateAverageTimeOutside = (data: DailyLocationStats[]): number => {
  if (data.length === 0) return 0;
  const total = data.reduce((sum, day) => sum + day.timeOutside, 0);
  return Number((total / data.length).toFixed(2));
};

// Helper function to analyse duration impact on scores
export const analyseDurationImpact = (
  data: ProcessedData[],
  startEventType: EventType,
  endEventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  durationThreshold: number
): AnalyticsResult => {
  // Filter data points where we have all required fields
  const validData = data.filter(d => 
    d[startEventType] !== null && 
    d[endEventType] !== null && 
    d[scoreType] !== null &&
    typeof d[startEventType] === 'number' &&
    typeof d[endEventType] === 'number' &&
    typeof d[scoreType] === 'number'
  );

  if (validData.length < 3) {
    return {
      correlation: 0,
      averageScore: 0,
      sampleSize: validData.length,
      insight: 'Not enough data yet to analyse duration patterns.',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Calculate durations
  const dataWithDurations = validData.map(d => {
    const startTime = Number(d[startEventType]);
    let endTime = Number(d[endEventType]);
    
    // Handle cases where end time is on the next day
    if (endTime < startTime) {
      endTime += HOURS_IN_DAY;
    }
    
    return {
      duration: endTime - startTime,
      score: Number(d[scoreType])
    };
  });

  // Split into short vs long duration groups
  const shortDuration = dataWithDurations.filter(d => d.duration <= durationThreshold);
  const longDuration = dataWithDurations.filter(d => d.duration > durationThreshold);

  const shortScores = shortDuration.map(d => d.score);
  const longScores = longDuration.map(d => d.score);

  const shortAvg = shortScores.length > 0 
    ? shortScores.reduce((sum, score) => sum + score, 0) / shortScores.length 
    : null;
  const longAvg = longScores.length > 0
    ? longScores.reduce((sum, score) => sum + score, 0) / longScores.length
    : null;

  if (shortAvg === null || longAvg === null) {
    return {
      correlation: 0,
      averageScore: shortAvg ?? longAvg ?? 0,
      sampleSize: validData.length,
      insight: 'Need more varied duration data for analysis.',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Calculate correlation between duration and scores
  const durations = dataWithDurations.map(d => d.duration);
  const scores = dataWithDurations.map(d => d.score);
  
  const correlation = calculateCorrelation(durations, scores);
  const correlationStrength = getCorrelationStrength(correlation);

  let pValue = null;
  let effectSize = null;
  let standardDev = null;

  try {
    if (shortScores.length >= 2 && longScores.length >= 2) {
      pValue = calculatePValue(shortScores, longScores);
      effectSize = calculateEffectSize(shortScores, longScores);
    }
    standardDev = scores.length >= 2 ? standardDeviation(scores) : null;
  } catch (error) {
    console.error('Error calculating statistics:', error);
  }

  // Generate insight
  const scoreDiff = shortAvg - longAvg;
  const activityName = startEventType.replace('_', ' ');
  const scoreTypeName = scoreType.replace('_', ' ');
  const durationStr = durationThreshold.toFixed(1);

  let insight = '';
  if (Math.abs(correlation) < 0.1 || isNaN(correlation)) {
    insight = `Your ${scoreTypeName} doesn't seem to be affected by how long you spend on ${activityName}. ` +
      `This suggests you might have good stamina for this activity.`;
  } else {
    const betterDuration = scoreDiff > 0 ? 'shorter' : 'longer';
    const difference = Math.abs(scoreDiff).toFixed(1);
    const betterAvg = (scoreDiff > 0 ? shortAvg : longAvg).toFixed(1);
    const worseAvg = (scoreDiff > 0 ? longAvg : shortAvg).toFixed(1);

    let confidencePhrase = '';
    if (pValue !== null && effectSize !== null) {
      if (pValue < 0.01 && effectSize > 0.8) {
        confidencePhrase = 'There is very strong evidence that ';
      } else if (pValue < 0.05 && effectSize > 0.5) {
        confidencePhrase = 'There is strong evidence that ';
      } else if (pValue < 0.1 && effectSize > 0.2) {
        confidencePhrase = 'There is some evidence that ';
      }
    }

    insight = `${confidencePhrase}${betterDuration} ${activityName} sessions (${
      betterDuration === 'shorter' ? 'under' : 'over'
    } ${durationStr} hours) tend to boost your ${scoreTypeName} by ${difference} points ` +
      `(averaging ${betterAvg} vs ${worseAvg}). ` +
      (effectSize !== null && effectSize > 0.5 ? 
        `This is a substantial effect you may want to consider when planning your day.` : 
        `While the effect is modest, it might be worth keeping in mind.`);
  }

  return {
    correlation,
    averageScore: shortAvg,
    sampleSize: validData.length,
    insight,
    pValue,
    effectSize,
    standardDev,
    correlationStrength
  };
};

// Helper to analyse sequential events impact
export const analyseSequentialEvents = (
  data: ProcessedData[],
  firstEventType: EventType,
  secondEventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  gapThreshold: number
): AnalyticsResult => {
  // Filter data points where we have all required fields
  const validData = data.filter(d => 
    d[firstEventType] !== null && 
    d[secondEventType] !== null && 
    d[scoreType] !== null &&
    typeof d[firstEventType] === 'number' &&
    typeof d[secondEventType] === 'number' &&
    typeof d[scoreType] === 'number'
  );

  if (validData.length < 3) {
    return {
      correlation: 0,
      averageScore: 0,
      sampleSize: validData.length,
      insight: 'Not enough data yet to analyse event sequence patterns.',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Calculate gaps between events
  const dataWithGaps = validData.map(d => {
    const firstTime = Number(d[firstEventType]);
    let secondTime = Number(d[secondEventType]);
    
    // Handle cases where second event is on the next day
    if (secondTime < firstTime) {
      secondTime += HOURS_IN_DAY;
    }
    
    return {
      gap: secondTime - firstTime,
      score: Number(d[scoreType])
    };
  });

  // Split into short vs long gap groups
  const shortGap = dataWithGaps.filter(d => d.gap <= gapThreshold);
  const longGap = dataWithGaps.filter(d => d.gap > gapThreshold);

  const shortScores = shortGap.map(d => d.score);
  const longScores = longGap.map(d => d.score);

  const shortAvg = shortScores.length > 0 
    ? shortScores.reduce((sum, score) => sum + score, 0) / shortScores.length 
    : null;
  const longAvg = longScores.length > 0
    ? longScores.reduce((sum, score) => sum + score, 0) / longScores.length
    : null;

  if (shortAvg === null || longAvg === null) {
    return {
      correlation: 0,
      averageScore: shortAvg ?? longAvg ?? 0,
      sampleSize: validData.length,
      insight: 'Need more varied timing data for sequence analysis.',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Calculate correlation between gaps and scores
  const gaps = dataWithGaps.map(d => d.gap);
  const scores = dataWithGaps.map(d => d.score);
  
  const correlation = calculateCorrelation(gaps, scores);
  const correlationStrength = getCorrelationStrength(correlation);

  let pValue = null;
  let effectSize = null;
  let standardDev = null;

  try {
    if (shortScores.length >= 2 && longScores.length >= 2) {
      pValue = calculatePValue(shortScores, longScores);
      effectSize = calculateEffectSize(shortScores, longScores);
    }
    standardDev = scores.length >= 2 ? standardDeviation(scores) : null;
  } catch (error) {
    console.error('Error calculating statistics:', error);
  }

  // Generate insight
  const scoreDiff = shortAvg - longAvg;
  const firstEventName = firstEventType.replace('_', ' ');
  const secondEventName = secondEventType.replace('_', ' ');
  const scoreTypeName = scoreType.replace('_', ' ');
  const gapStr = gapThreshold.toFixed(1);

  let insight = '';
  if (Math.abs(correlation) < 0.1 || isNaN(correlation)) {
    insight = `The time gap between your ${firstEventName} and ${secondEventName} doesn't seem to affect your ${scoreTypeName}. ` +
      `This suggests you have flexibility in scheduling these activities.`;
  } else {
    const betterGap = scoreDiff > 0 ? 'shorter' : 'longer';
    const difference = Math.abs(scoreDiff).toFixed(1);
    const betterAvg = (scoreDiff > 0 ? shortAvg : longAvg).toFixed(1);
    const worseAvg = (scoreDiff > 0 ? longAvg : shortAvg).toFixed(1);

    let confidencePhrase = '';
    if (pValue !== null && effectSize !== null) {
      if (pValue < 0.01 && effectSize > 0.8) {
        confidencePhrase = 'There is very strong evidence that ';
      } else if (pValue < 0.05 && effectSize > 0.5) {
        confidencePhrase = 'There is strong evidence that ';
      } else if (pValue < 0.1 && effectSize > 0.2) {
        confidencePhrase = 'There is some evidence that ';
      }
    }

    insight = `${confidencePhrase}having a ${betterGap} gap (${
      betterGap === 'shorter' ? 'under' : 'over'
    } ${gapStr} hours) between ${firstEventName} and ${secondEventName} tends to boost your ${scoreTypeName} by ${difference} points ` +
      `(averaging ${betterAvg} vs ${worseAvg}). ` +
      (effectSize !== null && effectSize > 0.5 ? 
        `This is a substantial pattern worth considering in your schedule.` : 
        `While the effect is modest, it might help optimize your routine.`);
  }

  return {
    correlation,
    averageScore: shortAvg,
    sampleSize: validData.length,
    insight,
    pValue,
    effectSize,
    standardDev,
    correlationStrength
  };
};

// Helper to analyse how previous day's events affect next day's scores
export const analysePreviousDayImpact = (
  data: ProcessedData[],
  eventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  threshold: number
): AnalyticsResult => {
  // Create a map of dates to their data for easy lookup
  const dateMap = data.reduce((acc, d) => {
    acc[d.date] = d;
    return acc;
  }, {} as { [key: string]: ProcessedData });

  // For each day's score, look at previous day's event
  const validPairs = Object.entries(dateMap).reduce((acc: Array<{
    prevDayEvent: number,
    nextDayScore: number
  }>, [date, dayData]) => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = formatInTimeZone(prevDate, TIMEZONE, 'yyyy-MM-dd');
    const prevDayData = dateMap[prevDateStr];

    if (prevDayData && 
        prevDayData[eventType] !== null && 
        dayData[scoreType] !== null &&
        typeof prevDayData[eventType] === 'number' &&
        typeof dayData[scoreType] === 'number') {
      acc.push({
        prevDayEvent: Number(prevDayData[eventType]),
        nextDayScore: Number(dayData[scoreType])
      });
    }
    return acc;
  }, []);

  if (validPairs.length < 3) {
    return {
      correlation: 0,
      averageScore: 0,
      sampleSize: validPairs.length,
      insight: 'Not enough consecutive days of data to analyse patterns.',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Split into early vs late groups based on threshold
  const earlyGroup = validPairs.filter(p => {
    let normalizedTime = p.prevDayEvent;
    // Normalize times after midnight
    if (normalizedTime < DAY_PIVOT_HOUR) {
      normalizedTime += HOURS_IN_DAY;
    }
    return normalizedTime <= threshold;
  });
  const lateGroup = validPairs.filter(p => !earlyGroup.includes(p));

  const earlyScores = earlyGroup.map(p => p.nextDayScore);
  const lateScores = lateGroup.map(p => p.nextDayScore);

  const earlyAvg = earlyScores.length > 0
    ? earlyScores.reduce((sum, score) => sum + score, 0) / earlyScores.length
    : null;
  const lateAvg = lateScores.length > 0
    ? lateScores.reduce((sum, score) => sum + score, 0) / lateScores.length
    : null;

  if (earlyAvg === null || lateAvg === null) {
    return {
      correlation: 0,
      averageScore: earlyAvg ?? lateAvg ?? 0,
      sampleSize: validPairs.length,
      insight: 'Need more varied timing data to analyse patterns.',
      pValue: null,
      effectSize: null,
      standardDev: null,
      correlationStrength: 'insufficient data'
    };
  }

  // Calculate correlation
  const times = validPairs.map(p => p.prevDayEvent);
  const scores = validPairs.map(p => p.nextDayScore);
  
  const correlation = calculateCorrelation(times, scores);
  const correlationStrength = getCorrelationStrength(correlation);

  let pValue = null;
  let effectSize = null;
  let standardDev = null;

  try {
    if (earlyScores.length >= 2 && lateScores.length >= 2) {
      pValue = calculatePValue(earlyScores, lateScores);
      effectSize = calculateEffectSize(earlyScores, lateScores);
    }
    standardDev = scores.length >= 2 ? standardDeviation(scores) : null;
  } catch (error) {
    console.error('Error calculating statistics:', error);
  }

  // Generate insight
  const scoreDiff = earlyAvg - lateAvg;
  const eventName = eventType.replace('_', ' ');
  const scoreTypeName = scoreType.replace('_', ' ');
  const timeStr = formatTimeToAMPM(threshold - DAY_PIVOT_HOUR);

  let insight = '';
  if (Math.abs(correlation) < 0.1 || isNaN(correlation)) {
    insight = `Your next-day ${scoreTypeName} doesn't seem to be affected by when you ${eventName} the previous evening. ` +
      `This suggests you might be adaptable to different evening schedules.`;
  } else {
    const betterTime = scoreDiff > 0 ? 'earlier' : 'later';
    const difference = Math.abs(scoreDiff).toFixed(1);
    const betterAvg = (scoreDiff > 0 ? earlyAvg : lateAvg).toFixed(1);
    const worseAvg = (scoreDiff > 0 ? lateAvg : earlyAvg).toFixed(1);

    let confidencePhrase = '';
    if (pValue !== null && effectSize !== null) {
      if (pValue < 0.01 && effectSize > 0.8) {
        confidencePhrase = 'There is very strong evidence that ';
      } else if (pValue < 0.05 && effectSize > 0.5) {
        confidencePhrase = 'There is strong evidence that ';
      } else if (pValue < 0.1 && effectSize > 0.2) {
        confidencePhrase = 'There is some evidence that ';
      }
    }

    insight = `${confidencePhrase}when you ${eventName} ${betterTime} than ${timeStr} in the evening, ` +
      `your next morning's ${scoreTypeName} tends to be ${difference} points higher ` +
      `(averaging ${betterAvg} vs ${worseAvg}). ` +
      (effectSize !== null && effectSize > 0.5 ? 
        `This suggests your evening routine has a substantial impact on how you feel the next day.` : 
        `While the effect is modest, adjusting your evening schedule might help improve your mornings.`);
  }

  return {
    correlation,
    averageScore: earlyAvg,
    sampleSize: validPairs.length,
    insight,
    pValue,
    effectSize,
    standardDev,
    correlationStrength
  };
};
