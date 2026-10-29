export class Uri {
  constructor(public readonly scheme: string, public readonly authority: string, public readonly path: string, public readonly query: string = '', public readonly fragment: string = '') {}

  get fsPath(): string {
    return this.path;
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }

  static file(path: string): Uri {
    return new Uri('file', '', path);
  }

  static parse(str: string): Uri {
    try {
      const u = new URL(str);
      const scheme = u.protocol.replace(/:$/, '');
      if (scheme === 'mailto') {
        return new Uri(scheme, '', u.pathname);
      }
      return new Uri(scheme, u.host, u.pathname);
    } catch {
      const parts = str.split('://');
      const scheme = parts[0] || 'file';
      const path = parts[1] || '';
      return new Uri(scheme, '', path);
    }
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.path, ...pathSegments].join('/').replace(/\/+/g, '/');
    return new Uri(base.scheme, base.authority, joined);
  }
}

export class Position {
  constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
  public start: Position;
  public end: Position;
  constructor(startLineOrPos: any, startColOrEndPos?: any, endLine?: any, endCol?: any) {
    if (typeof startLineOrPos === 'number') {
      this.start = new Position(startLineOrPos, startColOrEndPos ?? 0);
      this.end = new Position(endLine ?? startLineOrPos, endCol ?? startColOrEndPos ?? 0);
    } else {
      this.start = startLineOrPos;
      this.end = startColOrEndPos ?? startLineOrPos;
    }
  }
  get startLine(): any { return this.start?.line; }
  get startCol(): any { return this.start?.character; }
  get endLine(): any { return this.end?.line; }
  get endCol(): any { return this.end?.character; }
}

export class CodeLens {
  constructor(public range: Range, public command?: any) {}
}

export class LanguageModelTextPart {
  constructor(public value: string) {}
}

export class LanguageModelToolCallPart {
  constructor(
    public callId: string,
    public name: string,
    public input: Record<string, any>
  ) {}
}

export class LanguageModelToolResultPart {
  constructor(
    public callId: string,
    public content: any[]
  ) {}
}

export class LanguageModelToolResult {
  constructor(public content: any[]) {}
}

