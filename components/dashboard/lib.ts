/*
 * Dashboard Utilities and Types
 * 
 * SLEEP TRACKING CONSIDERATIONS:
 * Current approach for handling sleep that crosses midnight:
 * - Sleep times are normalized to a 24-hour cycle starting at 6PM (18:00)
 * - Times between 6PM-6AM are treated as part of the same sleep cycle
 * - Example: Sleeping at 1AM is stored as hour 25 (24 + 1)
 * 
 * Limitations & Trade-offs:
 * 1. Visualization:
 *    + Clearer representation of sleep continuity
 *    + Easier to spot patterns in late-night sleep times
 *    - Y-axis becomes less intuitive with hours > 24
 *    - May confuse users initially
 * 
 * 2. Data Storage:
 *    + Simpler queries - no need to join across days
 *    - Requires preprocessing of timestamps
 *    - Makes raw data less intuitive to read
 * 
 * 3. Edge Cases:
 *    - Cannot handle sleep periods longer than 12 hours
 *    - Assumes sleep always starts after 6PM and ends before 6PM next day
 *    - Multiple sleep sessions in one day may not be represented accurately
 */

import { format, addHours } from 'date-fns';

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
  payload?: any[];
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
export const DAY_PIVOT_HOUR = 18; // 6PM - Starting point for a "day"
export const HOURS_IN_DAY = 24;

// --- Time Utilities ---
export const normalizeHour = (dateStr: string) => {
  const date = new Date(dateStr);
  const hour = date.getHours();
  const minutes = date.getMinutes() / 60;
  
  // If time is between midnight and 6AM, add 24 to make it continuous with previous evening
  if (hour < DAY_PIVOT_HOUR - HOURS_IN_DAY) {
    return hour + HOURS_IN_DAY + minutes;
  }
  
  // If time is between 6PM and midnight, keep as is
  if (hour >= DAY_PIVOT_HOUR) {
    return hour + minutes;
  }
  
  // Regular daytime hours
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
    const eventDate = new Date(event.created_at);
    const normalizedHour = normalizeHour(event.created_at);
    
    // If time is after midnight but before pivot, count it as previous day
    const date = normalizedHour >= HOURS_IN_DAY 
      ? format(addHours(eventDate, -HOURS_IN_DAY), 'yyyy-MM-dd')
      : format(eventDate, 'yyyy-MM-dd');

    if (!acc[date]) {
      acc[date] = { date };
    }

    acc[date][event.event_type] = normalizedHour;
    return acc;
  }, {});

  return Object.values(dailyData).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};