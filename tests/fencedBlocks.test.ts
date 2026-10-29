import { describe, it, expect } from 'vitest';
import { findFencedBlocks } from '../src/services/markdownScan';

describe('findFencedBlocks', () => {
  it('finds a mermaid block with its code range', () => {
    const text = 'Intro\n```mermaid\ngraph TD;\n  A-->B;\n```\nEnde';
    const [block] = findFencedBlocks(text);
    expect(block.info).toBe('mermaid');
    expect(text.slice(block.from, block.to)).toBe('```mermaid\ngraph TD;\n  A-->B;\n```');
    expect(block.code).toBe('graph TD;\n  A-->B;');
    expect(text.slice(block.codeFrom, block.codeTo)).toBe(block.code);
  });

  it('does not find blocks nested in another fenced block', () => {
    const text = '````md\n```mermaid\ngraph TD; A-->B\n```\n````\n';
    expect(findFencedBlocks(text).map((b) => b.info)).toEqual(['md']);
  });

  it('supports tilde fences, info strings with options and empty blocks', () => {
    const blocks = findFencedBlocks('~~~ Mermaid theme=dark\nx\n~~~\n```js\n```');
    expect(blocks.map((b) => [b.info, b.code])).toEqual([
      ['mermaid', 'x'],
      ['js', ''],
    ]);
  });

  it('ignores an unclosed fence', () => {
    expect(findFencedBlocks('```mermaid\ngraph TD; A-->B')).toEqual([]);
  });
});
