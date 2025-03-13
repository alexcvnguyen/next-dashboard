'use client';

import React, { useState, useCallback } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug } from 'lucide-react';
import type { DashboardConfig, DashboardSection, MetricConfig } from './types';
import type { ProcessedData, SleepData, DailyLocationStats, JournalEntry } from '@/components/dashboard/lib';
import { MetricSelector } from './components/metric-selector';
import { VisualizationSection } from './components/visualization-section';
import { DashboardControls } from './components/dashboard-controls';
import { DebugView } from './components/debug-view';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardData {
  timeline: ProcessedData[];
  sleep: SleepData[];
  location: DailyLocationStats[];
  journals: JournalEntry[];
}

interface Dashboard2Props {
  initialConfig: DashboardConfig;
  data: DashboardData;
  onConfigChange?: (config: DashboardConfig) => void;
}

export function Dashboard2({ initialConfig, data, onConfigChange }: Dashboard2Props) {
  const [config, setConfig] = useState<DashboardConfig>(initialConfig);
  const [isEditing, setIsEditing] = useState(false);
  const [showDebugView, setShowDebugView] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(
    config.sections.flatMap(s => s.metrics)
  );

  // Handle section layout changes
  const handleLayoutChange = useCallback((layout: Layout[]) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        layout: layout.find(l => l.i === section.id) || section.layout
      }))
    }));
  }, []);

  // Handle metric selection changes
  const handleMetricChange = useCallback((metrics: string[]) => {
    setSelectedMetrics(metrics);
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        metrics: metrics.filter(m => {
          const metric = prev.availableMetrics.find(am => am.id === m);
          return metric && isMetricCompatibleWithVisualization(metric, section.type);
        })
      }))
    }));
  }, []);

  // Helper function to check if a metric is compatible with a visualization type
  const isMetricCompatibleWithVisualization = (metric: MetricConfig, visualizationType: DashboardSection['type']) => {
    switch (visualizationType) {
      case 'line':
      case 'bar':
        return ['number', 'duration', 'percentage'].includes(metric.type);
      case 'scatter':
        return metric.type === 'number';
      case 'pie':
        return ['percentage', 'number'].includes(metric.type);
      case 'stat':
        return true; // All metric types can be displayed as stats
      case 'table':
        return true; // All metric types can be displayed in tables
      default:
        return false;
    }
  };

  // Handle section addition
  const handleAddSection = useCallback((type: DashboardSection['type']) => {
    const newSection: DashboardSection = {
      id: `section-${Date.now()}`,
      title: `New ${type} Section`,
      type,
      metrics: [],
      layout: {
        x: 0,
        y: Infinity, // Add to bottom
        w: 6,
        h: 4,
      }
    };

    setConfig(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  }, []);

  // Handle section removal
  const handleRemoveSection = useCallback((sectionId: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId)
    }));
  }, []);

  // Handle section reordering
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    setConfig(prev => {
      const sections = Array.from(prev.sections);
      const [reorderedSection] = sections.splice(result.source.index, 1);
      sections.splice(result.destination!.index, 0, reorderedSection);
      return { ...prev, sections };
    });
  }, []);

  // Notify parent of config changes
  React.useEffect(() => {
    onConfigChange?.(config);
  }, [config, onConfigChange]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant={isEditing ? "secondary" : "outline"}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Done" : "Edit"}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={() => setShowDebugView(!showDebugView)}>
              <Bug className="w-4 h-4 mr-2" />
              Debug
            </Button>
          )}
        </div>
      </div>

      {isEditing && (
        <>
          <MetricSelector
            availableMetrics={config.availableMetrics}
            selectedMetrics={selectedMetrics}
            onChange={handleMetricChange}
          />
          <DashboardControls onAddSection={handleAddSection} />
        </>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard" type="section">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: config.sections.map(s => ({ ...s.layout, i: s.id })) }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={100}
                onLayoutChange={handleLayoutChange}
                isDraggable={isEditing}
                isResizable={isEditing}
              >
                {config.sections.map((section) => (
                  <div key={section.id}>
                    <Card className="h-full">
                      <VisualizationSection
                        section={section}
                        data={data}
                        isEditing={isEditing}
                        onRemove={() => handleRemoveSection(section.id)}
                      />
                    </Card>
                  </div>
                ))}
              </ResponsiveGridLayout>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {showDebugView && (
        <DebugView config={config} data={data} />
      )}
    </div>
  );
} 