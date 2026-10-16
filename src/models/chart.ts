import { z } from 'zod';

export const ChartTypeSchema = z.enum([
  'bar',
  'line',
  'donut',
  'pie',
  'network',
  'graph',
  'tree',
  'mermaid',
  'flowchart',
]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const DataPointSchema = z
  .object({
    label: z.string(),
    value: z.number(),
    category: z.string().optional(),
    color: z.string().optional(),
  })
  .passthrough();

export const NetworkNodeSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    group: z.union([z.string(), z.number()]).optional(),
    size: z.number().optional(),
    color: z.string().optional(),
  })
  .passthrough();

export const NetworkLinkSchema = z
  .object({
    source: z.string(),
    target: z.string(),
    value: z.number().optional(),
    label: z.string().optional(),
  })
  .passthrough();

export const ChartCompanionSchema = z.object({
  version: z.number().int().default(1),
  title: z.string().optional(),
  notePath: z.string().optional(),
  chartType: ChartTypeSchema.default('mermaid'),
  data: z.union([z.array(DataPointSchema), z.record(z.any()), z.array(z.any())]).optional(),
  nodes: z.array(NetworkNodeSchema).optional(),
  links: z.array(NetworkLinkSchema).optional(),
  options: z.record(z.any()).optional(),
  code: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val.join('\n') : val))
    .optional(),
});
export type ChartCompanion = z.infer<typeof ChartCompanionSchema>;

export function parseChartCompanion(input: unknown): ChartCompanion {
  if (typeof input === 'string') {
    const parsed = JSON.parse(input);
    return ChartCompanionSchema.parse(parsed);
  }
  return ChartCompanionSchema.parse(input);
}

export function createInitialChartCompanion(title?: string): ChartCompanion {
  return {
    version: 1,
    title: title || 'Architecture Diagram',
    chartType: 'mermaid',
    code: 'graph TD\n    A[Start] --> B[Process]\n    B --> C[Finish]',
    options: {},
  };
}

export function createInitialD3ChartCompanion(title?: string): ChartCompanion {
  return {
    version: 1,
    title: title || 'Project Metrics',
    chartType: 'bar',
    data: [
      { label: 'Planning', value: 8 },
      { label: 'In Progress', value: 14 },
      { label: 'Testing', value: 6 },
      { label: 'Done', value: 20 },
    ],
    options: {
      xLabel: 'Phase',
      yLabel: 'Story Points',
    },
  };
}
