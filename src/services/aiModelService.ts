import * as vscode from 'vscode';

export type AiProviderType =
  | 'vscode-lm'
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'custom';

export interface AiModelInfo {
  provider: AiProviderType;
  modelId: string;
  label: string;
  vendor?: string;
}

const DEFAULT_PROVIDER_MODELS: Record<Exclude<AiProviderType, 'vscode-lm'>, string> = {
  ollama: 'llama3.3',
  openai: 'gpt-4o',
  anthropic: 'claude-3-7-sonnet-latest',
  gemini: 'gemini-2.5-flash',
  custom: 'gpt-4o-mini',
};

const PROVIDER_LABELS: Record<AiProviderType, string> = {
  'vscode-lm': 'VS Code',
  ollama: 'Ollama',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  custom: 'Custom AI',
};

export class AiModelService {
  private readonly _onDidChangeModel = new vscode.EventEmitter<void>();
  public readonly onDidChangeModel = this._onDidChangeModel.event;

  constructor(private readonly context?: vscode.ExtensionContext) {
    if (vscode.lm && typeof (vscode.lm as any).onDidChangeChatModels === 'function') {
      const sub = (vscode.lm as any).onDidChangeChatModels(() => {
        this._onDidChangeModel.fire();
      });
      this.context?.subscriptions?.push(sub);
    }
  }

  public getConfiguredProvider(): AiProviderType {
    const config = vscode.workspace.getConfiguration('janus.ai');
    const raw = config.get<string>('provider', 'vscode-lm') as AiProviderType;
    if (['vscode-lm', 'ollama', 'openai', 'anthropic', 'gemini', 'custom'].includes(raw)) {
      return raw;
    }
    return 'vscode-lm';
  }

  public getConfiguredModelId(): string {
    const config = vscode.workspace.getConfiguration('janus.ai');
    return (config.get<string>('modelId', '') || '').trim();
  }

