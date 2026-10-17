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
    const parts = str.split('://');
    const scheme = parts[0] || 'file';
    const path = parts[1] || '';
    return new Uri(scheme, '', path);
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const joined = [base.path, ...pathSegments].join('/').replace(/\/+/g, '/');
    return new Uri(base.scheme, base.authority, joined);
  }
}

export class Range {
  constructor(public startLine: any, public startCol: any, public endLine?: any, public endCol?: any) {}
}

export class CodeLens {
  constructor(public range: Range, public command?: any) {}
}

export class LanguageModelTextPart {
  constructor(public value: string) {}
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
  applyEdit: async () => true,
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

export const window = {
  activeTextEditor: undefined,
  showInformationMessage: async (..._args: any[]): Promise<any> => undefined,
  showWarningMessage: async (..._args: any[]): Promise<any> => undefined,
  showErrorMessage: async (..._args: any[]): Promise<any> => undefined,
  showOpenDialog: async () => undefined,
  showInputBox: async (_options?: any): Promise<string | undefined> => undefined,
  registerCustomEditorProvider: () => ({ dispose: () => {} }),
  registerTreeDataProvider: () => ({ dispose: () => {} }),
  createTreeView: () => ({
    selection: [] as any[],
    dispose: () => {},
    reveal: async () => {},
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
  tools: [],
  registerTool: () => ({ dispose: () => {} }),
};

export const chat = {
  createChatParticipant: () => ({ iconPath: undefined }),
};

export class LanguageModelChatMessage {
  static User(content: string) {
    return { role: 'user', content };
  }
}

export class WorkspaceEdit {
  replace() {}
}
