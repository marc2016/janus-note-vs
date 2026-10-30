import { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { frontmatterEnd } from '../../../services/markdownScan';

export interface TagCandidate {
  /** Display spelling without `#`. */
  tag: string;
  /** Number of notes carrying the tag. */
  count: number;
}

const CODE_NODES = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'CodeText']);

function isInCode(context: CompletionContext): boolean {
  for (let node: any = syntaxTree(context.state).resolveInner(context.pos, -1); node; node = node.parent) {
    if (CODE_NODES.has(node.name)) return true;
  }
  return false;
}

/**
 * Suggests existing tags as soon as `#` is typed at a line start or after whitespace; a space
 * (heading) or a second `#` closes the list. Not offered in code or the frontmatter block.
 */
export function createTagAutocompleteSource(getTags: () => TagCandidate[]) {
  return function tagAutocompleteSource(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/(?<!\S)#[\p{L}\p{N}_/-]*$/u);
    if (!match) return null;
    const tags = getTags();
    if (tags.length === 0) return null;
    if (match.from < frontmatterEnd(context.state.doc.toString()) || isInCode(context)) return null;

    const typed = match.text.slice(1).toLowerCase();
    const options: Completion[] = tags
      .filter((t) => t.tag.toLowerCase() !== typed)
      .map((t, i) => ({
        label: `#${t.tag}`,
        detail: t.count === 1 ? '1 Notiz' : `${t.count} Notizen`,
        type: 'tag',
        // Most used tags first among equally good matches
        boost: Math.max(-99, -i),
      }));

    return { from: match.from, to: match.to, options, filter: true, validFor: /^#[\p{L}\p{N}_/-]*$/u };
  };
}
