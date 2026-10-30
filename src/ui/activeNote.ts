import * as vscode from 'vscode';

/** Janus webviews that stand for a pseudo note in the sidebar selection (view type -> URI). */
const WEBVIEW_PSEUDO_URIS: Record<string, string> = {
  'janus.calendarView': 'janus-calendar:///all',
  'janus.globalTasksView': 'janus-tasks:///all',
  'janus.noteGraph': 'janus-graph:///all',
};

/**
 * The URI of the active editor tab: the file of a text or custom editor, a pseudo URI for the
 * Janus calendar, tasks and graph views, or the active text editor's document.
 */
export function getActiveNoteUri(): vscode.Uri | undefined {
  const tabGroups = vscode.window.tabGroups;
  const activeTab = tabGroups?.activeTabGroup?.activeTab;
  if (activeTab?.input) {
    const input: any = activeTab.input;

    if (input instanceof vscode.TabInputWebview || (input && typeof input.viewType === 'string')) {
      const pseudo = WEBVIEW_PSEUDO_URIS[input.viewType];
      if (pseudo) {
        return vscode.Uri.parse(pseudo);
      }
    }

    if (input instanceof vscode.TabInputText && input.uri) {
      return input.uri;
    }
    if (input instanceof vscode.TabInputCustom && input.uri) {
      return input.uri;
    }
    if (input && typeof input === 'object' && input.uri instanceof vscode.Uri) {
      return input.uri;
    }
  }

  return vscode.window.activeTextEditor?.document?.uri;
}
