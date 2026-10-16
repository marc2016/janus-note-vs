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
    return new Uri(base.scheme, base.authority, [base.path, ...pathSegments].join('/'));
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
  fire(_data?: T) {}
  event = (listener: (e: T) => any) => {
    return { dispose: () => {} };
  };
  dispose() {}
}

export const workspace = {
  fs: {
    stat: async () => {},
    readFile: async () => Buffer.from(''),
    writeFile: async () => {},
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
};

export const window = {
  activeTextEditor: undefined,
  showInformationMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  registerCustomEditorProvider: () => ({ dispose: () => {} }),
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
