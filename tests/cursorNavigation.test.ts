import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { build } from 'esbuild';

// Cursor movement depends on real layout, which jsdom does not have. This test bundles the live
// preview and runs it in headless Chrome; it is skipped where Chrome is not installed.
const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const repoRoot = path.resolve(__dirname, '..');

const LINES = [
  '## Überschrift Zwei',
  '# Titel',
  '**Fett** am Anfang der Zeile',
  '*kursiv* vorne',
  '`code` vorne',
  '[[kickoff|Kickoff-Notiz]] als Link',
  '[[architektur]] als Link',
  '[Website](https://example.com) Link',
];

const ENTRY = `
import { EditorView, drawSelection } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { cursorLineUp, cursorLineDown } from '@codemirror/commands';
import { livePreview } from ${JSON.stringify(path.join(repoRoot, 'src/webviews/markdown/extensions/livePreview'))};

const lines = ${JSON.stringify(LINES)};
const results = [];
for (const mode of ['auto', 'hidden']) {
  for (const target of lines) {
    for (const dir of ['up', 'down']) {
      for (const col of [0, 3, 10]) {
        const doc = dir === 'up'
          ? 'Erste Zeile mit Text\\n' + target + '\\nZeile darunter mit genug Text zum Testen.'
          : 'Zeile darüber mit genug Text zum Testen.\\n' + target + '\\nLetzte Zeile';
        const host = document.createElement('div');
        document.body.appendChild(host);
        const view = new EditorView({
          parent: host,
          state: EditorState.create({ doc, extensions: [markdown(), livePreview(mode), drawSelection(), EditorView.lineWrapping] }),
        });
        view.dispatch({ selection: EditorSelection.cursor(view.state.doc.line(dir === 'up' ? 3 : 1).from + col) });
        (dir === 'up' ? cursorLineUp : cursorLineDown)(view);
        const line = view.state.doc.lineAt(view.state.selection.main.head).number;
        results.push({ mode, target, dir, col, line });
        view.destroy();
        host.remove();
      }
    }
  }
}
const out = document.createElement('pre');
out.id = 'results';
out.textContent = JSON.stringify(results);
document.body.appendChild(out);
`;

// Layout stability in auto mode: characters of the cursor line must not move while the cursor
// moves within the line.
const LAYOUT_LINE = 'Ein **fetter** Satz mit [[Link]] und `code` hier';

const LAYOUT_ENTRY = `
import { EditorView, drawSelection } from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { cursorCharLeft, cursorCharRight } from '@codemirror/commands';
import { livePreview } from ${JSON.stringify(path.join(repoRoot, 'src/webviews/markdown/extensions/livePreview'))};

function makeView(doc) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return new EditorView({
    parent: host,
    state: EditorState.create({ doc, extensions: [markdown(), livePreview('auto'), drawSelection(), EditorView.lineWrapping] }),
  });
}

const results = { steps: [] };

{
  const view = makeView('Erste Zeile\\n' + ${JSON.stringify(LAYOUT_LINE)} + '\\nLetzte Zeile');
  const line = view.state.doc.line(2);
  const probe = line.to - 1;
  const x = () => Math.round(view.coordsAtPos(probe, 1).left);
  view.dispatch({ selection: EditorSelection.cursor(line.to) });
  const x0 = x();
  for (const [cmd, name] of [[cursorCharLeft, 'left'], [cursorCharRight, 'right']]) {
    for (let i = 0; i < line.length; i++) {
      const before = view.state.selection.main.head;
      cmd(view);
      const after = view.state.selection.main.head;
      results.steps.push({ dir: name, before, after, dx: x() - x0 });
    }
  }
  view.destroy();
}

const out = document.createElement('pre');
out.id = 'results';
out.textContent = JSON.stringify(results);
document.body.appendChild(out);
`;

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, sans-serif; font-size: 14px; width: 700px; }
.cm-editor .cm-scroller, .cm-editor .cm-line { line-height: 1.65; }
</style></head><body><script src="bundle.js"></script></body></html>`;

interface MoveResult {
  mode: string;
  target: string;
  dir: string;
  col: number;
  line: number;
}

function runBundle<T = MoveResult[]>(dir: string): T {
  const html = execFileSync(
    chromeBin,
    ['--headless=new', '--disable-gpu', '--virtual-time-budget=5000', '--dump-dom', `file://${path.join(dir, 'index.html')}`],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }
  );
  const match = html.match(/<pre id="results">([\s\S]*?)<\/pre>/);
  if (!match) throw new Error('Chrome did not produce results');
  const json = match[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return JSON.parse(json);
}

/** Bundles `entry` next to the test page, runs it in headless Chrome and returns its results. */
async function runInChrome<T>(entry: string): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'janus-cursor-'));
  try {
    fs.writeFileSync(path.join(dir, 'entry.ts'), entry);
    fs.writeFileSync(path.join(dir, 'index.html'), HTML);
    await build({
      entryPoints: [path.join(dir, 'entry.ts')],
      bundle: true,
      format: 'iife',
      outfile: path.join(dir, 'bundle.js'),
      nodePaths: [path.join(repoRoot, 'node_modules')],
      logLevel: 'silent',
    });
    return runBundle<T>(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

interface LayoutResult {
  steps: { dir: string; before: number; after: number; dx: number }[];
}

describe.skipIf(!fs.existsSync(chromeBin))('cursor movement over hidden syntax (headless Chrome)', () => {
  it('ArrowUp and ArrowDown reach lines that start with hidden syntax', async () => {
    const results = await runInChrome<MoveResult[]>(ENTRY);
    expect(results.length).toBe(2 * LINES.length * 2 * 3);
    const wrong = results.filter((r) => r.line !== 2).map((r) => `${r.mode} ${r.dir} col ${r.col}: ${r.target}`);
    expect(wrong).toEqual([]);
  }, 60000);

  it('keeps the layout of the cursor line stable in auto mode', async () => {
    const { steps } = await runInChrome<LayoutResult>(LAYOUT_ENTRY);
    expect(steps.length).toBe(2 * LAYOUT_LINE.length);
    // Every arrow press moves by exactly one character.
    const jumps = steps.filter((s) => Math.abs(s.after - s.before) !== 1).map((s) => `${s.dir} ${s.before} -> ${s.after}`);
    expect(jumps).toEqual([]);
    // No character of the line moves horizontally while the cursor stays on it.
    const shifts = steps.filter((s) => s.dx !== 0).map((s) => `${s.dir} at ${s.after}: dx ${s.dx}`);
    expect(shifts).toEqual([]);
  }, 60000);
});
