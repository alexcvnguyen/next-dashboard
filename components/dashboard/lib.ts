import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// --- Types ---
export interface DailyLog {
  created_at: string;
  event_type: string;
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
  journal_start: '#00C49F'
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