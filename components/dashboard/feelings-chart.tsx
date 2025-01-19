'use client';

import { useMemo } from 'react';
import { ResponsiveCirclePacking } from '@nivo/circle-packing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JournalEntry {
  positive_feelings?: string[];
  negative_feelings?: string[];
  cognitive_states?: string[];
  physical_states?: string[];
}

interface FeelingsChartProps {
  data: JournalEntry[];
}

interface EmotionCount {
  name: string;
  count: number;
  emoji?: string;
  category: string;
}

interface EmotionNode {
  name: string;
  value: number;
  emoji?: string;
  category: string;
}

interface HierarchicalNode {
  name: string;
  value?: number;
  emoji?: string;
  category?: string;
  children?: EmotionNode[];
}

const CATEGORY_COLORS = {
  'positive': 'hsl(143, 71%, 45%)', // Softer green
  'negative': 'hsl(358, 75%, 59%)',   // Softer red
  'cognitive': 'hsl(217, 91%, 60%)', // Bright blue
  'physical': 'hsl(31, 90%, 55%)',  // Warm orange
  'neutral': 'hsl(0, 0%, 62%)',     // Neutral gray
};

export function FeelingsChart({ data }: FeelingsChartProps) {
  const { emotionsData, statesData } = useMemo(() => {
    // Count occurrences of each emotion and state
    const emotionCounts = new Map<string, EmotionCount>();
    const stateCounts = new Map<string, EmotionCount>();

    data.forEach(entry => {
      // Process positive feelings
      entry.positive_feelings?.forEach((emotion: string) => {
        const [name, emoji] = emotion.split(' ');
        const key = name.toLowerCase();
        
        if (!emotionCounts.has(key)) {
          emotionCounts.set(key, { name, count: 1, emoji, category: 'positive' });
        } else {
          const current = emotionCounts.get(key)!;
          emotionCounts.set(key, { ...current, count: current.count + 1 });
        }
      });

      // Process negative feelings
      entry.negative_feelings?.forEach((emotion: string) => {
        const [name, emoji] = emotion.split(' ');
        const key = name.toLowerCase();
        
        if (!emotionCounts.has(key)) {
          emotionCounts.set(key, { name, count: 1, emoji, category: 'negative' });
        } else {
          const current = emotionCounts.get(key)!;
          emotionCounts.set(key, { ...current, count: current.count + 1 });
        }
      });

      // Process cognitive states
      entry.cognitive_states?.forEach((state: string) => {
        const [name, emoji] = state.split(' ');
        const key = name.toLowerCase();
        
        if (!stateCounts.has(key)) {
          stateCounts.set(key, { name, count: 1, emoji, category: 'cognitive' });
        } else {
          const current = stateCounts.get(key)!;
          stateCounts.set(key, { ...current, count: current.count + 1 });
        }
      });

      // Process physical states
      entry.physical_states?.forEach((state: string) => {
        const [name, emoji] = state.split(' ');
        const key = name.toLowerCase();
        
        if (!stateCounts.has(key)) {
          stateCounts.set(key, { name, count: 1, emoji, category: 'physical' });
        } else {
          const current = stateCounts.get(key)!;
          stateCounts.set(key, { ...current, count: current.count + 1 });
        }
      });
    });

    // Convert to hierarchical format for circle packing
    const emotionsHierarchy: HierarchicalNode = {
      name: 'emotions',
      children: Array.from(emotionCounts.values()).map(({ name, count, emoji, category }) => ({
        name,
        value: count,
        emoji,
        category
      }))
    };

    const statesHierarchy: HierarchicalNode = {
      name: 'states',
      children: Array.from(stateCounts.values()).map(({ name, count, emoji, category }) => ({
        name,
        value: count,
        emoji,
        category
      }))
    };

    return { emotionsData: emotionsHierarchy, statesData: statesHierarchy };
  }, [data]);

  if (!data.length) return null;

  const CircleChart = ({ data }: { data: HierarchicalNode }) => (
    <ResponsiveCirclePacking
      data={data}
      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
      id="name"
      value="value"
      colors={node => {
        if (node.depth === 0) return 'transparent';
        return CATEGORY_COLORS[(node.data as EmotionNode).category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.neutral;
      }}
      childColor={{
        from: 'color',
        modifiers: [['brighter', 0.2]]
      }}
      padding={3}
      enableLabels={true}
      label={d => (d.data as EmotionNode).emoji || ''}
      labelTextColor={{
        from: 'color',
        modifiers: [['darker', 2]]
      }}
      labelsSkipRadius={10}
      borderWidth={1}
      borderColor={{
        from: 'color',
        modifiers: [['darker', 0.2]]
      }}
      animate={true}
      motionConfig="gentle"
      theme={{
        labels: {
          text: {
            fontSize: 20,
          }
        }
      }}
      tooltip={({ id, value, color }) => (
        <div className="bg-white/90 backdrop-blur-sm p-2 border border-gray-200 rounded-lg shadow-md">
          <span style={{ color }} className="font-medium">{id}</span>
          <br />
          <span className="text-sm text-gray-600">Frequency: {value}</span>
        </div>
      )}
    />
  );

  return (
    <Card className="col-span-2 bg-white/50 backdrop-blur-sm border-gray-100">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-xl font-semibold">Emotional Landscape</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Emotions Chart */}
          <Card className="bg-white/30 border-gray-100 hover:bg-white/40 transition-colors">
            <CardHeader className="p-4">
              <CardTitle className="text-base font-medium">Emotions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px]">
                <CircleChart data={emotionsData} />
              </div>
            </CardContent>
          </Card>

          {/* States Chart */}
          <Card className="bg-white/30 border-gray-100 hover:bg-white/40 transition-colors">
            <CardHeader className="p-4">
              <CardTitle className="text-base font-medium">Mental & Physical States</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px]">
                <CircleChart data={statesData} />
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
} 