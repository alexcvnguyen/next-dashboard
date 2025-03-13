import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!supabaseKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
})

// Type definitions for our database tables
export interface DailyLog {
  id: string
  created_at: string
  event_type: string
}

export interface JournalEntry {
  id: string
  created_at: string
  mood_score: number
  energy_score: number
  positive_feelings: string[]
  negative_feelings: string[]
  cognitive_states: string[]
  physical_states: string[]
}

export interface SleepExport {
  id: string
  created_at: string
  'Date/Time': string
  Start: string
  End: string
  Core: string
  REM: string
  Deep: string
  'In Bed (hr)': string
}

interface HeartRateDataPoint {
  timestamp: string
  value: number
}

interface HeartRateRecoveryData {
  startValue: number
  endValue: number
  duration: number
}

interface RoutePoint {
  latitude: number
  longitude: number
  timestamp: string
  elevation?: number
}

export interface Sleep {
  id: bigint
  date: string
  created_at: string
  sleepStart: string
  sleepEnd: string
  inBedStart: string
  inBedEnd: string
  rem: number
  core: number
  deep: number
  inBed: number
  asleep: number
  awake: number
  source: string
}

export interface Workout {
  id: string
  created_at: string
  name: string
  start: string
  end: string
  duration: number
  distance_qty: number
  distance_units: string
  totalEnergy_qty: number
  totalEnergy_units: string
  activeEnergy_qty: number
  activeEnergy_units: string
  avgHeartRate_qty: number
  avgHeartRate_units: string
  maxHeartRate_qty: number
  maxHeartRate_units: string
  heartRateData: HeartRateDataPoint[]
  heartRateRecovery: HeartRateRecoveryData
  stepCount_qty: number
  stepCount_units: string
  stepCadence_qty: number
  stepCadence_units: string
  elevation_ascent: number
  elevation_descent: number
  elevation_units: string
  flightsClimbed_qty: number
  flightsClimbed_units: string
  route: RoutePoint[]
  location: string
  isIndoor: boolean
  intensity_qty: number
  intensity_units: string
  temperature_qty: number
  temperature_units: string
  humidity_qty: number
  humidity_units: string
  speed_qty: number
  speed_units: string
  totalSwimmingStrokeCount_qty: number
  totalSwimmingStrokeCount_units: string
  swimCadence_qty: number
  swimCadence_units: string
}

export interface LocationLog {
  id: string
  created_at: string
  location: string
  duration: number
}