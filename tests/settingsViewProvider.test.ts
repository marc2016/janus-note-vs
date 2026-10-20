import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { SettingsViewProvider } from '../src/editors/settingsViewProvider';
import { AiModelService } from '../src/services/aiModelService';

describe('SettingsViewProvider', () => {
  let secretStore: Map<string, string>;
  let configStore: Map<string, unknown>;
  let mockContext: vscode.ExtensionContext;
  let aiModelService: AiModelService;
  let provider: SettingsViewProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    secretStore = new Map<string, string>();
    configStore = new Map<string, unknown>([
      ['janus.ai.provider', 'vscode-lm'],
      ['janus.ai.modelId', 'gpt-4o'],
      ['janus.ai.ollamaBaseUrl', 'http://localhost:11434'],
      ['janus.ai.customBaseUrl', ''],
      ['janus.ai.inboxSortConfirm', false],
      ['janus.notesRoot', ''],
    ]);

    mockContext = {
      extensionUri: vscode.Uri.file('/extension'),
      secrets: {
        get: vi.fn(async (key: string) => secretStore.get(key)),
        store: vi.fn(async (key: string, val: string) => {
          secretStore.set(key, val);
        }),
        delete: vi.fn(async (key: string) => {
          secretStore.delete(key);
        }),
      },
    } as unknown as vscode.ExtensionContext;

    vi.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      const prefix = section ? `${section}.` : '';
      return {
        get: vi.fn(<T>(key: string, defaultValue?: T): T => {
          const fullKey = `${prefix}${key}`;
          if (configStore.has(fullKey)) {
            return configStore.get(fullKey) as T;
          }
          return defaultValue as T;
        }),
        update: vi.fn(async (key: string, value: unknown) => {
          const fullKey = `${prefix}${key}`;
          configStore.set(fullKey, value);
        }),
      } as unknown as vscode.WorkspaceConfiguration;
    });

    aiModelService = new AiModelService(mockContext);
    vi.spyOn(aiModelService, 'discoverVsCodeLmModels').mockResolvedValue([
      { provider: 'vscode-lm', modelId: 'gpt-4o', label: 'VS Code: GPT-4o' },
    ]);
    vi.spyOn(aiModelService, 'discoverOllamaModels').mockResolvedValue([
      { provider: 'ollama', modelId: 'llama3.3', label: 'Ollama: llama3.3' },
    ]);

    provider = new SettingsViewProvider(mockContext, aiModelService);
  });

  it('opens a singleton webview panel and reveals existing panel on subsequent calls', async () => {
    const createPanelSpy = vi.spyOn(vscode.window, 'createWebviewPanel');

    await provider.open();
    expect(createPanelSpy).toHaveBeenCalledTimes(1);
    expect(createPanelSpy).toHaveBeenCalledWith(
      'janus.settingsView',
      'Janus Einstellungen',
      vscode.ViewColumn.One,
      expect.any(Object)
    );

    await provider.open();
    expect(createPanelSpy).toHaveBeenCalledTimes(1);
  });

  it('builds settings state with boolean API key indicators without exposing secret values', async () => {
    secretStore.set('janus.ai.apiKey.openai', 'sk-secret-value-123');

    const state = await provider.getSettingsState();

    expect(state.provider).toBe('vscode-lm');
    expect(state.modelId).toBe('gpt-4o');
    expect(state.apiKeyStatus.openai).toBe(true);
    expect(state.apiKeyStatus.anthropic).toBe(false);
    expect(JSON.stringify(state)).not.toContain('sk-secret-value-123');
    expect(state.discoveredModels.vscodeLm).toHaveLength(1);
    expect(state.discoveredModels.ollama).toHaveLength(1);
  });

  it('updates AI configuration settings when receiving updateAiConfig message', async () => {
    await provider.handleMessage({
      type: 'updateAiConfig',
      provider: 'ollama',
      modelId: 'llama3.3',
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      inboxSortConfirm: true,
    });

    expect(configStore.get('janus.ai.provider')).toBe('ollama');
    expect(configStore.get('janus.ai.modelId')).toBe('llama3.3');
    expect(configStore.get('janus.ai.ollamaBaseUrl')).toBe('http://127.0.0.1:11434');
    expect(configStore.get('janus.ai.inboxSortConfirm')).toBe(true);
  });

  it('saves and clears API keys via SecretStorage', async () => {
    await provider.handleMessage({
      type: 'saveApiKey',
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key',
    });

    expect(secretStore.get('janus.ai.apiKey.anthropic')).toBe('sk-ant-test-key');

    await provider.handleMessage({
      type: 'clearApiKey',
      provider: 'anthropic',
    });

    expect(secretStore.has('janus.ai.apiKey.anthropic')).toBe(false);
  });

  it('forwards setNotesRoot and resetNotesRoot messages to VS Code commands', async () => {
    const executeCommandSpy = vi
      .spyOn(vscode.commands, 'executeCommand')
      .mockResolvedValue(undefined);

    await provider.handleMessage({ type: 'setNotesRoot' });
    expect(executeCommandSpy).toHaveBeenCalledWith('janus.setNotesRoot');

    await provider.handleMessage({ type: 'resetNotesRoot' });
    expect(executeCommandSpy).toHaveBeenCalledWith('janus.resetNotesRoot');
  });
});

