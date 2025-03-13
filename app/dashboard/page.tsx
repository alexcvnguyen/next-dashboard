import { Suspense } from 'react'
import { getDashboardData, getSleepData, getWorkouts, getJournals, getDailyLogs } from '@/lib/data'
import { Dashboard } from '@/components/dashboard/dashboard'
import { ProcessedData, EventType } from '@/components/dashboard/lib'

export const revalidate = 300 // Revalidate every 5 minutes

export default async function DashboardPage() {
  // Get raw data from database
  const data = await getDashboardData()

  // Process the data into the required formats for the Dashboard component
  const processedTimelineData = data.flatMap(day => {
    return day.daily_log_event_type.map((type, index) => ({
      time: day.daily_log_created_at[index],
      type: type as EventType, // Cast to EventType
      value: type === 'work_end' && day.work_duration ? day.work_duration : undefined
    })) as ProcessedData[]; // Cast array to ProcessedData[]
  });

  // Use the helper functions that already process the data correctly
  const sleepData = await getSleepData()
  const workouts = await getWorkouts() // This now fetches the correctly typed workouts
  const journals = await getJournals()
  const locationData = await getDailyLogs()

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50/30">
        <div className="space-y-4 text-center">
          <div className="custom-loader rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground animate-pulse">Loading insights...</p>
        </div>
      </div>
    }>
      <Dashboard 
        initialTimelineData={processedTimelineData}
        initialSleepData={sleepData}
        initialLocationData={locationData}
        initialWorkouts={workouts}
        initialJournals={journals}
      />
    </Suspense>
  )
}