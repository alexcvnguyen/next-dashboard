'use client';

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatTimeToAMPM } from '@/components/dashboard/lib';

export interface Metric {
  key: string;
  label: string;
  type: 'time' | 'duration' | 'number' | 'percentage';
  color?: string;
}

interface DataRecord {
  [key: string]: unknown;
  date?: string;
}

interface DataSectionProps<T extends DataRecord> {
  title: string;
  data: T[];
  metrics: Metric[];
  dateKey?: string;
  showMovingAverage?: boolean;
}

interface TooltipItem {
  value: number;
  name: string;
  dataKey: string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 border border-gray-200 rounded-lg shadow-md">
      <p className="font-medium">{label}</p>
      {payload.map((item, index) => {
        const isTime = item.dataKey.includes('time') || item.dataKey.includes('start') || item.dataKey.includes('end');
        const isDuration = item.dataKey.includes('duration');
        
        let displayValue: number | string = item.value;
        let unit = '';
        
        if (isTime) {
          displayValue = formatTimeToAMPM(Number(item.value));
        } else if (isDuration) {
          displayValue = Number(item.value).toFixed(1);
          unit = ' hours';
        }
        
        return (
          <p key={index} style={{ color: item.color }}>
            {`${item.name}: ${displayValue}${unit}`}
          </p>
        );
      })}
    </div>
  );
};

export function DataSection<T extends DataRecord>({ 
  title, 
  data, 
  metrics,
  dateKey = 'date',
  showMovingAverage = true
}: DataSectionProps<T>) {
  // Calculate moving averages
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const window = Math.min(7, Math.max(3, Math.floor(data.length / 4)));
    const halfWindow = Math.floor(window / 2);

    return data.map((item, index) => {
      const result = { ...item } as { [key: string]: unknown };

      metrics.forEach(metric => {
        if (showMovingAverage) {
          // Calculate moving average
          const start = Math.max(0, index - halfWindow);
          const end = Math.min(data.length, index + halfWindow + 1);
          const values = data
            .slice(start, end)
            .map(d => Number(d[metric.key]))
            .filter(v => !isNaN(v));

          if (values.length > 0) {
            const avg = values.reduce((a, b) => a + b) / values.length;
            result[`${metric.key}_ma`] = avg;
          }
        }
      });

      return result as T;
    });
  }, [data, metrics, showMovingAverage]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    return metrics.map(metric => {
      const values = data
        .map(item => Number(item[metric.key]))
        .filter(v => !isNaN(v));

      if (!values.length) return null;

      const avg = values.reduce((a, b) => a + b) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      return {
        ...metric,
        average: avg,
        min,
        max
      };
    }).filter((stat): stat is NonNullable<typeof stat> => stat !== null);
  }, [data, metrics]);

  const formatValue = (value: number, type: string) => {
    if (type === 'time') return formatTimeToAMPM(value);
    if (type === 'duration') return `${value.toFixed(1)}h`;
    if (type === 'percentage') return `${value.toFixed(1)}%`;
    return value.toFixed(1);
  };

  return (
    <>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {stats.map((stat, index) => (
            <div key={index} className="space-y-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold">
                {formatValue(stat.average, stat.type)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatValue(stat.min, stat.type)} - {formatValue(stat.max, stat.type)}
              </p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[300px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis 
                dataKey={dateKey}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
                className="text-muted-foreground"
              />
              <YAxis className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {metrics.map((metric, index) => (
                <React.Fragment key={metric.key}>
                  <Line
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color || `hsl(${index * 60}, 70%, 50%)`}
                    name={metric.label}
                    strokeWidth={2}
                    dot={{ r: 2, strokeWidth: 1, fillOpacity: 0.6 }}
                  />
                  {showMovingAverage && (
                    <Line
                      type="monotone"
                      dataKey={`${metric.key}_ma`}
                      stroke={metric.color || `hsl(${index * 60}, 70%, 50%)`}
                      strokeDasharray="5 5"
                      name={`${metric.label} (MA)`}
                      strokeWidth={1}
                      dot={false}
                    />
                  )}
                </React.Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </>
  );
} 