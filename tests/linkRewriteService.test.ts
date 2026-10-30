import { describe, it, expect } from 'vitest';
import {
  NoteSource,
  RenameOperation,
  applyRewritesToText,
  buildRenamePlan,
  computeRewrittenPath,
  mapRenamedPath,
} from '../src/services/linkRewriteService';

const ROOT = '/ws/notes';
const WS = '/ws';
const env = {
  primaryRoot: ROOT,
  roots: [ROOT],
  workspaceFolderOf: (p: string) => (p.startsWith(`${WS}/`) ? WS : undefined),
};

/** Notes in scan order: per directory sorted by name, depth-first. */
function notes(files: Record<string, string>): NoteSource[] {
  return Object.keys(files)
    .sort((a, b) => {
      const sa = a.split('/');
      const sb = b.split('/');
      for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
        const cmp = sa[i].localeCompare(sb[i]);
        if (cmp !== 0) return cmp;
      }
      return sa.length - sb.length;
    })
    .map((rel) => ({ fsPath: `${ROOT}/${rel}`, text: files[rel] }));
}

const renameNote = (from: string, to: string): RenameOperation => ({
  oldPath: `${ROOT}/${from}`,
  newPath: `${ROOT}/${to}`,
  isFolder: false,
});
const renameFolder = (from: string, to: string): RenameOperation => ({
  oldPath: `${ROOT}/${from}`,
  newPath: `${ROOT}/${to}`,
  isFolder: true,
});

/** Runs the plan and returns the rewritten text of every note, keyed by its path after the rename. */
function rename(files: Record<string, string>, op: RenameOperation) {
  const sources = notes(files);
  const plan = buildRenamePlan(sources, op, env);
  const texts: Record<string, string> = {};
  for (const source of sources) {
    const newPath = mapRenamedPath(source.fsPath, op);
    const file = plan.files.find((f) => f.oldFsPath === source.fsPath);
    texts[newPath.slice(ROOT.length + 1)] = file ? applyRewritesToText(source.text, file.rewrites).text : source.text;
  }
  return { plan, texts };
}

describe('computeRewrittenPath', () => {
  const ctx = {
    newSourceFsPath: `${ROOT}/projects/alpha/plan.md`,
    newTargetFsPath: `${ROOT}/meetings/start.md`,
    isFolderRename: false,
    primaryRoot: ROOT,
    workspaceFolder: WS,
  };

  it('replaces the basename of name-only links and keeps the extension style', () => {
    expect(computeRewrittenPath('kickoff', 'basename', ctx)).toBe('start');
    expect(computeRewrittenPath('kickoff.md', 'basename', ctx)).toBe('start.md');
  });

  it('keeps name-only links on folder renames', () => {
    expect(computeRewrittenPath('plan', 'basename', { ...ctx, isFolderRename: true })).toBe('plan');
  });

  it('recomputes source-relative paths from the new source location', () => {
    expect(computeRewrittenPath('../../meetings/kickoff.md', 'source', ctx)).toBe('../../meetings/start.md');
    expect(
      computeRewrittenPath('./kickoff.md', 'source', {
        ...ctx,
        newSourceFsPath: `${ROOT}/meetings/index.md`,
      })
    ).toBe('./start.md');
  });

  it('recomputes root- and workspace-relative paths', () => {
    expect(computeRewrittenPath('meetings/kickoff', 'root', ctx)).toBe('meetings/start');
    expect(computeRewrittenPath('notes/meetings/kickoff.md', 'workspace', ctx)).toBe('notes/meetings/start.md');
  });

  it('keeps the original basename spelling when only folders change', () => {
    expect(
      computeRewrittenPath('projects/alpha/Plan', 'root', {
        ...ctx,
        newTargetFsPath: `${ROOT}/projects/apollo/plan.md`,
        isFolderRename: true,
      })
    ).toBe('projects/apollo/Plan');
  });

  it('returns undefined when the base directory is unknown', () => {
    expect(computeRewrittenPath('x/kickoff', 'root', { ...ctx, primaryRoot: undefined })).toBeUndefined();
  });
});

describe('buildRenamePlan for note renames', () => {
  it('rewrites a wiki-link to a renamed note', () => {
    const { texts } = rename(
      { 'meetings/kickoff.md': '# Kickoff', 'projects/plan.md': 'Siehe [[kickoff]].' },
      renameNote('meetings/kickoff.md', 'meetings/kickoff-2026.md')
    );
    expect(texts['projects/plan.md']).toBe('Siehe [[kickoff-2026]].');
  });

  it('rewrites a relative Markdown link', () => {
    const { texts } = rename(
      { 'meetings/kickoff.md': '', 'projects/alpha/plan.md': '[Kickoff](../../meetings/kickoff.md)' },
      renameNote('meetings/kickoff.md', 'meetings/start.md')
    );
    expect(texts['projects/alpha/plan.md']).toBe('[Kickoff](../../meetings/start.md)');
  });

  it('preserves alias, suffixes, extension style, ./ prefix and labels', () => {
    const { texts } = rename(
      {
        'meetings/kickoff.md': '',
        'meetings/index.md':
          '[[kickoff|Erstes Treffen]] [[kickoff#L12]] [[kickoff.md]] [Notes](./kickoff.md#agenda) [Kickoff-Notizen](kickoff.md)',
      },
      renameNote('meetings/kickoff.md', 'meetings/start.md')
    );
    expect(texts['meetings/index.md']).toBe(
      '[[start|Erstes Treffen]] [[start#L12]] [[start.md]] [Notes](./start.md#agenda) [Kickoff-Notizen](start.md)'
    );
  });

  it('does not touch links in code', () => {
    const { texts } = rename(
      { 'kickoff.md': '', 'index.md': '[[kickoff]]\n```\n[[kickoff]]\n```\n`[[kickoff]]`' },
      renameNote('kickoff.md', 'start.md')
    );
    expect(texts['index.md']).toBe('[[start]]\n```\n[[kickoff]]\n```\n`[[kickoff]]`');
  });

  it('leaves links to an unrelated note with the same name unchanged', () => {
    const { plan } = rename(
      { 'projects/a/index.md': '[Notes](notes.md)', 'projects/a/notes.md': '', 'projects/b/notes.md': '' },
      renameNote('projects/b/notes.md', 'projects/b/log.md')
    );
    expect(plan.files).toEqual([]);
  });

  it('leaves already broken links unchanged', () => {
    const { plan } = rename({ 'kickoff.md': '', 'index.md': '[[kickof]]' }, renameNote('kickoff.md', 'start.md'));
    expect(plan.files).toEqual([]);
    expect(plan.skipped).toBe(0);
  });

  it('rewrites links inside the renamed note and maps the file to its new path', () => {
    const { plan, texts } = rename({ 'kickoff.md': 'Oben: [[kickoff#L3]]' }, renameNote('kickoff.md', 'start.md'));
    expect(plan.files[0].newFsPath).toBe(`${ROOT}/start.md`);
    expect(texts['start.md']).toBe('Oben: [[start#L3]]');
  });
});

