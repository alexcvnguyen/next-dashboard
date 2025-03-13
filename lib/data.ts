import { format, subDays } from 'date-fns'
import { supabase } from './supabase'

export interface DashboardViewData {
  date: string;
  sleep_sleepstart: string;
  sleep_rem: string;
  sleep_core: string;
  sleep_source: string;
  sleep_inbedstart: string;
  sleep_inbedend: string;
  sleep_inbed: string;
  sleep_asleep: string;
  sleep_awake: string;
  sleep_deep: string;
  sleep_sleepend: string;
  workouts_names: string[];
  workouts_starts: string[];
  workouts_total_duration: string;
  workouts_total_energy: string;
  workouts_total_active_energy: string;
  workouts_total_distance: string;
  workouts_total_steps: string;
  workouts_avg_heart_rate: string;
  journals_created_at: string;
  journals_mood: string[];
  journals_mood_score: number;
  journals_energy_score: number;
  daily_log_event_type: string[];
  daily_log_created_at: string[];
  work_duration: number | null;
  mood_score_average: number;
  energy_score_average: number;
}

export async function getDashboardData(days: number = 14) {
  try {
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('dashboard_view')
      .select()
      .gte('date', startDate)
      .order('date', { ascending: false })

    if (error) throw new Error(`Error fetching dashboard data: ${error.message}`)
    
    return data as DashboardViewData[]
  } catch (error) {
    console.error('Error in getDashboardData:', error)
    throw error
  }
}

// Individual data fetching functions for specific date ranges
export async function getSleepData(days: number = 14) {
  const data = await getDashboardData(days)
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
  }))
}

// Modified function to return actual Workout objects that match the expected type
export async function getWorkouts(days: number = 14) {
  try {
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
    
    const { data, error } = await supabase
      .from('workouts')
      .select()
      .gte('start', startDate)
      .order('start', { ascending: false })
      
    if (error) throw new Error(`Error fetching workouts: ${error.message}`)
    return data
  } catch (error) {
    console.error('Error in getWorkouts:', error)
    // Return empty array as a fallback
    return []
  }
}

// Function to get processed workout data for the dashboard views
export async function getProcessedWorkouts(days: number = 14) {
  const data = await getDashboardData(days)
  return data.map(day => ({
    date: day.date,
    workouts: day.workouts_names.map((name, index) => ({
      name,
      start: day.workouts_starts[index],
    })),
    totalDuration: parseFloat(day.workouts_total_duration),
    totalEnergy: parseFloat(day.workouts_total_energy),
    totalActiveEnergy: parseFloat(day.workouts_total_active_energy),
    totalDistance: parseFloat(day.workouts_total_distance),
    totalSteps: parseInt(day.workouts_total_steps),
    avgHeartRate: parseFloat(day.workouts_avg_heart_rate)
  }))
}

export async function getJournals(days: number = 14) {
  const data = await getDashboardData(days)
  return data.map(day => ({
    date: day.date,
    createdAt: day.journals_created_at,
    mood: day.journals_mood,
    moodScore: day.journals_mood_score,
    energyScore: day.journals_energy_score
  }))
}

export async function getDailyLogs(days: number = 14) {
  const data = await getDashboardData(days)
  return data.map(day => ({
    date: day.date,
    eventTypes: day.daily_log_event_type,
    createdAt: day.daily_log_created_at,
    workDuration: day.work_duration,
    moodScoreAverage: day.mood_score_average,
    energyScoreAverage: day.energy_score_average
  }))
}