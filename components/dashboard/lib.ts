import { DashboardViewData } from '@/lib/data';

export interface ProcessedData {
  time: string;
  type: EventType;
  value?: number;
  asleep?: string | null;
  awake?: string | null;
  journal_start?: string | null;
  work_start?: string | null;
  work_end?: string | null;
  mood_score?: number | null;
  energy_score?: number | null;
  asleep_ma?: number | null;
  awake_ma?: number | null;
  journal_start_ma?: number | null;
  work_start_ma?: number | null;
  work_end_ma?: number | null;
  mood_score_ma?: number | null;
  energy_score_ma?: number | null;
  journaling_duration?: number | null;
  work_duration?: number | null;
  leisure_duration?: number | null;
}

export interface SleepData {
  date: string;
  sleepStart: string;
  rem: number;
  core: number;
  source: string;
  inBedStart: string;
  inBedEnd: string;
  inBed: number;
  asleep: number;
  awake: number;
  deep: number;
  sleepEnd: string;
}

export interface JournalEntry {
  date: string;
  createdAt: string;
  mood: string[];
  moodScore: number;
  energyScore: number;
}

export interface DailyLocationStats {
  date: string;
  eventTypes: string[];
  createdAt: string[];
  workDuration: number | null;
  moodScoreAverage: number;
  energyScoreAverage: number;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: string | number;
    name: string;
    dataKey?: string;
  }>;
  label?: string;
}

export const EVENT_COLORS: Record<EventType, string> = {
  asleep: '#4A90E2',
  awake: '#F5A623',
  journal_start: '#7ED321',
  work_start: '#BD10E0',
  work_end: '#9013FE',
};

export const DAY_PIVOT_HOUR = 4; // 4 AM
export const HOURS_IN_DAY = 24;

export type EventType = 'asleep' | 'awake' | 'journal_start' | 'work_start' | 'work_end';

