import { describe, it, expect, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { CompanionManager } from '../src/companion/companionManager';
import { __setConfigStore } from './__mocks__/vscode';

describe('CompanionManager Notes Root Resolution', () => {
  let companionManager: CompanionManager;
  const mockWorkspaceUri = vscode.Uri.file('/workspace/project');

  beforeEach(() => {
    companionManager = new CompanionManager();
    __setConfigStore({});
    (vscode.workspace as any).workspaceFolders = [
      { uri: mockWorkspaceUri, name: 'project', index: 0 },
    ];
  });

  it('defaults to workspace folder root when janus.notesRoot is empty or unset', () => {
    const root = companionManager.getNotesRootUri();
    expect(root).toBeDefined();
    expect(root?.fsPath).toBe('/workspace/project');
  });

  it('returns undefined if no workspace folders exist', () => {
    (vscode.workspace as any).workspaceFolders = undefined;
    const root = companionManager.getNotesRootUri();
    expect(root).toBeUndefined();
  });

  it('resolves configured relative notes root', () => {
    __setConfigStore({
      'janus.notesRoot': 'docs/notes',
    });

    const root = companionManager.getNotesRootUri();
    expect(root).toBeDefined();
    expect(root?.fsPath).toBe('/workspace/project/docs/notes');
  });

  it('strips leading ./ or / from configured notes root', () => {
    __setConfigStore({
      'janus.notesRoot': './docs/notes',
    });

    const root = companionManager.getNotesRootUri();
    expect(root?.fsPath).toBe('/workspace/project/docs/notes');
  });

  it('identifies if a file is under notes root', () => {
    __setConfigStore({
      'janus.notesRoot': 'notes',
    });

    const fileInside = vscode.Uri.file('/workspace/project/notes/meeting.md');
    const fileInsideSub = vscode.Uri.file('/workspace/project/notes/sub/meeting.md');
    const fileOutside = vscode.Uri.file('/workspace/project/src/index.ts');
    const fileInParent = vscode.Uri.file('/workspace/project/readme.md');

    expect(companionManager.isUnderNotesRoot(fileInside)).toBe(true);
    expect(companionManager.isUnderNotesRoot(fileInsideSub)).toBe(true);
    expect(companionManager.isUnderNotesRoot(fileOutside)).toBe(false);
    expect(companionManager.isUnderNotesRoot(fileInParent)).toBe(false);
  });

  it('resolves relative notes path against notes root', () => {
    __setConfigStore({
      'janus.notesRoot': 'notes',
    });

    const resolved = companionManager.resolveRelativeNotesPath('chapter1/intro.md');
    expect(resolved?.fsPath).toBe('/workspace/project/notes/chapter1/intro.md');

    const resolvedWithLeadingDot = companionManager.resolveRelativeNotesPath('./chapter1/intro.md');
    expect(resolvedWithLeadingDot?.fsPath).toBe('/workspace/project/notes/chapter1/intro.md');
  });
});

describe('Notes Root Commands', () => {
  const mockWorkspaceUri = vscode.Uri.file('/workspace/project');

  beforeEach(() => {
    __setConfigStore({});
    (vscode.workspace as any).workspaceFolders = [
      { uri: mockWorkspaceUri, name: 'project', index: 0 },
    ];
  });

  it('sets janus.notesRoot to relative path of chosen folder', async () => {
    const { setNotesRootCommand } = await import('../src/commands/notesRootCommands');
    const targetFolder = vscode.Uri.file('/workspace/project/docs/notes');

    await setNotesRootCommand(targetFolder);

    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBe('docs/notes');
  });

  it('sets janus.notesRoot to empty string when choosing workspace root folder', async () => {
    const { setNotesRootCommand } = await import('../src/commands/notesRootCommands');
    const targetFolder = vscode.Uri.file('/workspace/project');

    await setNotesRootCommand(targetFolder);

    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBe('');
  });

  it('rejects folder outside of workspace', async () => {
    const { setNotesRootCommand } = await import('../src/commands/notesRootCommands');
    const targetFolder = vscode.Uri.file('/another/directory');

    await setNotesRootCommand(targetFolder);

    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBeUndefined();
  });

  it('resets janus.notesRoot to empty string on reset command', async () => {
    __setConfigStore({
      'janus.notesRoot': 'docs/notes',
    });

    const { resetNotesRootCommand } = await import('../src/commands/notesRootCommands');
    await resetNotesRootCommand();

    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBe('');
  });

  it('prompts and creates subfolder "notes" when non-note files are found and user agrees', async () => {
    const { setNotesRootCommand } = await import('../src/commands/notesRootCommands');
    const targetFolder = vscode.Uri.file('/workspace/project');

    // Mock folder containing code files
    vscode.workspace.fs.readDirectory = async () => [
      ['package.json', vscode.FileType.File],
      ['tsconfig.json', vscode.FileType.File],
      ['README.md', vscode.FileType.File],
    ];

    let createdDirectoryUri: vscode.Uri | undefined;
    vscode.workspace.fs.createDirectory = async (uri: vscode.Uri) => {
      createdDirectoryUri = uri;
    };

    // User selects 'Neuen Ordner "notes" anlegen'
    (vscode.window as any).showInformationMessage = async () => 'Neuen Ordner "notes" anlegen';

    await setNotesRootCommand(targetFolder);

    expect(createdDirectoryUri?.fsPath).toBe('/workspace/project/notes');
    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBe('notes');
  });

  it('allows user to specify custom subfolder name when non-note files are found', async () => {
    const { setNotesRootCommand } = await import('../src/commands/notesRootCommands');
    const targetFolder = vscode.Uri.file('/workspace/project/docs');

    vscode.workspace.fs.readDirectory = async () => [
      ['index.html', vscode.FileType.File],
    ];

    let createdDirectoryUri: vscode.Uri | undefined;
    vscode.workspace.fs.createDirectory = async (uri: vscode.Uri) => {
      createdDirectoryUri = uri;
    };

    (vscode.window as any).showInformationMessage = async () => 'Anderen Namen wählen...';
    (vscode.window as any).showInputBox = async () => 'my-notes';

    await setNotesRootCommand(targetFolder);

    expect(createdDirectoryUri?.fsPath).toBe('/workspace/project/docs/my-notes');
    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBe('docs/my-notes');
  });

  it('uses target folder as-is when user chooses "Diesen Ordner trotzdem verwenden"', async () => {
    const { setNotesRootCommand } = await import('../src/commands/notesRootCommands');
    const targetFolder = vscode.Uri.file('/workspace/project/docs');

    vscode.workspace.fs.readDirectory = async () => [
      ['index.html', vscode.FileType.File],
    ];

    let created = false;
    vscode.workspace.fs.createDirectory = async () => {
      created = true;
    };

    (vscode.window as any).showInformationMessage = async () => 'Diesen Ordner trotzdem verwenden';

    await setNotesRootCommand(targetFolder);

    expect(created).toBe(false);
    const config = vscode.workspace.getConfiguration('janus');
    expect(config.get('notesRoot')).toBe('docs');
  });
});