export class EventEmitter<T = any> {
  private listeners: ((e: T) => any)[] = [];
  fire(data?: T) {
    for (const listener of this.listeners) {
      listener(data as T);
    }
  }
  event = (listener: (e: T) => any) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const idx = this.listeners.indexOf(listener);
        if (idx !== -1) this.listeners.splice(idx, 1);
      },
    };
  };
  dispose() {
    this.listeners = [];
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

let _configStore: Record<string, any> = {};

export function __setConfigStore(store: Record<string, any>) {
  _configStore = { ...store };
}

export function __getConfigStore() {
  return _configStore;
}

export enum QuickPickItemKind {
  Separator = -1,
  Default = 0,
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export const workspace = {
  workspaceFolders: undefined as any[] | undefined,
  getWorkspaceFolder: (uri: Uri) => {
    if (!workspace.workspaceFolders) return undefined;
    return workspace.workspaceFolders.find(wf => uri.fsPath.startsWith(wf.uri.fsPath));
  },
  getConfiguration: (section?: string, _scope?: any) => ({
    get: <T>(key: string, defaultValue?: T): T => {
      const fullKey = section ? `${section}.${key}` : key;
      if (fullKey in _configStore) {
        return _configStore[fullKey];
      }
      if (section && section in _configStore && typeof _configStore[section] === 'object' && key in _configStore[section]) {
        return _configStore[section][key];
      }
      return defaultValue as T;
    },
    update: async (key: string, value: any, _target?: ConfigurationTarget) => {
      const fullKey = section ? `${section}.${key}` : key;
      _configStore[fullKey] = value;
    },
    has: (key: string) => {
      const fullKey = section ? `${section}.${key}` : key;
      return fullKey in _configStore;
    },
    inspect: (_key: string) => undefined,
  }),
  onDidChangeConfiguration: (_listener: (e: { affectsConfiguration: (section: string) => boolean }) => any) => ({
    dispose: () => {},
  }),
  fs: {
    stat: async () => {},
    readFile: async () => Buffer.from('{}'),
    writeFile: async () => {},
    readDirectory: async (_uri: Uri): Promise<[string, FileType][]> => [],
    createDirectory: async (_uri: Uri): Promise<void> => {},
    delete: async (_uri: Uri, _options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> => {},
    rename: async (_source: Uri, _target: Uri, _options?: { overwrite?: boolean }): Promise<void> => {},
  },
  createFileSystemWatcher: () => ({
    onDidCreate: () => ({ dispose: () => {} }),
    onDidChange: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
  textDocuments: [] as any[],
  applyEdit: async (_edit?: any) => true,
  registerTextDocumentContentProvider: () => ({ dispose: () => {} }),
  openTextDocument: async (uri: Uri) => ({ uri }),
};

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class ThemeIcon {
  constructor(public readonly id: string, public readonly color?: any) {}
}

export class TreeItem {
  public resourceUri?: Uri;
  public contextValue?: string;
  public iconPath?: any;
  public tooltip?: string;
  public command?: any;
  public description?: string;

  constructor(
    public label: string | any,
    public collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {}
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export class TabInputText {
  constructor(public readonly uri: Uri) {}
}

export class TabInputCustom {
  constructor(public readonly uri: Uri, public readonly viewType: string) {}
}

export class TabInputWebview {
  constructor(public readonly viewType: string) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

export const window = {
  activeTextEditor: undefined as any,
  tabGroups: {
    activeTabGroup: undefined as any,
    onDidChangeTabs: (_listener: () => any) => ({ dispose: () => {} }),
  },
  onDidChangeActiveTextEditor: (_listener: (e: any) => any) => ({ dispose: () => {} }),
  onDidChangeTextEditorSelection: (_listener: (e: any) => any) => ({ dispose: () => {} }),
  createTextEditorDecorationType: (_options: any) => ({ dispose: () => {} }),
  showInformationMessage: async (..._args: any[]): Promise<any> => undefined,
  showWarningMessage: async (..._args: any[]): Promise<any> => undefined,
  showErrorMessage: async (..._args: any[]): Promise<any> => undefined,
  showOpenDialog: async () => undefined,
  showInputBox: async (_options?: any): Promise<string | undefined> => undefined,
  showQuickPick: async (_items?: any, _options?: any): Promise<any> => undefined,
  registerCustomEditorProvider: () => ({ dispose: () => {} }),
  registerTreeDataProvider: () => ({ dispose: () => {} }),
  createTreeView: (_viewId?: string, options?: any) => ({
    selection: [] as any[],
    options,
    dispose: () => {},
    reveal: async () => {},
    onDidChangeSelection: (_listener: any) => ({ dispose: () => {} }),
  }),
  createWebviewPanel: (_viewType: string, title: string, _showOptions: any, _options?: any) => ({
    title,
    webview: {
      html: '',
      options: {},
      asWebviewUri: (uri: Uri) => uri,
      postMessage: async (_msg: any) => true,
      onDidReceiveMessage: (_listener: (msg: any) => any) => ({ dispose: () => {} }),
    },
    reveal: () => {},
    onDidChangeViewState: (_listener: (e: any) => any) => ({ dispose: () => {} }),
    onDidDispose: (_listener: () => any) => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  showTextDocument: async (doc: any) => ({ document: doc }),
};

export const languages = {
  registerCodeLensProvider: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: async () => undefined,
};

export const lm = {
  tools: [] as any[],
  registerTool: (_name: string, _tool: any) => ({ dispose: () => {} }),
  invokeTool: async (_name: string, _options: any, _token?: any): Promise<LanguageModelToolResult> =>
    new LanguageModelToolResult([]),
  selectChatModels: async (_selector?: any): Promise<any[]> => [],
};

export const chat = {
  createChatParticipant: (_id: string, _handler: any) => ({
    iconPath: undefined,
    dispose: () => {},
  }),
};

export class LanguageModelChatMessage {
  static User(content: string | any[]) {
    return { role: 'user', content };
  }
  static Assistant(content: string | any[]) {
    return { role: 'assistant', content };
  }
}

export class CancellationTokenSource {
  token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };
  cancel() {
    this.token.isCancellationRequested = true;
  }
  dispose() {}
}

export class WorkspaceEdit {
  entries: Array<{ uri: Uri; range: Range; newText: string }> = [];
  replace(uri: Uri, range: Range, newText: string) {
    this.entries.push({ uri, range, newText });
  }
}

export const env = {
  language: 'de',
  openExternal: async (_uri: any) => true,
  clipboard: {
    writeText: async (_t: string) => {},
    readText: async () => '',
  },
};


