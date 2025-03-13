export interface MetricConfig {
  id: string;
  name: string;
  description: string;
  type: 'time' | 'duration' | 'number' | 'percentage';
  dataSource: 'timeline' | 'sleep' | 'location' | 'journals';
  dataKey: string;
  color?: string;
  format?: string;
  aggregation?: 'sum' | 'average' | 'min' | 'max' | 'count';
}

export interface VisualizationType {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'stat' | 'table';
  supportedMetricTypes: Array<MetricConfig['type']>;
  maxMetrics?: number;
}

export interface DashboardSection {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'stat' | 'table';
  metrics: string[]; // Array of metric IDs
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  settings?: {
    showLegend?: boolean;
    showGrid?: boolean;
    showMovingAverage?: boolean;
    movingAverageWindow?: number;
    dateRange?: [Date, Date];
    aggregationPeriod?: 'hour' | 'day' | 'week' | 'month';
    showLabels?: boolean; // For stat display
    showHeaders?: boolean; // For table display
  };
}

export interface DashboardConfig {
  id: string;
  name: string;
  sections: DashboardSection[];
  availableMetrics: MetricConfig[];
  layout: {
    cols: number;
    rowHeight: number;
    padding: number;
  };
}

// Default metrics configuration
export const DEFAULT_METRICS: MetricConfig[] = [
  // Sleep metrics
  {
    id: 'sleep_duration',
    name: 'Sleep Duration',
    description: 'Total time spent sleeping',
    type: 'duration',
    dataSource: 'sleep',
    dataKey: 'inBed',
    format: 'hours'
  },
  {
    id: 'sleep_quality',
    name: 'Sleep Quality',
    description: 'Quality of sleep based on deep and REM sleep',
    type: 'percentage',
    dataSource: 'sleep',
    dataKey: 'deep',
    format: 'percentage'
  },
  {
    id: 'sleep_start',
    name: 'Sleep Start Time',
    description: 'Time went to sleep',
    type: 'time',
    dataSource: 'sleep',
    dataKey: 'sleepStart',
    format: 'time'
  },
  
  // Journal metrics
  {
    id: 'mood_score',
    name: 'Mood Score',
    description: 'Daily mood rating',
    type: 'number',
    dataSource: 'journals',
    dataKey: 'moodScore',
    format: 'score'
  },
  {
    id: 'energy_score',
    name: 'Energy Score',
    description: 'Daily energy level rating',
    type: 'number',
    dataSource: 'journals',
    dataKey: 'energyScore',
    format: 'score'
  },
  
  // Location metrics
  {
    id: 'work_duration',
    name: 'Work Duration',
    description: 'Time spent working',
    type: 'duration',
    dataSource: 'location',
    dataKey: 'workDuration',
    format: 'hours'
  },
  {
    id: 'mood_average',
    name: 'Average Mood',
    description: 'Average mood score for the day',
    type: 'number',
    dataSource: 'location',
    dataKey: 'moodScoreAverage',
    format: 'score'
  },
  {
    id: 'energy_average',
    name: 'Average Energy',
    description: 'Average energy score for the day',
    type: 'number',
    dataSource: 'location',
    dataKey: 'energyScoreAverage',
    format: 'score'
  }
]; 