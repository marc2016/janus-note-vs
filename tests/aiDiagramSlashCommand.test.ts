import { describe, it, expect, vi } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { getSlashCommands } from '../src/webviews/markdown/extensions/slashCommands';
import { MERMAID_PLACEHOLDER } from '../src/services/markdownScan';

function run(doc: string, command: string, onAiDiagram = vi.fn()) {
  const from = doc.indexOf(command);
  const view = {
    state: EditorState.create({ doc, selection: { anchor: from + command.length } }),
    dispatch(spec: TransactionSpec) {
      view.state = view.state.update(spec).state;
    },
  };
  const completion = getSlashCommands({ onAiDiagram }).find((c) => c.label === command)!;
  (completion.apply as any)(view, completion, from, from + command.length);
  return { view, onAiDiagram };
}

const placeholderBlock = `\`\`\`mermaid\n${MERMAID_PLACEHOLDER}\n\`\`\`\n`;

describe('/ki-diagramm', () => {
  it('inserts the placeholder on an empty line and opens the chat for it', () => {
    const { view, onAiDiagram } = run('# Plan\n\n/ki-diagramm', '/ki-diagramm');
    expect(view.state.doc.toString()).toBe(`# Plan\n\n${placeholderBlock}`);
    expect(onAiDiagram).toHaveBeenCalledWith('# Plan\n\n'.length);
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('starts the block on the next line when typed after text', () => {
    const { view, onAiDiagram } = run('Ablauf: /ki-diagramm', '/ki-diagramm');
    expect(view.state.doc.toString()).toBe(`Ablauf: \n${placeholderBlock}`);
    expect(onAiDiagram).toHaveBeenCalledWith('Ablauf: \n'.length);
  });

  it('leaves /chart unchanged', () => {
    const chart = getSlashCommands().find((c) => c.label === '/chart')!;
    expect(chart.apply).toBe('```mermaid\ngraph TD;\n    A-->B;\n```\n');
  });
});
