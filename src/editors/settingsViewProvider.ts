import * as vscode from 'vscode';
import { AiModelInfo, AiModelService, AiProviderType } from '../services/aiModelService';

export interface JanusSettingsState {
  provider: AiProviderType;
  modelId: string;
  activeModelLabel: string;
  ollamaBaseUrl: string;
  customBaseUrl: string;
  inboxSortConfirm: boolean;
  notesRoot: string;
  apiKeyStatus: Record<'openai' | 'anthropic' | 'gemini' | 'custom', boolean>;
  discoveredModels: {
    vscodeLm: AiModelInfo[];
    ollama: AiModelInfo[];
  };
}

const KEYED_PROVIDERS: Array<'openai' | 'anthropic' | 'gemini' | 'custom'> = [
  'openai',
  'anthropic',
  'gemini',
  'custom',
];

export class SettingsViewProvider {
  public static readonly viewType = 'janus.settingsView';
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly aiModelService: AiModelService
  ) {}

  public async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      SettingsViewProvider.viewType,
      'Janus Einstellungen',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist')],
      }
    );

    const initialState = await this.getSettingsState();
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, initialState);

    const msgSub = this.panel.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });

    const modelSub = this.aiModelService.onDidChangeModel(() => {
      void this.refresh();
    });

    const cfgSub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('janus')) {
        void this.refresh();
      }
    });

    this.panel.onDidDispose(() => {
      msgSub.dispose();
      modelSub.dispose();
      cfgSub.dispose();
      this.panel = undefined;
    });
  }

  public async getSettingsState(): Promise<JanusSettingsState> {
    const provider = this.aiModelService.getConfiguredProvider();
    const modelId = this.aiModelService.getConfiguredModelId();
    const ollamaBaseUrl = this.aiModelService.getOllamaBaseUrl();
    const customBaseUrl = this.aiModelService.getCustomBaseUrl();

    const aiCfg = vscode.workspace.getConfiguration('janus.ai');
    const inboxSortConfirm = aiCfg.get<boolean>('inboxSortConfirm', true);

    const janusCfg = vscode.workspace.getConfiguration('janus');
    const notesRoot = janusCfg.get<string>('notesRoot', '') || '';

    const [activeModel, vscodeLm, ollama, openaiKey, anthropicKey, geminiKey, customKey] =
      await Promise.all([
        this.aiModelService.getActiveModelInfo(),
        this.aiModelService.discoverVsCodeLmModels(),
        this.aiModelService.discoverOllamaModels(),
        this.aiModelService.getApiKey('openai'),
        this.aiModelService.getApiKey('anthropic'),
        this.aiModelService.getApiKey('gemini'),
        this.aiModelService.getApiKey('custom'),
      ]);

    return {
      provider,
      modelId,
      activeModelLabel: activeModel.label,
      ollamaBaseUrl,
      customBaseUrl,
      inboxSortConfirm,
      notesRoot,
      apiKeyStatus: {
        openai: Boolean(openaiKey && openaiKey.trim()),
        anthropic: Boolean(anthropicKey && anthropicKey.trim()),
        gemini: Boolean(geminiKey && geminiKey.trim()),
        custom: Boolean(customKey && customKey.trim()),
      },
      discoveredModels: {
        vscodeLm,
        ollama,
      },
    };
  }

  public async refresh(): Promise<void> {
    if (!this.panel) {
      return;
    }
    const state = await this.getSettingsState();
    void this.panel.webview.postMessage({
      type: 'settingsState',
      state,
    });
  }

  public async handleMessage(message: any): Promise<void> {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    if (message.type === 'ready' || message.type === 'refreshModels') {
      await this.refresh();
      return;
    }

    if (message.type === 'updateAiConfig') {
      const target = vscode.workspace.workspaceFolders?.length
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      const aiCfg = vscode.workspace.getConfiguration('janus.ai');

      if (typeof message.ollamaBaseUrl === 'string') {
        await aiCfg.update('ollamaBaseUrl', message.ollamaBaseUrl.trim(), target);
      }
      if (typeof message.customBaseUrl === 'string') {
        await aiCfg.update('customBaseUrl', message.customBaseUrl.trim(), target);
      }
      if (typeof message.inboxSortConfirm === 'boolean') {
        await aiCfg.update('inboxSortConfirm', message.inboxSortConfirm, target);
      }

      const nextProvider: AiProviderType =
        typeof message.provider === 'string'
          ? (message.provider as AiProviderType)
          : this.aiModelService.getConfiguredProvider();
      const nextModelId: string =
        typeof message.modelId === 'string'
          ? message.modelId.trim()
          : this.aiModelService.getConfiguredModelId();

      if (typeof message.provider === 'string' || typeof message.modelId === 'string') {
        await this.aiModelService.setActiveModel(nextProvider, nextModelId);
      }

      await this.refresh();
      return;
    }

    if (
      message.type === 'saveApiKey' &&
      KEYED_PROVIDERS.includes(message.provider) &&
      typeof message.apiKey === 'string'
    ) {
      await this.aiModelService.setApiKey(message.provider, message.apiKey.trim());
      void vscode.window.showInformationMessage(
        'API-Schlüssel wurde sicher im VS Code SecretStorage gespeichert.'
      );
      await this.refresh();
      return;
    }

    if (message.type === 'clearApiKey' && KEYED_PROVIDERS.includes(message.provider)) {
      await this.aiModelService.setApiKey(message.provider, '');
      void vscode.window.showInformationMessage('API-Schlüssel wurde gelöscht.');
      await this.refresh();
      return;
    }

    if (message.type === 'setNotesRoot') {
      await vscode.commands.executeCommand('janus.setNotesRoot');
      await this.refresh();
      return;
    }

    if (message.type === 'resetNotesRoot') {
      await vscode.commands.executeCommand('janus.resetNotesRoot');
      await this.refresh();
      return;
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, initialState: JanusSettingsState): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'settings.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'globals.css')
    );
    const nonce = getNonce();
    const initialJson = JSON.stringify({ state: initialState }).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Janus Einstellungen</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body class="bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] antialiased m-0 p-0">
  <script id="initial-data" type="application/json">${initialJson}</script>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

