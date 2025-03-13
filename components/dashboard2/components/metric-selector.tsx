'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MetricConfig } from '../types';

interface MetricSelectorProps {
  availableMetrics: MetricConfig[];
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
}

export function MetricSelector({ availableMetrics, selectedMetrics, onChange }: MetricSelectorProps) {
  const toggleMetric = (metricId: string) => {
    if (selectedMetrics.includes(metricId)) {
      onChange(selectedMetrics.filter(id => id !== metricId));
    } else {
      onChange([...selectedMetrics, metricId]);
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <h3 className="font-medium mb-2">Available Metrics</h3>
        <ScrollArea className="h-[200px] pr-4">
          <div className="space-y-2">
            {availableMetrics.map(metric => (
              <Button
                key={metric.id}
                variant={selectedMetrics.includes(metric.id) ? "secondary" : "outline"}
                className="w-full justify-start"
                onClick={() => toggleMetric(metric.id)}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${
                    selectedMetrics.includes(metric.id) ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                {metric.name}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 