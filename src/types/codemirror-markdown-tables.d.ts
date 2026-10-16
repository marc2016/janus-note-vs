declare module 'codemirror-markdown-tables' {
  import type { Extension, StateCommand } from '@codemirror/state';
  import type { CompletionSource } from '@codemirror/autocomplete';
  import type { KeyBinding } from '@codemirror/view';

  export interface TableThemeProps {
    '--tbl-theme-row-background'?: string;
    '--tbl-theme-header-row-background'?: string;
    '--tbl-theme-even-row-background'?: string;
    '--tbl-theme-odd-row-background'?: string;
    '--tbl-theme-border-color'?: string;
    '--tbl-theme-border-hover-color'?: string;
    '--tbl-theme-border-active-color'?: string;
    '--tbl-theme-outline-color'?: string;
    '--tbl-theme-text-color'?: string;
    '--tbl-theme-menu-border-color'?: string;
    '--tbl-theme-menu-background'?: string;
    '--tbl-theme-menu-hover-background'?: string;
    '--tbl-theme-menu-text-color'?: string;
    '--tbl-theme-menu-hover-text-color'?: string;
    '--tbl-theme-select-all-focus-overlay'?: string;
    '--tbl-theme-select-all-blur-overlay'?: string;
    [key: string]: string | undefined;
  }

  export class TableTheme {
    static readonly light: TableTheme;
    static readonly dark: TableTheme;
    static readonly githubLight: TableTheme;
    static readonly githubDark: TableTheme;
    static readonly githubSoftDark: TableTheme;
    static readonly oneDark: TableTheme;
    readonly props: Record<string, string>;
    with(props?: TableThemeProps): TableTheme;
  }

  export interface TableStyleProps {
    '--tbl-style-font-family'?: string;
    '--tbl-style-font-size'?: string;
    '--tbl-style-menu-font-family'?: string;
    '--tbl-style-menu-font-size'?: string;
    '--tbl-style-default-header-alignment'?: string;
    [key: string]: string | undefined;
  }

  export class TableStyle {
    static readonly default: TableStyle;
    readonly props: Record<string, string>;
    with(props?: TableStyleProps): TableStyle;
  }

  export interface MarkdownTablesConfig {
    readonly theme?: TableTheme | { readonly light: TableTheme; readonly dark: TableTheme };
    readonly style?: TableStyle;
    readonly selectionType?: 'codemirror' | 'native';
    readonly handlePosition?: 'outside' | 'inside';
    readonly lineWrapping?: 'wrap' | 'nowrap';
    readonly extensions?: readonly Extension[];
    readonly globalKeyBindings?: readonly KeyBinding[];
  }

  export function markdownTables(config?: MarkdownTablesConfig): Extension;
  export function insertEmptyMarkdownTable(config?: { size?: { rows: number; cols: number } }): StateCommand;
  export function markdownTableAutocompleter(config?: any): CompletionSource;
}
