import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MdiIcon } from '../components/ui/MdiIcon';
import {
  mdiCogOutline,
  mdiRobotOutline,
  mdiKeyOutline,
  mdiFolderOutline,
  mdiRefresh,
  mdiCheckCircleOutline,
  mdiDeleteOutline,
  mdiContentSaveOutline,
  mdiInboxArrowDown,
} from '@mdi/js';

export type AiProviderType =
  | 'vscode-lm'
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'custom';

export interface AiModelOption {
  provider: AiProviderType;
  modelId: string;
  label: string;
}

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
    vscodeLm: AiModelOption[];
    ollama: AiModelOption[];
  };
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let vscodeApiInstance: VsCodeApi | null = null;
function getVsCodeApi(): VsCodeApi | null {
  if (vscodeApiInstance) {
    return vscodeApiInstance;
  }
  try {
    vscodeApiInstance = acquireVsCodeApi();
    return vscodeApiInstance;
  } catch {
    return null;
  }
}

function getInitialState(): JanusSettingsState {
  try {
    const el = document.getElementById('initial-data');
    if (el && el.textContent) {
      const parsed = JSON.parse(el.textContent);
      if (parsed && parsed.state) {
        return parsed.state as JanusSettingsState;
      }
    }
  } catch {}
  return {
    provider: 'vscode-lm',
    modelId: '',
    activeModelLabel: 'GitHub Copilot (Auto)',
    ollamaBaseUrl: 'http://localhost:11434',
    customBaseUrl: 'https://api.openai.com/v1',
    inboxSortConfirm: true,
    notesRoot: '',
    apiKeyStatus: {
      openai: false,
      anthropic: false,
      gemini: false,
      custom: false,
    },
    discoveredModels: {
      vscodeLm: [],
      ollama: [],
    },
  };
}

const PROVIDER_OPTIONS: Array<{ value: AiProviderType; label: string; description: string }> = [
  {
    value: 'vscode-lm',
    label: 'VS Code / GitHub Copilot (Integriert)',
    description: 'Nutzt die in VS Code angemeldeten Sprachmodelle (kein eigener API-Key erforderlich).',
  },
  {
    value: 'ollama',
    label: 'Ollama (Lokal)',
    description: 'Nutzt lokal installierte Open-Weights-Modelle über den lokalen Ollama-Server.',
  },
  {
    value: 'openai',
    label: 'OpenAI API',
    description: 'Direkte Anbindung an die offizielle OpenAI API (z. B. gpt-4o, gpt-4o-mini).',
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude API',
    description: 'Direkte Anbindung an die Anthropic API (z. B. claude-3-7-sonnet-latest).',
  },
  {
    value: 'gemini',
    label: 'Google Gemini API',
    description: 'Direkte Anbindung an Google Gemini (z. B. gemini-2.5-flash, gemini-2.5-pro).',
  },
  {
    value: 'custom',
    label: 'Eigener OpenAI-kompatibler Endpunkt',
    description: 'Anbindung an OpenRouter, LM Studio, vLLM oder eigene Unternehmens-Gateways.',
  },
];

const STATIC_PRESET_MODELS: Record<Exclude<AiProviderType, 'vscode-lm' | 'ollama'>, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  anthropic: ['claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  custom: ['gpt-4o-mini'],
};

