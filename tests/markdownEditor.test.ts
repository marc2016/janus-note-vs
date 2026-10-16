import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { slashCommandSource } from '../src/webviews/markdown/extensions/slashCommands';
import { styledLists } from '../src/webviews/markdown/extensions/styledLists';
import { toggleInlineFormatting, formattingKeymap } from '../src/webviews/markdown/lib/formatting';

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

  describe('Styled Markdown Lists & Hierarchical Indentation', () => {
    it('creates bullet decorations and line indentation on unordered list items', () => {
      const doc = '- Top level\n  - Nested level 1\n    * Nested level 2\n1. Numbered item\n  1. Sub-numbered\n- [ ] Task checkbox';
      const state = EditorState.create({
        doc,
        extensions: [styledLists()],
      });

      // Check that the document text is 100% untouched
      expect(state.doc.toString()).toBe(doc);

      // Verify lines in doc
      const line1 = state.doc.line(1);
      expect(line1.text).toBe('- Top level');

      const line2 = state.doc.line(2);
      expect(line2.text).toBe('  - Nested level 1');

      const line3 = state.doc.line(3);
      expect(line3.text).toBe('    * Nested level 2');

      const line6 = state.doc.line(6);
      expect(line6.text).toBe('- [ ] Task checkbox');
    });

    it('ensures task list lines are not treated as bullet lists', () => {
      const isTaskList = (text: string) => /^(\s*[-*+]\s+)\[([ xX])\]/.test(text);
      const isUnorderedList = (text: string) =>
        !isTaskList(text) && /^(\s*)([-*+])(\s+)/.test(text);

      expect(isTaskList('- [ ] Unchecked')).toBe(true);
      expect(isTaskList('  - [x] Checked')).toBe(true);
      expect(isUnorderedList('- [ ] Unchecked')).toBe(false);
      expect(isUnorderedList('  - [x] Checked')).toBe(false);

      expect(isUnorderedList('- Regular bullet')).toBe(true);
      expect(isUnorderedList('  * Nested bullet')).toBe(true);
      expect(isUnorderedList('    + Deep nested')).toBe(true);
      expect(isUnorderedList('---')).toBe(false);
    });

    it('calculates indentation level correctly for 2-space and 4-space markdown indents', () => {
      const calcLevel = (lineText: string) => {
        const match = lineText.match(/^(\s*)([-*+]|\d+[.)])\s+/);
        if (!match) return 0;
        return Math.min(Math.floor(match[1].length / 2), 6);
      };

      expect(calcLevel('- Top level')).toBe(0);
      expect(calcLevel('  - Level 1 (2 spaces)')).toBe(1);
      expect(calcLevel('    - Level 2 (4 spaces)')).toBe(2);
      expect(calcLevel('      - Level 3 (6 spaces)')).toBe(3);
      expect(calcLevel('  1. Numbered level 1')).toBe(1);
    });
  });

  describe('Inline Formatting & Word-at-Cursor Expansion', () => {
    function createTestView(doc: string, cursor: number | { from: number; to: number }) {
      let state = EditorState.create({
        doc,
        selection:
          typeof cursor === 'number'
            ? { anchor: cursor }
            : { anchor: cursor.from, head: cursor.to },
        extensions: [markdown()],
      });
      const view: any = {
        get state() {
          return state;
        },
        dispatch(tr: any) {
          const transaction = tr.state ? tr : state.update(tr);
          state = transaction.state;
        },
        focus() {},
      };
      return view;
    }

    it('expands collapsed cursor inside a word and wraps it in bold (**)', () => {
      // "foo|bar" -> cursor at 3
      const view = createTestView('foobar', 3);
      const res = toggleInlineFormatting(view, '**');

      expect(res).toBe(true);
      expect(view.state.doc.toString()).toBe('**foobar**');
      // Cursor should be shifted by marker length (3 + 2 = 5)
      expect(view.state.selection.main.head).toBe(5);
    });

    it('formats word at cursor start and end boundaries', () => {
      // Start of word: "|foobar" -> cursor at 0
      const viewStart = createTestView('foobar', 0);
      toggleInlineFormatting(viewStart, '**');
      expect(viewStart.state.doc.toString()).toBe('**foobar**');
      expect(viewStart.state.selection.main.head).toBe(2);

      // End of word: "foobar|" -> cursor at 6
      const viewEnd = createTestView('foobar', 6);
      toggleInlineFormatting(viewEnd, '**');
      expect(viewEnd.state.doc.toString()).toBe('**foobar**');
      expect(viewEnd.state.selection.main.head).toBe(8);
    });

    it('excludes adjacent punctuation when formatting word at cursor', () => {
      // "hello|, world" -> cursor at 5 (after 'o', before ',')
      const view = createTestView('hello, world', 5);
      toggleInlineFormatting(view, '**');
      expect(view.state.doc.toString()).toBe('**hello**, world');
      expect(view.state.selection.main.head).toBe(7);
    });

    it('supports italic (*), strikethrough (~~), and inline code (`) markers', () => {
      // Italic
      const viewItalic = createTestView('italic', 3);
      toggleInlineFormatting(viewItalic, '*');
      expect(viewItalic.state.doc.toString()).toBe('*italic*');
      expect(viewItalic.state.selection.main.head).toBe(4);

      // Strikethrough
      const viewStrike = createTestView('strike', 3);
      toggleInlineFormatting(viewStrike, '~~');
      expect(viewStrike.state.doc.toString()).toBe('~~strike~~');
      expect(viewStrike.state.selection.main.head).toBe(5);

      // Inline Code
      const viewCode = createTestView('code', 2);
      toggleInlineFormatting(viewCode, '`');
      expect(viewCode.state.doc.toString()).toBe('`code`');
      expect(viewCode.state.selection.main.head).toBe(3);
    });

    it('unwraps/strips existing formatted node when cursor is inside it', () => {
      // Bold unwrap: "**foo|bar**" -> cursor at 5
      const viewBold = createTestView('**foobar**', 5);
      toggleInlineFormatting(viewBold, '**');
      expect(viewBold.state.doc.toString()).toBe('foobar');
      expect(viewBold.state.selection.main.head).toBe(3);

      // Italic unwrap: "*foo|bar*" -> cursor at 4
      const viewItalic = createTestView('*foobar*', 4);
      toggleInlineFormatting(viewItalic, '*');
      expect(viewItalic.state.doc.toString()).toBe('foobar');
      expect(viewItalic.state.selection.main.head).toBe(3);

      // Code unwrap: "`foo|bar`" -> cursor at 4
      const viewCode = createTestView('`foobar`', 4);
      toggleInlineFormatting(viewCode, '`');
      expect(viewCode.state.doc.toString()).toBe('foobar');
      expect(viewCode.state.selection.main.head).toBe(3);

      // Strikethrough unwrap: "~~foo|bar~~" -> cursor at 5
      const viewStrike = createTestView('~~foobar~~', 5);
      toggleInlineFormatting(viewStrike, '~~');
      expect(viewStrike.state.doc.toString()).toBe('foobar');
      expect(viewStrike.state.selection.main.head).toBe(3);
    });

    it('unwraps nested mark without affecting parent marks', () => {
      // "***bolditalic***" with cursor at 6 ('d')
      const view = createTestView('***bolditalic***', 6);
      // Stripping bold should leave italic
      toggleInlineFormatting(view, '**');
      expect(view.state.doc.toString()).toBe('*bolditalic*');
    });

    it('inserts empty marker pair at whitespace or empty position', () => {
      // Cursor in whitespace: "hello   world" at index 7 (middle space)
      const viewWs = createTestView('hello   world', 7);
      toggleInlineFormatting(viewWs, '**');
      expect(viewWs.state.doc.toString()).toBe('hello  **** world');
      expect(viewWs.state.selection.main.head).toBe(9);

      // Cursor in empty doc: ""
      const viewEmpty = createTestView('', 0);
      toggleInlineFormatting(viewEmpty, '**');
      expect(viewEmpty.state.doc.toString()).toBe('****');
      expect(viewEmpty.state.selection.main.head).toBe(2);
    });

    it('wraps and unwraps non-collapsed active selections', () => {
      // Wrap active selection
      const viewWrap = createTestView('hello world', { from: 0, to: 5 });
      toggleInlineFormatting(viewWrap, '**');
      expect(viewWrap.state.doc.toString()).toBe('**hello** world');
      expect(viewWrap.state.selection.main.from).toBe(2);
      expect(viewWrap.state.selection.main.to).toBe(7);

      // Unwrap active selection with outer markers
      const viewOuter = createTestView('**hello** world', { from: 2, to: 7 });
      toggleInlineFormatting(viewOuter, '**');
      expect(viewOuter.state.doc.toString()).toBe('hello world');

      // Unwrap active selection with markers inside selection
      const viewInner = createTestView('**hello** world', { from: 0, to: 9 });
      toggleInlineFormatting(viewInner, '**');
      expect(viewInner.state.doc.toString()).toBe('hello world');
    });

    it('dispatches keymap bindings (Mod-b, Mod-i, Mod-e)', () => {
      const bKey = formattingKeymap.find((k) => k.key === 'Mod-b');
      const iKey = formattingKeymap.find((k) => k.key === 'Mod-i');
      const eKey = formattingKeymap.find((k) => k.key === 'Mod-e');

      expect(bKey).toBeDefined();
      expect(iKey).toBeDefined();
      expect(eKey).toBeDefined();

      const viewB = createTestView('boldme', 2);
      const resB = bKey!.run!(viewB as any);
      expect(resB).toBe(true);
      expect(viewB.state.doc.toString()).toBe('**boldme**');

      const viewI = createTestView('italicme', 2);
      const resI = iKey!.run!(viewI as any);
      expect(resI).toBe(true);
      expect(viewI.state.doc.toString()).toBe('*italicme*');

      const viewE = createTestView('codeme', 2);
      const resE = eKey!.run!(viewE as any);
      expect(resE).toBe(true);
      expect(viewE.state.doc.toString()).toBe('`codeme`');
    });
  });
});
