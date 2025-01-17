import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

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
}

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

  if (validData.length < 3) {
    return {
      correlation: 0,
      averageScore: 0,
      sampleSize: validData.length,
      insight: 'Not enough data for analysis'
    };
  }

  // Split into early vs late groups based on Melbourne time
  const earlyDays = validData.filter(d => {
    const eventTime = Number(d[eventType]);
    // Normalize the time to be within 0-24 range for comparison
    const normalizedTime = eventTime >= HOURS_IN_DAY ? eventTime - HOURS_IN_DAY : eventTime;
    return normalizedTime <= (earlyThreshold - DAY_PIVOT_HOUR);
  });
  const lateDays = validData.filter(d => !earlyDays.includes(d));

  // Calculate averages
  const earlyAvg = earlyDays.length > 0
    ? earlyDays.reduce((sum, d) => sum + Number(d[scoreType]), 0) / earlyDays.length
    : 0;
  const lateAvg = lateDays.length > 0
    ? lateDays.reduce((sum, d) => sum + Number(d[scoreType]), 0) / lateDays.length
    : 0;

  // Calculate correlation using normalized times
  const times = validData.map(d => {
    const time = Number(d[eventType]);
    return time >= HOURS_IN_DAY ? time - HOURS_IN_DAY : time;
  });
  const scores = validData.map(d => Number(d[scoreType]));
  const correlation = calculateCorrelation(times, scores);

  // Generate insight
  const scoreDiff = earlyAvg - lateAvg;
  const eventName = eventType.replace('_', ' ');
  const scoreTypeName = scoreType.replace('_', ' ');
  const normalizedThreshold = earlyThreshold - DAY_PIVOT_HOUR;
  
  let insight = '';
  if (Math.abs(correlation) < 0.1) {
    insight = `No significant relationship found between ${eventName} time and ${scoreTypeName}.`;
  } else {
    const betterTime = scoreDiff > 0 ? 'earlier' : 'later';
    const worseTime = scoreDiff > 0 ? 'later' : 'earlier';
    const threshold = formatTimeToAMPM(normalizedThreshold);
    const betterAvg = (betterTime === 'earlier' ? earlyAvg : lateAvg).toFixed(1);
    const worseAvg = (betterTime === 'earlier' ? lateAvg : earlyAvg).toFixed(1);
    
    insight = `When you ${eventName} ${betterTime} (${betterTime === 'earlier' ? 'before' : 'after'} ${threshold}), ` +
      `your ${scoreTypeName} averages ${Math.abs(scoreDiff).toFixed(1)} points higher ` +
      `(${betterAvg} vs ${worseAvg}). ` +
      `${eventName === 'work start' ? 'Starting work' : eventName === 'awake' ? 'Waking up' : 'Going to sleep'} ` +
      `${worseTime} is associated with lower scores.`;
  }

  return {
    correlation,
    averageScore: earlyAvg,
    sampleSize: validData.length,
    insight
  };
};

// Helper function to calculate correlation coefficient
const calculateCorrelation = (x: number[], y: number[]): number => {
  const n = x.length;
  const sum1 = x.reduce((a, b) => a + b) * y.reduce((a, b) => a + b);
  const sum2 = x.reduce((a, b) => a + b * b) * y.reduce((a, b) => a + b * b);
  const sum3 = x.map((_, i) => x[i] * y[i]).reduce((a, b) => a + b);
  return (n * sum3 - sum1) / Math.sqrt((n * sum2 - sum1 * sum1));
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