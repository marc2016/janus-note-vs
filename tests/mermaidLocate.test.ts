import { describe, it, expect } from 'vitest';
import { extractMermaidCode, locateMermaidBlock } from '../src/services/markdownScan';

const note = (code: string, before = '# Notiz\n\n') => `${before}\`\`\`mermaid\n${code}\n\`\`\`\n`;

describe('locateMermaidBlock', () => {
  it('finds the block with equal code', () => {
    const text = note('graph TD; A-->B', '# Notiz\n\nNeuer Absatz\n\n');
    const block = locateMermaidBlock(text, { code: 'graph TD; A-->B', line: 3 });
    expect(block?.code).toBe('graph TD; A-->B');
    expect(block?.line).toBe(5);
  });

  it('picks the identical diagram nearest to the stored line', () => {
    const text = `${note('graph TD; A-->B')}\nText\n\n${note('graph TD; A-->B', '')}`;
    expect(locateMermaidBlock(text, { code: 'graph TD; A-->B', line: 9 })?.line).toBe(9);
    expect(locateMermaidBlock(text, { code: 'graph TD; A-->B', line: 3 })?.line).toBe(3);
  });

  it('falls back to the block at the stored line when its code was edited', () => {
    const block = locateMermaidBlock(note('graph TD; A-->C'), { code: 'graph TD; A-->B', line: 3 });
    expect(block?.code).toBe('graph TD; A-->C');
  });

  it('returns nothing when the diagram was removed', () => {
    expect(locateMermaidBlock('# Notiz\n\nNur Text\n', { code: 'graph TD; A-->B', line: 3 })).toBeUndefined();
  });
});

describe('extractMermaidCode', () => {
  it('takes the mermaid block', () => {
    expect(extractMermaidCode('Ich habe C ergänzt.\n\n```mermaid\ngraph TD; A-->B-->C\n```\n')).toBe('graph TD; A-->B-->C');
  });

  it('accepts an untyped block when there is no mermaid block', () => {
    expect(extractMermaidCode('So:\n```\ngraph LR; X-->Y\n```')).toBe('graph LR; X-->Y');
  });

  it('ignores answers without a block or with only other languages', () => {
    expect(extractMermaidCode('Welche Richtung soll das Diagramm haben?')).toBeUndefined();
    expect(extractMermaidCode('```js\nconst a = 1;\n```')).toBeUndefined();
  });
});
