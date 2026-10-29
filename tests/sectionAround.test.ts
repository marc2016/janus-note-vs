import { describe, it, expect } from 'vitest';
import { isMermaidPlaceholder, MERMAID_PLACEHOLDER, sectionAround } from '../src/services/markdownScan';

const block = '```mermaid\ngraph TD; A-->B\n```';
const range = (text: string) => {
  const from = text.indexOf('```mermaid');
  return [from, from + block.length] as const;
};

describe('sectionAround', () => {
  it('takes the section from the heading above to the next heading of the same level, without the block', () => {
    const text = `# Plan\n\n## Inbox-Workflow\nGedanken landen in der Inbox und werden einsortiert.\n\n${block}\n\nDanach Aufgaben.\n\n## Tagesnotizen\nAnderes Thema\n`;
    expect(sectionAround(text, ...range(text))).toBe(
      '## Inbox-Workflow\nGedanken landen in der Inbox und werden einsortiert.\n\nDanach Aufgaben.'
    );
  });

  it('keeps nested sub-headings and stops at a higher level', () => {
    const text = `## Ablauf\nIntro\n${block}\n### Details\nMehr\n# Neues Kapitel\nNein`;
    expect(sectionAround(text, ...range(text))).toBe('## Ablauf\nIntro\n\n### Details\nMehr');
  });

  it('starts at the beginning of the body without a heading above, dropping frontmatter', () => {
    const text = `---\ndate: 2026-10-29\n---\nNur Text davor.\n${block}\n# Später\nx`;
    expect(sectionAround(text, ...range(text))).toBe('Nur Text davor.');
  });

  it('ignores headings inside code blocks', () => {
    const text = `## Echt\nA\n\`\`\`md\n## kein Abschnitt\n\`\`\`\n${block}\nB`;
    expect(sectionAround(text, ...range(text))).toContain('## Echt');
  });

  it('caps the length', () => {
    const text = `## Lang\n${'x'.repeat(5000)}\n${block}`;
    const section = sectionAround(text, ...range(text), 100);
    expect(section.length).toBe(101);
    expect(section.endsWith('…')).toBe(true);
  });
});

describe('MERMAID_PLACEHOLDER', () => {
  it('is recognized with surrounding whitespace', () => {
    expect(isMermaidPlaceholder(`\n${MERMAID_PLACEHOLDER}\n`)).toBe(true);
    expect(isMermaidPlaceholder('graph TD; A-->B')).toBe(false);
  });
});