describe('buildRenamePlan for folder renames', () => {
  it('rewrites path links into the renamed folder', () => {
    const { texts } = rename(
      {
        'index.md': '[[projects/alpha/plan]] [Spec](projects/alpha/spec.md)',
        'projects/alpha/plan.md': '',
        'projects/alpha/spec.md': '',
      },
      renameFolder('projects/alpha', 'projects/apollo')
    );
    expect(texts['index.md']).toBe('[[projects/apollo/plan]] [Spec](projects/apollo/spec.md)');
  });

  it('keeps name-only links and relative links inside the folder', () => {
    const { plan } = rename(
      {
        'index.md': '[[plan]]',
        'projects/alpha/plan.md': '[Spec](spec.md) [[spec]]',
        'projects/alpha/spec.md': '',
      },
      renameFolder('projects/alpha', 'projects/apollo')
    );
    expect(plan.files).toEqual([]);
  });

  it('maps notes inside the folder to their new paths', () => {
    const { plan } = rename(
      { 'projects/alpha/plan.md': '[[projects/alpha/spec]]', 'projects/alpha/spec.md': '' },
      renameFolder('projects/alpha', 'projects/apollo')
    );
    expect(plan.files.map((f) => [f.newFsPath, [...f.rewrites]])).toEqual([
      [`${ROOT}/projects/apollo/plan.md`, [['projects/alpha/spec', 'projects/apollo/spec']]],
    ]);
  });
});

describe('buildRenamePlan verification', () => {
  it('falls back to a path form when the new name would resolve to another note', () => {
    const { texts } = rename(
      { 'index.md': '[[draft]]', 'knowledge/plan.md': '', 'projects/draft.md': '' },
      renameNote('projects/draft.md', 'projects/plan.md')
    );
    expect(texts['index.md']).toBe('[[projects/plan]]');
  });

  it('counts links that cannot be made to resolve as skipped', () => {
    // A note outside every root cannot be reached by a root- or workspace-relative fallback
    const sources = [
      { fsPath: '/other/a.md', text: '[[draft]]' },
      { fsPath: '/other/b/plan.md', text: '' },
      { fsPath: '/other/c/draft.md', text: '' },
    ];
    const plan = buildRenamePlan(
      sources,
      { oldPath: '/other/c/draft.md', newPath: '/other/c/plan.md', isFolder: false },
      { ...env, roots: ['/other'] }
    );
    expect(plan.files).toEqual([]);
    expect(plan.skipped).toBe(1);
  });
});

describe('folder links on rename', () => {
  it('rewrites a folder link when the folder is renamed', () => {
    const { texts } = rename(
      {
        'plan.md': 'Siehe [[projects/App-Launch/]] und [Ordner](projects/App-Launch)',
        'projects/App-Launch/app.md': '# App',
      },
      renameFolder('projects/App-Launch', 'projects/Mobile-App')
    );
    expect(texts['plan.md']).toBe('Siehe [[projects/Mobile-App/]] und [Ordner](projects/Mobile-App)');
  });

  it('rewrites links into a subfolder when a parent folder moves', () => {
    const { texts } = rename(
      {
        'plan.md': '[[projects/App-Launch/specs/]]',
        'projects/App-Launch/specs/api.md': '# API',
      },
      renameFolder('projects', 'archiv/projects')
    );
    expect(texts['plan.md']).toBe('[[archiv/projects/App-Launch/specs/]]');
  });

  it('keeps note links and links to other folders unchanged', () => {
    const { texts } = rename(
      {
        'plan.md': '[[knowledge/]] [[projects/App-Launch/app]]',
        'knowledge/ki.md': '# KI',
        'projects/App-Launch/app.md': '# App',
      },
      renameFolder('projects/App-Launch', 'projects/Mobile-App')
    );
    expect(texts['plan.md']).toBe('[[knowledge/]] [[projects/Mobile-App/app]]');
  });

  it('rewrites a link to an empty renamed folder', () => {
    const { texts } = rename({ 'plan.md': '[[projects/Leer/]]' }, renameFolder('projects/Leer', 'projects/Neu'));
    expect(texts['plan.md']).toBe('[[projects/Neu/]]');
  });
});