export function formatTimeToAMPM(time: string): string {
  const date = new Date(time);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function generateYAxisTicks(): number[] {
  return Array.from({ length: HOURS_IN_DAY }, (_, i) => i);
}

export function processEventData(data: DashboardViewData[]): ProcessedData[] {
  return data.flatMap(day => {
    return day.daily_log_event_type.map((type, index) => ({
      time: day.daily_log_created_at[index],
      type: type as EventType,
      value: type === 'work_end' && day.work_duration ? day.work_duration : undefined
    }));
  });
}

export function processSleepData(data: DashboardViewData[]): SleepData[] {
  return data.map(day => ({
    date: day.date,
    sleepStart: day.sleep_sleepstart,
    rem: parseFloat(day.sleep_rem),
    core: parseFloat(day.sleep_core),
    source: day.sleep_source,
    inBedStart: day.sleep_inbedstart,
    inBedEnd: day.sleep_inbedend,
    inBed: parseFloat(day.sleep_inbed),
    asleep: parseFloat(day.sleep_asleep),
    awake: parseFloat(day.sleep_awake),
    deep: parseFloat(day.sleep_deep),
    sleepEnd: day.sleep_sleepend
  }));
}

export function processLocationData(data: DashboardViewData[]): DailyLocationStats[] {
  return data.map(day => ({
    date: day.date,
    eventTypes: day.daily_log_event_type,
    createdAt: day.daily_log_created_at,
    workDuration: day.work_duration,
    moodScoreAverage: day.mood_score_average,
    energyScoreAverage: day.energy_score_average
  }));
}

export interface AnalyticsResult {
  insight: string;
  correlation: number;
  correlationStrength: 'strong' | 'moderate' | 'weak' | 'negligible';
  sampleSize: number;
  standardDev: number | null;
  effectSize: number | null;
  pValue: number | null;
}

export function calculateAverageTime(data: ProcessedData[] | string[], eventType?: EventType): string | null {
  if (!data || data.length === 0) return null;
  
  if (typeof data[0] === 'string') {
    const times = data as string[];
    if (!times.length) return null;
    
    const totalMinutes = times.reduce((sum, time) => {
      const date = new Date(time);
      return sum + date.getHours() * 60 + date.getMinutes();
    }, 0);
    
    const avgMinutes = Math.round(totalMinutes / times.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  if (eventType) {
    const processedData = data as ProcessedData[];
    
    const filteredByType = processedData.filter(item => item.type === eventType);
    if (filteredByType.length > 0) {
      const times = filteredByType.map(item => item.time);
      return calculateAverageTime(times);
    }
    
    const timesFromProperty = processedData
      .map(item => item[eventType as keyof ProcessedData] as string | null)
      .filter((time): time is string => time !== null && time !== undefined);
    
    if (timesFromProperty.length > 0) {
      return calculateAverageTime(timesFromProperty);
    }
  }
  
  return null;
}

export function calculateAverageTimeOutside(locationData: DailyLocationStats[]): number {
  if (!locationData || !locationData.length) return 0;
  
  // Calculate average time outside based on location data
  // This is a placeholder implementation - adjust based on your actual data structure
  const totalTimeOutside = locationData.reduce((sum) => {
    // Assuming each location data has a timeOutside property or can be calculated
    // For this example, we'll use a random value between 1-5 hours
    const timeOutside = Math.random() * 4 + 1;
    return sum + timeOutside;
  }, 0);
  
  return totalTimeOutside / locationData.length;
}

export function analyseEventScoreRelationship(
  data: ProcessedData[],
  eventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  threshold: number
): AnalyticsResult {
  // This is a placeholder implementation
  return {
    insight: `People who ${eventType === 'awake' ? 'wake up' : eventType === 'asleep' ? 'go to sleep' : eventType} ${eventType === 'awake' ? 'before' : 'after'} ${threshold % 12 || 12}${threshold >= 12 ? 'PM' : 'AM'} tend to have ${Math.random() > 0.5 ? 'higher' : 'lower'} ${scoreType === 'mood_score' ? 'mood' : 'energy'} scores.`,
    correlation: Math.random() * 2 - 1, // Random between -1 and 1
    correlationStrength: Math.random() > 0.7 ? 'strong' : Math.random() > 0.4 ? 'moderate' : Math.random() > 0.2 ? 'weak' : 'negligible',
    sampleSize: Math.floor(Math.random() * 20) + 5,
    standardDev: Math.random() * 3,
    effectSize: Math.random() * 0.9,
    pValue: Math.random() * 0.2
  };
}

export function analysePreviousDayImpact(
  data: ProcessedData[],
  eventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  threshold: number
): AnalyticsResult {
  // This is a placeholder implementation
  return {
    insight: `Going to ${eventType === 'asleep' ? 'sleep' : eventType} ${eventType === 'asleep' ? 'before' : 'after'} ${threshold % 12 || 12}${threshold >= 12 ? 'PM' : 'AM'} tends to result in ${Math.random() > 0.5 ? 'better' : 'worse'} ${scoreType === 'mood_score' ? 'mood' : 'energy'} the next day.`,
    correlation: Math.random() * 2 - 1,
    correlationStrength: Math.random() > 0.7 ? 'strong' : Math.random() > 0.4 ? 'moderate' : Math.random() > 0.2 ? 'weak' : 'negligible',
    sampleSize: Math.floor(Math.random() * 20) + 5,
    standardDev: Math.random() * 3,
    effectSize: Math.random() * 0.9,
    pValue: Math.random() * 0.2
  };
}

export function analyseDurationImpact(
  data: ProcessedData[],
  startEventType: EventType,
  endEventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  threshold: number
): AnalyticsResult {
  // This is a placeholder implementation
  return {
    insight: `${startEventType === 'work_start' && endEventType === 'work_end' ? 'Working' : 'Being'} for ${threshold > 1 ? 'more' : 'less'} than ${threshold} hours tends to ${Math.random() > 0.5 ? 'increase' : 'decrease'} ${scoreType === 'mood_score' ? 'mood' : 'energy'} scores.`,
    correlation: Math.random() * 2 - 1,
    correlationStrength: Math.random() > 0.7 ? 'strong' : Math.random() > 0.4 ? 'moderate' : Math.random() > 0.2 ? 'weak' : 'negligible',
    sampleSize: Math.floor(Math.random() * 20) + 5,
    standardDev: Math.random() * 3,
    effectSize: Math.random() * 0.9,
    pValue: Math.random() * 0.2
  };
}

export function analyseSequentialEvents(
  data: ProcessedData[],
  firstEventType: EventType,
  secondEventType: EventType,
  scoreType: 'mood_score' | 'energy_score',
  threshold: number
): AnalyticsResult {
  // This is a placeholder implementation
  const eventNames: Record<EventType, string> = {
    'awake': 'waking up',
    'asleep': 'going to sleep',
    'journal_start': 'journaling',
    'work_start': 'starting work',
    'work_end': 'ending work'
  };
  
  return {
    insight: `Having ${threshold > 1 ? 'more' : 'less'} than ${threshold} hours between ${eventNames[firstEventType]} and ${eventNames[secondEventType]} tends to ${Math.random() > 0.5 ? 'improve' : 'reduce'} ${scoreType === 'mood_score' ? 'mood' : 'energy'}.`,
    correlation: Math.random() * 2 - 1,
    correlationStrength: Math.random() > 0.7 ? 'strong' : Math.random() > 0.4 ? 'moderate' : Math.random() > 0.2 ? 'weak' : 'negligible',
    sampleSize: Math.floor(Math.random() * 20) + 5,
    standardDev: Math.random() * 3,
    effectSize: Math.random() * 0.9,
    pValue: Math.random() * 0.2
  };
}
