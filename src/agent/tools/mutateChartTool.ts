import * as vscode from 'vscode';
import { z } from 'zod';
import { CompanionManager } from '../../companion/companionManager';
import { getCompanionPaths, isChartCompanion } from '../../companion/companionPaths';
import { ChartCompanion, ChartTypeSchema } from '../../models/chart';

export interface MutateChartToolInput {
  noteUri: string;
  chartType?: string;
  code?: string;
  data?: any[];
  nodes?: any[];
  links?: any[];
  options?: Record<string, any>;
  title?: string;
}

const MutateChartInputSchema = z.object({
  noteUri: z.string().min(1),
  chartType: ChartTypeSchema.optional(),
  code: z.string().min(1).optional(),
  data: z.array(z.any()).optional(),
  nodes: z.array(z.any()).optional(),
  links: z.array(z.any()).optional(),
  options: z.record(z.any()).optional(),
  title: z.string().optional(),
});

export class MutateChartTool implements vscode.LanguageModelTool<MutateChartToolInput> {
  constructor(private companionManager: CompanionManager) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<MutateChartToolInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const parseResult = MutateChartInputSchema.safeParse(options.input);
    if (!parseResult.success) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Schema validation error: ${JSON.stringify(parseResult.error.format())}`
        )
      ]);
    }

    const { noteUri, chartType, code, data, nodes, links, options: chartOptions, title } = parseResult.data;
    let targetChartUri: vscode.Uri;

    try {
      const parsedUri = vscode.Uri.parse(noteUri);
      if (isChartCompanion(parsedUri.fsPath)) {
        targetChartUri = parsedUri;
      } else {
        const paths = getCompanionPaths(parsedUri.fsPath);
        targetChartUri = vscode.Uri.file(paths.chartPath);
      }
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Invalid noteUri provided: ${err?.message || String(err)}`)
      ]);
    }

    try {
      let companion: ChartCompanion;
      try {
        companion = await this.companionManager.readChartCompanion(targetChartUri);
      } catch {
        companion = { version: 1, chartType: chartType || 'mermaid' };
      }

      if (code !== undefined) {
        companion.code = code;
      }
      if (data !== undefined) {
        companion.data = data;
      }
      if (nodes !== undefined) {
        companion.nodes = nodes;
      }
      if (links !== undefined) {
        companion.links = links;
      }
      if (chartOptions !== undefined) {
        companion.options = chartOptions;
      }
      if (chartType) {
        companion.chartType = chartType;
      }
      if (title) {
        companion.title = title;
      }

      const outputData: Record<string, any> = { ...companion };
      if (typeof outputData.code === 'string' && outputData.code.includes('\n')) {
        outputData.code = outputData.code.split('\n');
      }

      const updatedJson = Buffer.from(JSON.stringify(outputData, null, 2), 'utf-8');
      await vscode.workspace.fs.writeFile(targetChartUri, updatedJson);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Successfully updated chart companion '${targetChartUri.fsPath}' (Engine: ${companion.chartType}).`
        )
      ]);
    } catch (err: any) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error mutating chart companion: ${err?.message || String(err)}`)
      ]);
    }
  }
}
