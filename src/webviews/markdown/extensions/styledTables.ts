import { Extension } from '@codemirror/state';
import { historyKeymap } from '@codemirror/commands';
import {
  markdownTables,
  TableTheme,
  TableStyle,
  insertEmptyMarkdownTable,
  markdownTableAutocompleter,
} from 'codemirror-markdown-tables';

export { insertEmptyMarkdownTable, markdownTableAutocompleter };

/**
 * Enhanced Table Extension using codemirror-markdown-tables.
 * Converts GFM Markdown tables into interactive, rich HTML table components
 * with row/column manipulation, drag handles, alignment controls, and in-cell editing.
 */
export function styledTables(): Extension {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }

  return markdownTables({
    theme: {
      light: TableTheme.githubLight.with({
        '--tbl-theme-row-background': 'var(--vscode-editor-background, #ffffff)',
        '--tbl-theme-header-row-background': 'var(--vscode-editor-inactiveSelectionBackground, #f6f8fa)',
        '--tbl-theme-even-row-background': 'var(--vscode-editor-background, #ffffff)',
        '--tbl-theme-odd-row-background': 'rgba(0, 0, 0, 0.02)',
        '--tbl-theme-border-color': 'var(--vscode-editorWidget-border, #d1d9e0)',
        '--tbl-theme-text-color': 'var(--vscode-editor-foreground, inherit)',
        '--tbl-theme-outline-color': 'var(--vscode-focusBorder, #007acc)',
        '--tbl-theme-menu-background': 'var(--vscode-menu-background, #ffffff)',
        '--tbl-theme-menu-border-color': 'var(--vscode-menu-border, #d1d9e0)',
        '--tbl-theme-menu-text-color': 'var(--vscode-menu-foreground, #000000)',
        '--tbl-theme-menu-hover-background': 'var(--vscode-menu-selectionBackground, #007acc)',
        '--tbl-theme-menu-hover-text-color': 'var(--vscode-menu-selectionForeground, #ffffff)',
      }),
      dark: TableTheme.githubDark.with({
        '--tbl-theme-row-background': 'var(--vscode-editor-background, #1e1e1e)',
        '--tbl-theme-header-row-background': 'rgba(255, 255, 255, 0.08)',
        '--tbl-theme-even-row-background': 'var(--vscode-editor-background, #1e1e1e)',
        '--tbl-theme-odd-row-background': 'rgba(255, 255, 255, 0.025)',
        '--tbl-theme-border-color': 'var(--vscode-editorWidget-border, #3d444d)',
        '--tbl-theme-text-color': 'var(--vscode-editor-foreground, inherit)',
        '--tbl-theme-outline-color': 'var(--vscode-focusBorder, #007acc)',
        '--tbl-theme-menu-background': 'var(--vscode-menu-background, #252526)',
        '--tbl-theme-menu-border-color': 'var(--vscode-menu-border, #454545)',
        '--tbl-theme-menu-text-color': 'var(--vscode-menu-foreground, #cccccc)',
        '--tbl-theme-menu-hover-background': 'var(--vscode-menu-selectionBackground, #007acc)',
        '--tbl-theme-menu-hover-text-color': 'var(--vscode-menu-selectionForeground, #ffffff)',
      }),
    },
    style: TableStyle.default.with({
      '--tbl-style-font-family': 'inherit',
      '--tbl-style-font-size': 'inherit',
      '--tbl-style-menu-font-family': 'inherit',
    }),
    globalKeyBindings: [...historyKeymap],
  });
}
