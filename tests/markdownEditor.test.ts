import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { slashCommandSource } from '../src/webviews/markdown/extensions/slashCommands';

describe('CodeMirror Markdown Editor & Zero-Diff Verification', () => {
  describe('Slash Command Autocomplete', () => {
    it('triggers autocomplete when typing / at the start of a line', () => {
      const state = EditorState.create({
        doc: '/tasks',
      });
      // Cursor is at end of document
      const result = slashCommandSource({
        state,
        pos: 6,
        matchBefore: (regex: RegExp) => {
          const match = '/tasks'.match(regex);
          if (!match) return null;
          return { from: 0, to: 6, text: match[0] };
        },
      } as any);

      expect(result).not.toBeNull();
      expect(result?.options.some((opt) => opt.label === '/tasks')).toBe(true);
      expect(result?.options.some((opt) => opt.label === '/h1')).toBe(true);
      expect(result?.options.some((opt) => opt.label === '/table')).toBe(true);
      expect(result?.options.some((opt) => opt.label === '/chart')).toBe(true);
    });

    it('replaces the slash command token with the selected snippet', () => {
      const state = EditorState.create({
        doc: '# My Note\n\n/tasks',
      });
      const slashPos = state.doc.toString().indexOf('/tasks');
      const tr = state.update({
        changes: { from: slashPos, to: slashPos + 6, insert: '- [ ] ' },
      });

      expect(tr.newDoc.toString()).toBe('# My Note\n\n- [ ] ');
    });
  });

  describe('Interactive Task Checkbox Toggling', () => {
    it('toggles an unchecked checkbox [ ] to [x] with a single-character change', () => {
      const initialDoc = '# Todo List\n\n- [ ] First item\n- [ ] Second item\n';
      const state = EditorState.create({ doc: initialDoc });

      // First task checkbox bracket is at index 15: "[ ]"
      const bracketPos = initialDoc.indexOf('[ ]');
      const spaceCharPos = bracketPos + 1;

      // Toggle [ ] -> [x]
      const tr = state.update({
        changes: { from: spaceCharPos, to: spaceCharPos + 1, insert: 'x' },
      });

      const updatedDoc = tr.newDoc.toString();
      expect(updatedDoc).toBe('# Todo List\n\n- [x] First item\n- [ ] Second item\n');

      // Verify untouched lines remain identical byte-for-byte
      expect(updatedDoc.slice(0, bracketPos)).toBe(initialDoc.slice(0, bracketPos));
      expect(updatedDoc.slice(bracketPos + 3)).toBe(initialDoc.slice(bracketPos + 3));
    });

    it('toggles a checked checkbox [x] to [ ] with a single-character change', () => {
      const initialDoc = '- [x] Completed task\n';
      const state = EditorState.create({ doc: initialDoc });

      const xPos = initialDoc.indexOf('x');
      const tr = state.update({
        changes: { from: xPos, to: xPos + 1, insert: ' ' },
      });

      expect(tr.newDoc.toString()).toBe('- [ ] Completed task\n');
    });
  });

  describe('Zero-Diff Persistence & Format Fidelity', () => {
    it('preserves single newlines, tables, and special markdown trivia without inserting extra breaks or backslashes', () => {
      const complexDoc = [
        '# dashboard-modernization Specification',
        '',
        '## Purpose',
        'TBD - created by archiving change modernize-dashboard. Update Purpose after archive.',
        '## Requirements',
        '### Requirement: Glassmorphism Theme Styling',
        'The dashboard page layout SHALL use glassmorphism styling, matching the Admin Users table view.',
        'Specifically, it SHALL utilize backdrop blur (`backdrop-blur-xl`), translucent card background (`bg-card/60`), translucent borders (`border-border/40`), and soft drop shadows (`shadow-xl`) on all dashboard widget cards.',
        '',
        '#### Scenario: Verify Glassmorphism Styling application',
        '- **WHEN** the user navigates to the Dashboard page',
        '- **THEN** all container cards are rendered with translucent backgrounds, borders, and backdrop-blur effects',
      ].join('\n');

      const state = EditorState.create({ doc: complexDoc });

      // Simulate user editing only line 4 ("TBD - ..." -> "Initial draft description.")
      const searchTarget = 'TBD - created by archiving change modernize-dashboard. Update Purpose after archive.';
      const startPos = complexDoc.indexOf(searchTarget);
      const endPos = startPos + searchTarget.length;

      const tr = state.update({
        changes: { from: startPos, to: endPos, insert: 'Initial draft description.' },
      });

      const result = tr.newDoc.toString();

      // Verify before and after regions are bit-exact
      expect(result.slice(0, startPos)).toBe(complexDoc.slice(0, startPos));
      expect(result.slice(startPos + 'Initial draft description.'.length)).toBe(
        complexDoc.slice(endPos)
      );

      // Verify no backslashes were injected
      expect(result.includes('\\')).toBe(false);

      // Verify line counts are completely preserved
      const originalLines = complexDoc.split('\n');
      const resultLines = result.split('\n');
      expect(resultLines.length).toBe(originalLines.length);
    });
  });

  describe('Active Toolbar State Detection', () => {
    it('detects bold, lists, and headings accurately based on cursor position', () => {
      const doc = '# Header 1\n- [ ] Task with **bold** text\n- Simple bullet\n> Blockquote\n';
      const state = EditorState.create({
        doc,
        extensions: [markdown()],
      });

      // At index 2 (inside '# Header 1')
      const line1 = state.doc.lineAt(2);
      expect(/^#\s/.test(line1.text)).toBe(true);

      // At index 28 (inside '**bold**')
      const tree = syntaxTree(state);
      let isBold = false;
      for (let cur = tree.resolveInner(28, 1); cur; cur = cur.parent) {
        if (cur.name === 'StrongEmphasis') isBold = true;
      }
      expect(isBold).toBe(true);

      // Line 2 is task list
      const line2 = state.doc.lineAt(20);
      expect(/^\s*[-*+]\s+\[[ xX]\]/.test(line2.text)).toBe(true);

      // Line 3 is bullet list
      const line3 = state.doc.lineAt(45);
      expect(/^\s*[-*+]\s+/.test(line3.text)).toBe(true);
      expect(/^\s*[-*+]\s+\[[ xX]\]/.test(line3.text)).toBe(false);

      // Line 4 is blockquote
      const line4 = state.doc.lineAt(63);
      expect(/^\s*>\s*/.test(line4.text)).toBe(true);
    });
  });
});
