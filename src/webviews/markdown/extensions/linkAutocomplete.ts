import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
} from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { LinkCandidate } from '../../../companion/noteLinking';

export const FILE_TYPE_ICONS: Record<LinkCandidate['fileType'], string> = {
  note: '📄',
  task: '📋',
  chart: '📊',
  image: '🖼️',
  pdf: '📑',
  file: '📎',
};

export function createLinkAutocompleteSource(
  getCandidates: () => LinkCandidate[]
) {
  return function linkAutocompleteSource(
    context: CompletionContext
  ): CompletionResult | null {
    const match = context.matchBefore(/\[\[([^\]]*)$/);
    if (!match) return null;

    const candidates = getCandidates();
    const from = match.from + 2;
    const to = match.to;

    const options: Completion[] = candidates.map((candidate) => {
      const icon = FILE_TYPE_ICONS[candidate.fileType] || '📎';
      return {
        label: candidate.label,
        displayLabel: `${icon} ${candidate.label}`,
        detail: candidate.matchedBy
          ? `${candidate.relPath} · ${candidate.matchedBy === 'alias' ? 'Alias' : 'Titel'}`
          : candidate.relPath,
        type: candidate.fileType,
        boost: candidate.fileType === 'note' ? 2 : 1,
        apply: (
          view: EditorView,
          _completion: Completion,
          applyFrom: number,
          applyTo: number
        ) => {
          const startPos = Math.max(0, applyFrom - 2);
          let endPos = applyTo;
          if (view.state.sliceDoc(applyTo, applyTo + 2) === ']]') {
            endPos = applyTo + 2;
          } else if (view.state.sliceDoc(applyTo, applyTo + 1) === ']') {
            endPos = applyTo + 1;
          }

          const insert = `[[${candidate.insertText}]]`;
          view.dispatch({
            changes: { from: startPos, to: endPos, insert },
            selection: { anchor: startPos + insert.length },
          });
        },
      };
    });

    return {
      from,
      to,
      options,
      filter: true,
    };
  };
}

export const linkAutocompleteTheme = EditorView.baseTheme({
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.3))',
    backgroundColor: 'var(--vscode-editorWidget-background, #252526)',
    color: 'var(--vscode-editorWidget-foreground, #cccccc)',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    padding: '4px',
    minWidth: '240px',
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

export function linkAutocomplete(getCandidates: () => LinkCandidate[]): Extension {
  return [
    linkAutocompleteTheme,
    autocompletion({
      override: [createLinkAutocompleteSource(getCandidates)],
      icons: false,
    }),
  ];
}