  public getOllamaBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('janus.ai');
    return (config.get<string>('ollamaBaseUrl', 'http://localhost:11434') || 'http://localhost:11434')
      .trim()
      .replace(/\/+$/, '');
  }

  public getCustomBaseUrl(): string {
    const config = vscode.workspace.getConfiguration('janus.ai');
    return (
      config.get<string>('customBaseUrl', 'https://api.openai.com/v1') ||
      'https://api.openai.com/v1'
    )
      .trim()
      .replace(/\/+$/, '');
  }

  public async getApiKey(provider: AiProviderType): Promise<string | undefined> {
    if (!this.context?.secrets) {
      return undefined;
    }
    return this.context.secrets.get(`janus.ai.apiKey.${provider}`);
  }

  public async setApiKey(provider: AiProviderType, apiKey: string): Promise<void> {
    if (!this.context?.secrets) {
      return;
    }
    if (apiKey.trim()) {
      await this.context.secrets.store(`janus.ai.apiKey.${provider}`, apiKey.trim());
    } else {
      await this.context.secrets.delete(`janus.ai.apiKey.${provider}`);
    }
  }

  public async discoverVsCodeLmModels(): Promise<AiModelInfo[]> {
    if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
      return [];
    }
    try {
      let models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      const allModels = await vscode.lm.selectChatModels({});
      const seen = new Set<string>();
      const combined = [...(models || []), ...(allModels || [])].filter((m) => {
        if (!m || !m.id || seen.has(m.id)) {
          return false;
        }
        seen.add(m.id);
        return true;
      });

      return combined.map((m) => {
        const vendorPrefix =
          m.vendor === 'copilot' ? 'Copilot' : m.vendor ? m.vendor : 'VS Code';
        const displayName = m.name || m.id;
        return {
          provider: 'vscode-lm' as const,
          modelId: m.id,
          label: `${vendorPrefix}: ${displayName}`,
          vendor: m.vendor,
        };
      });
    } catch {
      return [];
    }
  }

  public async discoverOllamaModels(): Promise<AiModelInfo[]> {
    const baseUrl = this.getOllamaBaseUrl();
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      if (!Array.isArray(data.models)) {
        return [];
      }
      return data.models
        .map((m) => m.name?.trim())
        .filter((name): name is string => Boolean(name))
        .map((name) => ({
          provider: 'ollama' as const,
          modelId: name,
          label: `Ollama: ${name}`,
        }));
    } catch {
      return [];
    }
  }

  public async getActiveModelInfo(): Promise<AiModelInfo> {
    const provider = this.getConfiguredProvider();
    const configuredModelId = this.getConfiguredModelId();

    if (provider === 'vscode-lm') {
      const vsModels = await this.discoverVsCodeLmModels();
      if (configuredModelId) {
        const matched = vsModels.find((m) => m.modelId === configuredModelId);
        if (matched) {
          return matched;
        }
        return {
          provider: 'vscode-lm',
          modelId: configuredModelId,
          label: `Copilot: ${configuredModelId}`,
        };
      }
      if (vsModels.length > 0) {
        return vsModels[0];
      }
      return {
        provider: 'vscode-lm',
        modelId: '',
        label: 'GitHub Copilot (Auto)',
      };
    }

    const effectiveModelId = configuredModelId || DEFAULT_PROVIDER_MODELS[provider];
    return {
      provider,
      modelId: effectiveModelId,
      label: `${PROVIDER_LABELS[provider]}: ${effectiveModelId}`,
    };
  }

  public async setActiveModel(provider: AiProviderType, modelId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('janus.ai');
    const target = vscode.workspace.workspaceFolders?.length
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
    await config.update('provider', provider, target);
    await config.update('modelId', modelId, target);
    this._onDidChangeModel.fire();
  }

  public async selectModelInteractive(): Promise<AiModelInfo | undefined> {
    const [vsModels, ollamaModels] = await Promise.all([
      this.discoverVsCodeLmModels(),
      this.discoverOllamaModels(),
    ]);

    type PickerItem = vscode.QuickPickItem & {
      action?: 'configure-key' | 'configure-url' | 'custom-model';
      provider?: AiProviderType;
      modelId?: string;
    };

    const items: PickerItem[] = [
      {
        label: '$(hubot) GitHub Copilot (VS Code integriert – Automatisch)',
        description: 'Nutzt das aktive GitHub Copilot Modell in VS Code (kein API-Key nötig)',
        provider: 'vscode-lm',
        modelId: '',
      },
    ];

    // 1. Specific VS Code LM models (Copilot GPT-4o, Claude 3.5 Sonnet, o3-mini, etc.)
    for (const m of vsModels) {
      items.push({
        label: `$(sparkle) ${m.label}`,
        description: `Eingebautes VS Code / Copilot Modell (${m.modelId})`,
        provider: 'vscode-lm',
        modelId: m.modelId,
      });
    }

    // 2. Local Ollama models
    for (const m of ollamaModels) {
      items.push({
        label: `$(server) ${m.label}`,
        description: `Lokal (${this.getOllamaBaseUrl()})`,
        provider: 'ollama',
        modelId: m.modelId,
      });
    }

    // 3. Cloud / Direct Provider presets
    const cloudPresets: Array<{ provider: AiProviderType; modelId: string; desc: string }> = [
      { provider: 'openai', modelId: 'gpt-4o', desc: 'OpenAI API' },
      { provider: 'openai', modelId: 'gpt-4o-mini', desc: 'OpenAI API (schnell)' },
      { provider: 'anthropic', modelId: 'claude-3-7-sonnet-latest', desc: 'Anthropic API' },
      { provider: 'anthropic', modelId: 'claude-3-5-haiku-latest', desc: 'Anthropic API (schnell)' },
      { provider: 'gemini', modelId: 'gemini-2.5-flash', desc: 'Google Gemini API' },
      { provider: 'gemini', modelId: 'gemini-2.5-pro', desc: 'Google Gemini API (Pro)' },
    ];

    for (const preset of cloudPresets) {
      items.push({
        label: `$(cloud) ${PROVIDER_LABELS[preset.provider]}: ${preset.modelId}`,
        description: preset.desc,
        provider: preset.provider,
        modelId: preset.modelId,
      });
    }

    items.push(
      {
        label: '$(edit) Eigenes Modell / Provider eingeben (Ollama, OpenAI, Anthropic, Gemini, Custom)...',
        description: 'Beliebige Modell-ID festlegen',
        action: 'custom-model',
      },
      {
        label: '$(key) API-Key für KI-Provider hinterlegen...',
        description: 'Sicher im VS Code SecretStorage speichern',
        action: 'configure-key',
      },
      {
        label: '$(settings-gear) Ollama / Custom Endpoint URL konfigurieren...',
        description: `Ollama: ${this.getOllamaBaseUrl()}`,
        action: 'configure-url',
      }
    );

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Aktives KI-Modell für Janus Aufgaben-Generierung auswählen...',
      matchOnDescription: true,
    });

    if (!selected) {
      return undefined;
    }

    if (selected.action === 'configure-key') {
      await this.promptForApiKeyInteractive();
      return this.getActiveModelInfo();
    }

    if (selected.action === 'configure-url') {
      await this.promptForEndpointUrlInteractive();
      return this.getActiveModelInfo();
    }

    if (selected.action === 'custom-model') {
      const providerPick = await vscode.window.showQuickPick(
        [
          { label: 'Ollama (Lokal)', provider: 'ollama' as AiProviderType },
          { label: 'OpenAI', provider: 'openai' as AiProviderType },
          { label: 'Anthropic', provider: 'anthropic' as AiProviderType },
          { label: 'Google Gemini', provider: 'gemini' as AiProviderType },
          { label: 'Custom (OpenAI-kompatibel)', provider: 'custom' as AiProviderType },
          { label: 'VS Code Language Model', provider: 'vscode-lm' as AiProviderType },
        ],
        { placeHolder: 'Welchen KI-Provider möchtest du verwenden?' }
      );
      if (!providerPick) {
        return undefined;
      }

      const defaultModel =
        providerPick.provider === 'vscode-lm'
          ? ''
          : DEFAULT_PROVIDER_MODELS[providerPick.provider];
      const modelInput = await vscode.window.showInputBox({
        prompt: `Modell-ID für ${providerPick.label} eingeben`,
        value: defaultModel,
        placeHolder: 'z.B. llama3.3, gpt-4o, claude-3-7-sonnet-latest, gemini-2.5-flash',
      });
      if (!modelInput) {
        return undefined;
      }

      await this.ensureApiKeyIfNeeded(providerPick.provider);
      await this.setActiveModel(providerPick.provider, modelInput.trim());
      return this.getActiveModelInfo();
    }

    if (selected.provider && selected.modelId !== undefined) {
      await this.ensureApiKeyIfNeeded(selected.provider);
      await this.setActiveModel(selected.provider, selected.modelId);
      return this.getActiveModelInfo();
    }

    return undefined;
  }

  private async ensureApiKeyIfNeeded(provider: AiProviderType): Promise<void> {
    if (provider === 'vscode-lm' || provider === 'ollama') {
      return;
    }
    const existing = await this.getApiKey(provider);
    if (!existing) {
      const input = await vscode.window.showInputBox({
        prompt: `Bitte API-Key für ${PROVIDER_LABELS[provider]} eingeben (wird sicher im VS Code SecretStorage gespeichert)`,
        password: true,
        ignoreFocusOut: true,
      });
      if (input && input.trim()) {
        await this.setApiKey(provider, input.trim());
      }
    }
  }

  private async promptForApiKeyInteractive(): Promise<void> {
    const providerPick = await vscode.window.showQuickPick(
      [
        { label: 'OpenAI', provider: 'openai' as AiProviderType },
        { label: 'Anthropic', provider: 'anthropic' as AiProviderType },
        { label: 'Google Gemini', provider: 'gemini' as AiProviderType },
        { label: 'Custom (OpenAI-kompatibel)', provider: 'custom' as AiProviderType },
      ],
      { placeHolder: 'Für welchen Provider soll ein API-Key gespeichert werden?' }
    );
    if (!providerPick) {
      return;
    }
    const key = await vscode.window.showInputBox({
      prompt: `API-Key für ${providerPick.label} eingeben`,
      password: true,
      ignoreFocusOut: true,
    });
    if (key !== undefined) {
      await this.setApiKey(providerPick.provider, key);
      vscode.window.showInformationMessage(`API-Key für ${providerPick.label} wurde gespeichert.`);
    }
  }

  private async promptForEndpointUrlInteractive(): Promise<void> {
    const targetPick = await vscode.window.showQuickPick(
      [
        { label: 'Ollama Base-URL', key: 'ollamaBaseUrl', current: this.getOllamaBaseUrl() },
        { label: 'Custom OpenAI-Compatible Base-URL', key: 'customBaseUrl', current: this.getCustomBaseUrl() },
      ],
      { placeHolder: 'Welchen Endpoint möchtest du anpassen?' }
    );
    if (!targetPick) {
      return;
    }
    const urlInput = await vscode.window.showInputBox({
      prompt: `${targetPick.label} eingeben`,
      value: targetPick.current,
    });
    if (urlInput && urlInput.trim()) {
      const config = vscode.workspace.getConfiguration('janus.ai');
      const target = vscode.workspace.workspaceFolders?.length
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
      await config.update(targetPick.key, urlInput.trim(), target);
      this._onDidChangeModel.fire();
    }
  }

  public async completePrompt(
    systemPrompt: string,
    userPrompt: string,
    token?: vscode.CancellationToken
  ): Promise<string> {
    const active = await this.getActiveModelInfo();
    const { provider, modelId } = active;

    if (provider === 'vscode-lm') {
      if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
        throw new Error('VS Code Language Model API ist in dieser Umgebung nicht verfügbar.');
      }
      const models = await vscode.lm.selectChatModels(
        modelId ? { id: modelId } : { vendor: 'copilot' }
      );
      const fallbackModels = models.length > 0 ? models : await vscode.lm.selectChatModels({});
      const selectedModel = fallbackModels[0];

      if (!selectedModel) {
        throw new Error(
          'Kein aktives VS Code Sprachmodell gefunden. Bitte wähle unten in der Leiste ein anderes KI-Modell (z.B. Ollama, OpenAI, Anthropic oder Gemini).'
        );
      }

      const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(userPrompt),
      ];
      const cts = new vscode.CancellationTokenSource();
      const response = await selectedModel.sendRequest(messages, {}, token || cts.token);
      let output = '';
      for await (const fragment of response.text) {
        output += fragment;
      }
      return output;
    }

    if (provider === 'ollama') {
      const baseUrl = this.getOllamaBaseUrl();
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId || DEFAULT_PROVIDER_MODELS.ollama,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama Fehler (${response.status}): ${errText}`);
      }
      const data = (await response.json()) as { message?: { content?: string } };
      return data.message?.content || '';
    }

    if (provider === 'openai' || provider === 'custom') {
      const apiKey = await this.getApiKey(provider);
      if (!apiKey) {
        throw new Error(
          `Kein API-Key für ${PROVIDER_LABELS[provider]} hinterlegt. Bitte klicke unten auf das KI-Modell, um einen API-Key zu speichern.`
        );
      }
      const baseUrl =
        provider === 'openai' ? 'https://api.openai.com/v1' : this.getCustomBaseUrl();
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId || DEFAULT_PROVIDER_MODELS[provider],
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`${PROVIDER_LABELS[provider]} Fehler (${response.status}): ${errText}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content || '';
    }

    if (provider === 'anthropic') {
      const apiKey = await this.getApiKey('anthropic');
      if (!apiKey) {
        throw new Error(
          'Kein API-Key für Anthropic hinterlegt. Bitte klicke unten auf das KI-Modell, um einen API-Key zu speichern.'
        );
      }
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId || DEFAULT_PROVIDER_MODELS.anthropic,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic Fehler (${response.status}): ${errText}`);
      }
      const data = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      return data.content?.find((c) => c.type === 'text')?.text || '';
    }

    if (provider === 'gemini') {
      const apiKey = await this.getApiKey('gemini');
      if (!apiKey) {
        throw new Error(
          'Kein API-Key für Google Gemini hinterlegt. Bitte klicke unten auf das KI-Modell, um einen API-Key zu speichern.'
        );
      }
      const effectiveModel = modelId || DEFAULT_PROVIDER_MODELS.gemini;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        effectiveModel
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Fehler (${response.status}): ${errText}`);
      }
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    throw new Error(`Unbekannter KI-Provider: ${provider}`);
  }
}