export const SettingsApp: React.FC = () => {
  const [state, setState] = useState<JanusSettingsState>(getInitialState);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [ollamaUrlDraft, setOllamaUrlDraft] = useState<string>(state.ollamaBaseUrl);
  const [customUrlDraft, setCustomUrlDraft] = useState<string>(state.customBaseUrl);
  const [customModelDraft, setCustomModelDraft] = useState<string>(state.modelId);

  useEffect(() => {
    const api = getVsCodeApi();
    api?.postMessage({ type: 'ready' });

    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg && msg.type === 'settingsState' && msg.state) {
        const nextState = msg.state as JanusSettingsState;
        setState(nextState);
        setOllamaUrlDraft(nextState.ollamaBaseUrl);
        setCustomUrlDraft(nextState.customBaseUrl);
        setCustomModelDraft(nextState.modelId);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const post = (payload: Record<string, unknown>) => {
    getVsCodeApi()?.postMessage(payload);
  };

  const handleProviderChange = (nextProvider: AiProviderType) => {
    let defaultModel = '';
    if (nextProvider === 'vscode-lm') {
      defaultModel = '';
    } else if (nextProvider === 'ollama') {
      defaultModel = state.discoveredModels.ollama[0]?.modelId || 'llama3.3';
    } else {
      defaultModel = STATIC_PRESET_MODELS[nextProvider][0] || '';
    }
    setCustomModelDraft(defaultModel);
    post({
      type: 'updateAiConfig',
      provider: nextProvider,
      modelId: defaultModel,
    });
  };

  const handleModelSelectChange = (nextModelId: string) => {
    setCustomModelDraft(nextModelId);
    post({
      type: 'updateAiConfig',
      provider: state.provider,
      modelId: nextModelId,
    });
  };

  const handleSaveCustomModelId = () => {
    post({
      type: 'updateAiConfig',
      provider: state.provider,
      modelId: customModelDraft.trim(),
    });
  };

  const handleSaveApiKey = (provider: 'openai' | 'anthropic' | 'gemini' | 'custom') => {
    if (!apiKeyInput.trim()) {
      return;
    }
    post({
      type: 'saveApiKey',
      provider,
      apiKey: apiKeyInput.trim(),
    });
    setApiKeyInput('');
  };

  const handleClearApiKey = (provider: 'openai' | 'anthropic' | 'gemini' | 'custom') => {
    post({
      type: 'clearApiKey',
      provider,
    });
  };

  const isKeyedProvider =
    state.provider === 'openai' ||
    state.provider === 'anthropic' ||
    state.provider === 'gemini' ||
    state.provider === 'custom';

  const currentProviderMeta =
    PROVIDER_OPTIONS.find((p) => p.value === state.provider) || PROVIDER_OPTIONS[0];

  const availableModelOptions: Array<{ value: string; label: string }> = [];
  if (state.provider === 'vscode-lm') {
    availableModelOptions.push({
      value: '',
      label: 'Automatisch (Standard VS Code / Copilot Modell)',
    });
    for (const m of state.discoveredModels.vscodeLm) {
      availableModelOptions.push({
        value: m.modelId,
        label: `${m.label} (${m.modelId})`,
      });
    }
  } else if (state.provider === 'ollama') {
    const seen = new Set<string>();
    for (const m of state.discoveredModels.ollama) {
      seen.add(m.modelId);
      availableModelOptions.push({
        value: m.modelId,
        label: `${m.modelId} (Lokal erkannt)`,
      });
    }
    for (const fallback of ['llama3.3', 'qwen2.5-coder', 'deepseek-r1', 'mistral']) {
      if (!seen.has(fallback)) {
        availableModelOptions.push({
          value: fallback,
          label: fallback,
        });
      }
    }
  } else {
    for (const preset of STATIC_PRESET_MODELS[state.provider]) {
      availableModelOptions.push({
        value: preset,
        label: preset,
      });
    }
  }

  if (
    state.modelId &&
    !availableModelOptions.some((opt) => opt.value === state.modelId)
  ) {
    availableModelOptions.push({
      value: state.modelId,
      label: `${state.modelId} (Benutzerdefiniert)`,
    });
  }

  return (
    <div className="h-screen overflow-y-auto bg-[var(--vscode-editor-background,#1e1e1e)] text-[var(--vscode-editor-foreground,#d4d4d4)] p-6 font-sans">
      <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-12">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] pb-4">
          <div className="flex items-center gap-2.5">
            <MdiIcon path={mdiCogOutline} size={22} className="text-primary" />
            <div>
              <h1 className="text-lg font-semibold leading-tight m-0">Janus Einstellungen</h1>
              <p className="text-xs opacity-75 m-0 mt-0.5">
                Zentrale Konfiguration für KI-Modelle, API-Zugangsdaten und Notizen-Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="janus-pill-tasks rounded-full px-3 py-1 text-xs font-medium">
              <MdiIcon path={mdiRobotOutline} size={13} />
              <span>Aktiv: {state.activeModelLabel}</span>
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => post({ type: 'refreshModels' })}
              title="Verfügbare VS Code / Ollama Modelle neu abfragen"
            >
              <MdiIcon path={mdiRefresh} size={14} />
              <span>Aktualisieren</span>
            </Button>
          </div>
        </header>

        {/* Section 1: AI Provider & Model */}
        <section className="rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.03))] p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <MdiIcon path={mdiRobotOutline} size={18} className="text-primary" />
            <h2 className="text-sm font-semibold m-0">1. KI-Anbieter & Modell</h2>
          </div>

          {/* Provider Select */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="janus-provider-select" className="text-xs font-medium">
              KI-Anbieter
            </label>
            <select
              id="janus-provider-select"
              value={state.provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProviderType)}
              className="w-full rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] opacity-75">{currentProviderMeta.description}</span>
          </div>

          {/* Model Select */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="janus-model-select" className="text-xs font-medium">
              Modell-Auswahl
            </label>
            <select
              id="janus-model-select"
              value={state.modelId}
              onChange={(e) => handleModelSelectChange(e.target.value)}
              className="w-full rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] px-3 py-2 text-xs focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
            >
              {availableModelOptions.map((opt) => (
                <option key={opt.value || '__auto__'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Model ID override */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="janus-custom-model-input" className="text-xs font-medium">
              Modell-ID manuell angeben (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="janus-custom-model-input"
                type="text"
                value={customModelDraft}
                onChange={(e) => setCustomModelDraft(e.target.value)}
                placeholder={
                  state.provider === 'vscode-lm'
                    ? 'Leer lassen für automatisches Copilot-Modell'
                    : 'z. B. gpt-4o, claude-3-7-sonnet-latest, llama3.3'
                }
                className="flex-1 rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveCustomModelId}
              >
                <MdiIcon path={mdiContentSaveOutline} size={14} />
                <span>Übernehmen</span>
              </Button>
            </div>
          </div>

          {/* Ollama Base URL */}
          {state.provider === 'ollama' && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))]">
              <label htmlFor="janus-ollama-url" className="text-xs font-medium">
                Ollama Server Basis-URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="janus-ollama-url"
                  type="text"
                  value={ollamaUrlDraft}
                  onChange={(e) => setOllamaUrlDraft(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    post({
                      type: 'updateAiConfig',
                      ollamaBaseUrl: ollamaUrlDraft,
                    })
                  }
                >
                  <MdiIcon path={mdiContentSaveOutline} size={14} />
                  <span>URL speichern</span>
                </Button>
              </div>
            </div>
          )}

          {/* Custom Base URL */}
          {state.provider === 'custom' && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))]">
              <label htmlFor="janus-custom-url" className="text-xs font-medium">
                OpenAI-kompatible Basis-URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="janus-custom-url"
                  type="text"
                  value={customUrlDraft}
                  onChange={(e) => setCustomUrlDraft(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="flex-1 rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    post({
                      type: 'updateAiConfig',
                      customBaseUrl: customUrlDraft,
                    })
                  }
                >
                  <MdiIcon path={mdiContentSaveOutline} size={14} />
                  <span>URL speichern</span>
                </Button>
              </div>
            </div>
          )}

          {/* API Key Management for Cloud / Custom Providers */}
          {isKeyedProvider && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.2))]">
              <div className="flex items-center justify-between">
                <label htmlFor="janus-api-key-input" className="text-xs font-medium flex items-center gap-1.5">
                  <MdiIcon path={mdiKeyOutline} size={14} />
                  <span>API-Schlüssel ({currentProviderMeta.label})</span>
                </label>
                {state.apiKeyStatus[state.provider as 'openai' | 'anthropic' | 'gemini' | 'custom'] ? (
                  <Badge className="janus-pill-backlink rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                    <MdiIcon path={mdiCheckCircleOutline} size={12} />
                    <span>Im SecretStorage hinterlegt</span>
                  </Badge>
                ) : (
                  <Badge className="janus-pill-missing rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                    <span>Kein API-Schlüssel gespeichert</span>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="janus-api-key-input"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Neuen API-Schlüssel eingeben (sk-...)"
                  className="flex-1 rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.35))] bg-[var(--vscode-input-background,#3c3c3c)] text-[var(--vscode-input-foreground,#cccccc)] px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--vscode-focusBorder,#007acc)]"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={!apiKeyInput.trim()}
                  onClick={() =>
                    handleSaveApiKey(state.provider as 'openai' | 'anthropic' | 'gemini' | 'custom')
                  }
                >
                  <MdiIcon path={mdiContentSaveOutline} size={14} />
                  <span>Speichern</span>
                </Button>
                {state.apiKeyStatus[state.provider as 'openai' | 'anthropic' | 'gemini' | 'custom'] && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleClearApiKey(state.provider as 'openai' | 'anthropic' | 'gemini' | 'custom')
                    }
                    title="Gespeicherten API-Schlüssel aus dem SecretStorage entfernen"
                  >
                    <MdiIcon path={mdiDeleteOutline} size={14} />
                    <span>Löschen</span>
                  </Button>
                )}
              </div>
              <span className="text-[11px] opacity-70">
                Dein API-Schlüssel wird verschlüsselt im VS Code SecretStorage gespeichert und erscheint niemals im Klartext in Einstellungsdateien.
              </span>
            </div>
          )}
        </section>

        {/* Section 2: AI Behavior */}
        <section className="rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.03))] p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MdiIcon path={mdiInboxArrowDown} size={18} className="text-primary" />
            <h2 className="text-sm font-semibold m-0">2. KI-Verhalten (Inbox-Sortierung)</h2>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.inboxSortConfirm}
              onChange={(e) =>
                post({
                  type: 'updateAiConfig',
                  inboxSortConfirm: e.target.checked,
                })
              }
              className="mt-0.5 h-4 w-4 cursor-pointer"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">
                Vorschau vor dem Einsortieren der Inbox anzeigen
              </span>
              <span className="text-[11px] opacity-75">
                Wenn aktiviert (`janus.ai.inboxSortConfirm`), zeigt Janus vor dem Verschieben von Einträgen aus `inbox.md` eine Auswahlliste der vorgeschlagenen Ziel-Notizen an.
              </span>
            </div>
          </label>
        </section>

        {/* Section 3: Workspace Notes Root */}
        <section className="rounded-lg border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.25))] bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.03))] p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MdiIcon path={mdiFolderOutline} size={18} className="text-primary" />
            <h2 className="text-sm font-semibold m-0">3. Workspace & Notizen-Ordner</h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">
                Aktueller Notizen-Ordner:{' '}
                <code className="px-1.5 py-0.5 rounded bg-[var(--vscode-textCodeBlock-background,rgba(128,128,128,0.18))]">
                  {state.notesRoot || '(Workspace-Wurzelverzeichnis)'}
                </code>
              </span>
              <span className="text-[11px] opacity-75">
                Relativer Pfad innerhalb des Workspaces (`janus.notesRoot`).
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => post({ type: 'setNotesRoot' })}
              >
                <MdiIcon path={mdiFolderOutline} size={14} />
                <span>Ordner ändern...</span>
              </Button>
              {state.notesRoot && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => post({ type: 'resetNotesRoot' })}
                >
                  <span>Zurücksetzen</span>
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

