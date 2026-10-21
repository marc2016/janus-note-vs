import {
  autocompletion,
  startCompletion,
  CompletionContext,
  CompletionResult,
  Completion,
} from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { formatIsoDate } from '../lib/datePickerUtils';

export interface SlashCommandsOptions {
  onOpenDatePicker?: (pos: number, coords: { top: number; left: number } | null) => void;
  linkCompletionSource?: (context: CompletionContext) => CompletionResult | null;
}

export function getSlashCommands(options?: SlashCommandsOptions): Completion[] {
  return [
    {
      label: '/tasks',
      detail: 'Task list item (- [ ])',
      type: 'keyword',
      apply: '- [ ] ',
    },
    {
      label: '/today',
      detail: 'Heutiges Datum (YYYY-MM-DD)',
      type: 'keyword',
      apply: (view: EditorView, completion: Completion, from: number, to: number) => {
        const dateStr = formatIsoDate(new Date());
        view.dispatch({
          changes: { from, to, insert: dateStr },
          selection: { anchor: from + dateStr.length },
        });
      },
    },
    {
      label: '/heute',
      detail: 'Heutiges Datum (YYYY-MM-DD)',
      type: 'keyword',
      apply: (view: EditorView, completion: Completion, from: number, to: number) => {
        const dateStr = formatIsoDate(new Date());
        view.dispatch({
          changes: { from, to, insert: dateStr },
          selection: { anchor: from + dateStr.length },
        });
      },
    },
    {
      label: '/date',
      detail: 'Datumsauswahl öffnen (DatePicker)',
      type: 'keyword',
      apply: (view: EditorView, completion: Completion, from: number, to: number) => {
        view.dispatch({
          changes: { from, to, insert: '' },
          selection: { anchor: from },
        });
        const coords = view.coordsAtPos(from);
        const position = coords ? { top: coords.bottom, left: coords.left } : null;
        if (options?.onOpenDatePicker) {
          options.onOpenDatePicker(from, position);
        }
      },
    },
    {
      label: '/link',
      detail: 'Link zu Notiz oder Datei einfügen ([[)',
      type: 'keyword',
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        view.dispatch({
          changes: { from, to, insert: '[[' },
          selection: { anchor: from + 2 },
        });
        startCompletion(view);
      },
    },
    {
      label: '/verlinken',
      detail: 'Link zu Notiz oder Datei einfügen ([[)',
      type: 'keyword',
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        view.dispatch({
          changes: { from, to, insert: '[[' },
          selection: { anchor: from + 2 },
        });
        startCompletion(view);
      },
    },
    {
      label: '/note',
      detail: 'Notiz verlinken ([[)',
      type: 'keyword',
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        view.dispatch({
          changes: { from, to, insert: '[[' },
          selection: { anchor: from + 2 },
        });
        startCompletion(view);
      },
    },
    {
      label: '/datum',
      detail: 'Datumsauswahl öffnen (DatePicker)',
      type: 'keyword',
      apply: (view: EditorView, completion: Completion, from: number, to: number) => {
        view.dispatch({
          changes: { from, to, insert: '' },
          selection: { anchor: from },
        });
        const coords = view.coordsAtPos(from);
        const position = coords ? { top: coords.bottom, left: coords.left } : null;
        if (options?.onOpenDatePicker) {
          options.onOpenDatePicker(from, position);
        }
      },
    },
    {
      label: '/h1',
      detail: 'Heading 1 (#)',
      type: 'keyword',
      apply: '# ',
    },
    {
      label: '/h2',
      detail: 'Heading 2 (##)',
      type: 'keyword',
      apply: '## ',
    },
    {
      label: '/h3',
      detail: 'Heading 3 (###)',
      type: 'keyword',
      apply: '### ',
    },
    {
      label: '/table',
      detail: 'Markdown table',
      type: 'keyword',
      apply: '| Column 1 | Column 2 |\n| --- | --- |\n| Item 1 | Item 2 |\n',
    },
    {
      label: '/callout',
      detail: 'Callout note block (> [!NOTE])',
      type: 'keyword',
      apply: '> [!NOTE]\n> ',
    },
    {
      label: '/tip',
      detail: 'Callout tip block (> [!TIP])',
      type: 'keyword',
      apply: '> [!TIP]\n> ',
    },
    {
      label: '/warning',
      detail: 'Callout warning block (> [!WARNING])',
      type: 'keyword',
      apply: '> [!WARNING]\n> ',
    },
    {
      label: '/chart',
      detail: 'Mermaid flowchart block',
      type: 'keyword',
      apply: '```mermaid\ngraph TD;\n    A-->B;\n```\n',
    },
    {
      label: '/code',
      detail: 'Code block (```)',
      type: 'keyword',
      apply: '```\n\n```\n',
    },
    {
      label: '/quote',
      detail: 'Blockquote (> )',
      type: 'keyword',
      apply: '> ',
    },
  ];
}

export function createSlashCommandSource(options?: SlashCommandsOptions) {
  const commands = getSlashCommands(options);
  return function slashCommandSource(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/\/([a-zA-Z0-9_-]*)$/);
    if (!match) return null;

    // Only trigger if at start of line or preceded by whitespace
    if (match.from > 0) {
      const prevChar = context.state.doc.sliceString(match.from - 1, match.from);
      if (!/\s/.test(prevChar)) {
        return null;
      }
    }

    return {
      from: match.from,
      to: match.to,
      options: commands,
      filter: true,
    };
  };
}

export const slashCommandSource = createSlashCommandSource();

export const slashCommandTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.3))',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    color: 'var(--vscode-editorWidget-foreground, #cccccc)',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    padding: '4px',
    minWidth: '220px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    maxHeight: '260px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '5px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--vscode-list-activeSelectionBackground, #04395e)',
    color: 'var(--vscode-list-activeSelectionForeground, #ffffff)',
  },
});

export function slashCommands(options?: SlashCommandsOptions): Extension {
  const sources = [createSlashCommandSource(options)];
  if (options?.linkCompletionSource) {
    sources.push(options.linkCompletionSource);
  }

  return [
    slashCommandTheme,
    autocompletion({
      override: sources,
      icons: false,
    }),
  ];
}
