import * as vscode from 'vscode';
import * as path from 'path';
import { parseFrontmatter } from './noteMetadataService';
import { findSortedLinks } from './sortedLinkScan';

/** Display data for a `-> [[target]]` line, sent to the editor webview. */
export interface SortedLinkInfo {
  /** Link target as written in the daily note. */
  target: string;
  title: string;
  /** Folder of the target, e.g. `projects / App-Launch`. */
  folder: string;
  exists: boolean;
  /** 1-based line of the copied section in the target note, if found. */
  line?: number;
}

function titleOf(text: string, fallback: string): string {
  const frontmatter = parseFrontmatter(text);
  if (frontmatter.title) return frontmatter.title;
  const heading = text.slice(frontmatter.bodyStart).match(/^#\s+(.+?)\s*$/m);
  return heading ? heading[1] : fallback;
}

/**
 * Resolves the link lines of a daily note: title, folder and existence of each target, and the
 * line of the section copied from the link's block (`## <heading> (<date>`, else the anchor text).
 */
export async function resolveSortedLinks(
  text: string,
  notesRoot: vscode.Uri,
  date: string
): Promise<SortedLinkInfo[]> {
  const infos: SortedLinkInfo[] = [];
  for (const link of findSortedLinks(text)) {
    const relPath = /\.(md|markdown)$/i.test(link.target) ? link.target : `${link.target}.md`;
    const baseName = path.posix.basename(relPath).replace(/\.(md|markdown)$/i, '');
    const dir = path.posix.dirname(relPath);
    const info: SortedLinkInfo = {
      target: link.target,
      title: baseName,
      folder: dir === '.' ? '' : dir.split('/').join(' / '),
      exists: false,
    };

    try {
      const targetText = Buffer.from(
        await vscode.workspace.fs.readFile(vscode.Uri.joinPath(notesRoot, ...relPath.split('/')))
      ).toString('utf8');
      info.exists = true;
      info.title = titleOf(targetText, baseName);

      const lines = targetText.replace(/\r\n/g, '\n').split('\n');
      const sectionPrefix = link.heading ? `## ${link.heading} (${date}` : undefined;
      let idx = sectionPrefix ? lines.findIndex((l) => l.startsWith(sectionPrefix)) : -1;
      if (idx === -1 && link.anchorText) {
        idx = lines.findIndex((l) => l.trim() === link.anchorText);
      }
      if (idx !== -1) info.line = idx + 1;
    } catch {
      // Missing target: keep the defaults
    }
    infos.push(info);
  }
  return infos;
}
