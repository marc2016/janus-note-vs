import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { buildTagIndex, expandTags } from '../src/services/noteTagService';

const entry = (name: string, inlineTags: string[], tags: string[] = []) => ({
  uri: vscode.Uri.file(`/notes/${name}.md`),
  metadata: { aliases: [], tags, inlineTags },
});
const names = (uris: vscode.Uri[]) => uris.map((u) => u.fsPath.replace('/notes/', '').replace('.md', ''));

describe('note tag index', () => {
  it('combines frontmatter and inline tags', () => {
    const index = buildTagIndex([entry('plan', ['Budget'], ['backend'])]);
    expect([...index.tags.values()].map((t) => t.display).sort()).toEqual(['Budget', 'backend']);
    expect(index.tagsOf(vscode.Uri.file('/notes/plan.md')).sort()).toEqual(['backend', 'budget']);
  });

  it('compares tags case-insensitively and displays the most frequent spelling', () => {
    const index = buildTagIndex([entry('a', ['Backend']), entry('b', ['backend']), entry('c', ['backend'])]);
    expect(index.tags.size).toBe(1);
    expect(index.tags.get('backend')!.display).toBe('backend');
    expect(names(index.notesWithTag('BACKEND'))).toEqual(['a', 'b', 'c']);
  });

  it('uses the alphabetically first spelling on a tie', () => {
    const index = buildTagIndex([entry('a', ['Backend']), entry('b', ['backend'])]);
    expect(index.tags.get('backend')!.display).toBe('backend');
  });

  it('counts a nested tag for its parent', () => {
    const index = buildTagIndex([entry('alpha', ['projekt/alpha']), entry('beta', ['projektplan'])]);
    expect(names(index.notesWithTag('projekt'))).toEqual(['alpha']);
    expect(names(index.notesWithTag('#projekt/alpha'))).toEqual(['alpha']);
    expect(index.tags.has('projekt')).toBe(false);
    expect(expandTags(['Projekt/Alpha/X'])).toEqual(['projekt', 'projekt/alpha', 'projekt/alpha/x']);
  });
});
