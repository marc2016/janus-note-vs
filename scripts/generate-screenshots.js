const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(workspaceRoot, 'assets', 'screenshots');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const commonCssVars = `
  :root {
    --vscode-editor-background: #1e1e1e;
    --vscode-editor-foreground: #d4d4d4;
    --vscode-sideBar-background: #252526;
    --vscode-sideBar-foreground: #cccccc;
    --vscode-sideBar-border: rgba(128, 128, 128, 0.25);
    --vscode-editorWidget-background: #252526;
    --vscode-editorWidget-border: rgba(128, 128, 128, 0.25);
    --vscode-input-background: #3c3c3c;
    --vscode-input-foreground: #cccccc;
    --vscode-input-border: rgba(128, 128, 128, 0.35);
    --vscode-input-placeholderForeground: #858585;
    --vscode-button-background: #007acc;
    --vscode-button-foreground: #ffffff;
    --vscode-button-hoverBackground: #0062a3;
    --vscode-button-secondaryBackground: #3a3d41;
    --vscode-button-secondaryForeground: #ffffff;
    --vscode-button-secondaryHoverBackground: #45494e;
    --vscode-badge-background: #333333;
    --vscode-badge-foreground: #ffffff;
    --vscode-textLink-foreground: #3794ff;
    --vscode-focusBorder: #007acc;
    --vscode-descriptionForeground: #858585;
    --vscode-toolbar-hoverBackground: rgba(255, 255, 255, 0.1);
    --vscode-editorLightBulb-foreground: #cca700;
  }
`;

function capture(htmlPath, outPngPath, width, height) {
  console.log(`📸 Taking screenshot: ${path.basename(outPngPath)} (${width}x${height})...`);
  const cmd = `"${chromeBin}" --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 --screenshot="${outPngPath}" --window-size=${width},${height} "file://${htmlPath}"`;
  execSync(cmd, { stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// 1. Folder Overview (03-folder-overview.png)
// ---------------------------------------------------------------------------
const overviewHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Janus Note - Ordnerübersicht</title>
  <link rel="stylesheet" href="${workspaceRoot}/dist/webviews/globals.css">
  <style>
    ${commonCssVars}
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 1200px;
      height: 750px;
      overflow: hidden;
    }
  </style>
  <script>
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {},
        getState: function() { return {}; },
        setState: function() {}
      };
    };
  </script>
</head>
<body>
  <div id="root" style="height: 100%;"></div>
  <script src="${workspaceRoot}/dist/webviews/folderOverview.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'updateFolder',
            data: {
              mode: 'folder',
              folderName: 'projects / App-Launch',
              folderPath: '/workspace/projects/App-Launch',
              folderUri: 'file:///workspace/projects/App-Launch',
              notes: [
                {
                  uri: 'file:///workspace/projects/App-Launch/project-plan.md',
                  relativePath: 'project-plan.md',
                  title: 'Q4 Produkt-Release & Architekturplan',
                  preview: 'Meilensteine für das Release. Verknüpft mit knowledge/architecture...',
                  mtime: Date.now() - 3600000,
                  size: 2450,
                  tasksCount: 3,
                  hasTasks: true,
                  hasChart: true
                },
                {
                  uri: 'file:///workspace/projects/App-Launch/kickoff.md',
                  relativePath: 'kickoff.md',
                  title: 'Kickoff Meeting & Roadmap',
                  preview: 'Wichtigste Beschlüsse zum neuen CodeMirror 6 Editor und Vektor-PDF Export...',
                  mtime: Date.now() - 86400000,
                  size: 1820,
                  tasksCount: 4,
                  hasTasks: true,
                  hasChart: false
                },
                {
                  uri: 'file:///workspace/projects/App-Launch/feedback.md',
                  relativePath: 'feedback.md',
                  title: 'Nutzerfeedback & UI-Verbesserungen',
                  preview: 'Optimierung von Schriftgrößen und WCAG AA Button-Kontrasten...',
                  mtime: Date.now() - 172800000,
                  size: 1240,
                  tasksCount: 0,
                  hasTasks: true,
                  hasChart: false
                }
              ],
              tasks: {
                exists: true,
                openCount: 3,
                completedCount: 4,
                totalCount: 7,
                recentTasks: [
                  { id: '1', title: 'CodeMirror 6 Editor fertigstellen', completed: true, priority: 'high' },
                  { id: '2', title: 'Vektor-PDF Compendium Export testen', completed: false, priority: 'high', dueDate: '2026-10-25' },
                  { id: '3', title: 'Janus KI & Suche in Sidebar integrieren', completed: false, priority: 'medium' }
                ]
              },
              subfolderCount: 0,
              selectedCount: 3,
              canIncludeSubfolders: false,
              defaultSaveLocation: 'file:///workspace/projects/App-Launch'
            }
          }
        }));

        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'updateSummary',
            summary: "### KI-Zusammenfassung aller Ordnernotizen\\n\\nDas Projekt **App-Launch** umfasst die Fertigstellung des neuen CodeMirror 6 Markdown-Editors sowie den vektorscharfen PDF-Compendium-Export.\\n\\n- **Aktueller Stand:** 4 von 7 Aufgaben sind erfolgreich abgeschlossen (57% Fortschritt).\\n- **Priorität:** Der Vektor-PDF-Export mit interaktivem Inhaltsverzeichnis steht im Fokus.\\n- **Nächster Meilenstein:** Release-Pipeline via GitHub Actions und Testlauf auf macOS/Windows."
          }
        }));
      }, 80);
    });
  </script>
</body>
</html>`;

const overviewPath = path.join('/tmp', 'screenshot-overview.html');
fs.writeFileSync(overviewPath, overviewHtml);
capture(overviewPath, path.join(assetsDir, '03-folder-overview.png'), 1200, 750);

// ---------------------------------------------------------------------------
// 2. Task Board (04-task-board.png)
// ---------------------------------------------------------------------------
const taskBoardHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Janus Note - Aufgaben-Board</title>
  <link rel="stylesheet" href="${workspaceRoot}/dist/webviews/globals.css">
  <style>
    ${commonCssVars}
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 1200px;
      height: 750px;
      overflow: hidden;
    }
  </style>
  <script id="initial-data" type="application/json">
  {
    "title": "Janus Task Board: projects/App-Launch",
    "tasks": [
      { "id": "1", "title": "Release Notes verfassen", "completed": false, "status": "todo", "priority": "high", "dueDate": "2026-10-25" },
      { "id": "2", "title": "Testlauf auf Windows 11 & macOS", "completed": false, "status": "todo", "priority": "medium" },
      { "id": "3", "title": "Vektor-PDF Compendium Export testen", "completed": false, "status": "in_progress", "priority": "high" },
      { "id": "4", "title": "CodeMirror 6 Markdown Editor", "completed": true, "status": "done", "priority": "high" },
      { "id": "5", "title": "GitHub Actions Release Pipeline", "completed": true, "status": "done", "priority": "medium" },
      { "id": "6", "title": "Janus KI & Suche in Sidebar integrieren", "completed": true, "status": "done", "priority": "high" }
    ]
  }
  </script>
  <script>
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {},
        getState: function() { return {}; },
        setState: function() {}
      };
    };
  </script>
</head>
<body>
  <div id="root" style="height: 100%;"></div>
  <script src="${workspaceRoot}/dist/webviews/tasks.js"></script>
</body>
</html>`;

const taskBoardPath = path.join('/tmp', 'screenshot-tasks.html');
fs.writeFileSync(taskBoardPath, taskBoardHtml);
capture(taskBoardPath, path.join(assetsDir, '04-task-board.png'), 1200, 750);

// ---------------------------------------------------------------------------
// 3. PDF Compendium Export (05-pdf-export.png)
// ---------------------------------------------------------------------------
const pdfExportHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Janus Note - PDF Export</title>
  <link rel="stylesheet" href="${workspaceRoot}/dist/webviews/globals.css">
  <style>
    ${commonCssVars}
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 1100px;
      height: 700px;
      overflow: hidden;
    }
  </style>
  <script>
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {},
        getState: function() { return {}; },
        setState: function() {}
      };
    };
  </script>
</head>
<body>
  <div id="root" style="height: 100%;"></div>
  <script src="${workspaceRoot}/dist/webviews/exportCompendium.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'init',
            data: {
              title: 'App-Launch Gesamtdokumentation 2026',
              includeToc: true,
              notes: [
                {
                  uri: 'file:///workspace/projects/App-Launch/kickoff.md',
                  relativePath: 'projects/App-Launch/kickoff.md',
                  title: '1. Kickoff Meeting & Roadmap'
                },
                {
                  uri: 'file:///workspace/projects/App-Launch/project-plan.md',
                  relativePath: 'projects/App-Launch/project-plan.md',
                  title: '2. Q4 Produkt-Release & Architekturplan'
                },
                {
                  uri: 'file:///workspace/projects/App-Launch/architecture.md',
                  relativePath: 'knowledge/architecture.md',
                  title: '3. Architektur & Companion-Dateien Spezifikation'
                }
              ]
            }
          }
        }));
      }, 80);
    });
  </script>
</body>
</html>`;

const pdfExportPath = path.join('/tmp', 'screenshot-pdf.html');
fs.writeFileSync(pdfExportPath, pdfExportHtml);
capture(pdfExportPath, path.join(assetsDir, '05-pdf-export.png'), 1100, 700);

// ---------------------------------------------------------------------------
// 4. Sidebar AI Chat (02-ai-chat-sidebar.png)
// ---------------------------------------------------------------------------
const chatSidebarHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Janus Note - KI & Suche</title>
  <link rel="stylesheet" href="${workspaceRoot}/dist/webviews/globals.css">
  <style>
    ${commonCssVars}
    body {
      background-color: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      width: 420px;
      height: 720px;
      overflow: hidden;
    }
  </style>
  <script>
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {},
        getState: function() { return {}; },
        setState: function() {}
      };
    };
  </script>
</head>
<body>
  <div id="root" style="height: 100%;"></div>
  <script src="${workspaceRoot}/dist/webviews/chat.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.dispatchEvent(new MessageEvent('message', {
          data: {
            type: 'init',
            model: {
              provider: 'ollama',
              modelId: 'llama3.3',
              label: 'Ollama: llama3.3'
            },
            history: [
              {
                id: '1',
                sender: 'user',
                text: '/search Architekturentscheidungen',
                timestamp: Date.now() - 60000
              },
              {
                id: '2',
                sender: 'assistant',
                text: 'Folgende wichtige Architektur-Beschlüsse wurden in deinen Notizen dokumentiert:\\n\\n1. **Zwei-Gesichter-Prinzip:** Strikte Trennung von menschenlesbaren Markdown-Notizen und maschinell operierbaren Companion-Dateien (*.tasks.json, *.chart.json).\\n2. **Local-First & Vektor-PDF:** Rendering über Headless Chromium mit klickbarem Inhaltsverzeichnis.\\n3. **Provider-Unabhängigkeit:** Unterstützung für lokale Modelle via Ollama sowie Cloud-Provider.',
                timestamp: Date.now() - 40000,
                sources: [
                  {
                    title: 'Architektur & Companion-Spezifikation',
                    relativePath: 'knowledge/architecture.md',
                    uri: 'file:///workspace/knowledge/architecture.md',
                    snippet: 'Janus verbindet Markdown-Notizen mit strukturierten Companion-Dateien...'
                  }
                ],
                actions: [
                  { label: 'Alle Aufgaben öffnen', actionType: 'openAllTasks' },
                  { label: 'Notiz im Editor öffnen', actionType: 'openNote' }
                ]
              },
              {
                id: '3',
                sender: 'user',
                text: 'Welche Aufgaben sind noch offen?',
                timestamp: Date.now() - 10000
              }
            ]
          }
        }));
      }, 80);
    });
  </script>
</body>
</html>`;

const chatPath = path.join('/tmp', 'screenshot-chat.html');
fs.writeFileSync(chatPath, chatSidebarHtml);
capture(chatPath, path.join(assetsDir, '02-ai-chat-sidebar.png'), 420, 720);

// ---------------------------------------------------------------------------
// 5. Hero Editor (01-hero-editor.png) - VS Code Frame with Editor & Sidebar
// ---------------------------------------------------------------------------
const heroHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Janus Note - VS Code Editor</title>
  <link rel="stylesheet" href="${workspaceRoot}/dist/webviews/globals.css">
  <style>
    ${commonCssVars}
    * { box-sizing: border-box; }
    body {
      background-color: #181818;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 16px;
      width: 1280px;
      height: 800px;
      overflow: hidden;
    }
    .window {
      width: 100%;
      height: 100%;
      background: #1e1e1e;
      border-radius: 10px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .titlebar {
      height: 38px;
      background: #323233;
      display: flex;
      align-items: center;
      padding: 0 16px;
      font-size: 12px;
      color: #999;
      position: relative;
    }
    .traffic-lights {
      display: flex;
      gap: 7px;
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .title {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      color: #cccccc;
      font-weight: 500;
    }
    .main-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .activitybar {
      width: 48px;
      background: #333333;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 12px;
      gap: 16px;
    }
    .sidebar {
      width: 260px;
      background: #252526;
      border-right: 1px solid rgba(128,128,128,0.2);
      display: flex;
      flex-direction: column;
    }
    .editor-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
    }
    .tabs {
      height: 35px;
      background: #252526;
      display: flex;
      border-bottom: 1px solid #1e1e1e;
    }
    .tab {
      padding: 0 16px;
      height: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #999;
      background: #2d2d2d;
      border-right: 1px solid #1e1e1e;
    }
    .tab.active {
      color: #fff;
      background: #1e1e1e;
      border-top: 2px solid #007acc;
    }
  </style>
  <script>
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {},
        getState: function() { return {}; },
        setState: function() {}
      };
    };
  </script>
</head>
<body>
  <div class="window">
    <div class="titlebar">
      <div class="traffic-lights">
        <div class="dot" style="background: #ff5f56;"></div>
        <div class="dot" style="background: #ffbd2e;"></div>
        <div class="dot" style="background: #27c93f;"></div>
      </div>
      <div class="title">project-plan.md — Janus Note — Visual Studio Code</div>
    </div>

    <div class="main-body">
      <!-- Activity Bar -->
      <div class="activitybar">
        <div style="width: 36px; height: 36px; background: rgba(0,122,204,0.25); border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#007acc" stroke-width="2">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H12v20H6.5a2.5 2.5 0 0 1-2.5-2.5z"/>
            <path d="M12 2h5.5A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5H12"/>
          </svg>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <!-- Notes Tree -->
        <div style="padding: 10px 14px; font-size: 11px; font-weight: bold; color: #bbbbbb; letter-spacing: 0.5px;">JANUS NOTE</div>
        <div style="flex: 1; padding: 0 12px; font-size: 12px; overflow-y: auto;">
          <div style="padding: 4px 0; font-weight: 600; color: #ccc;">📁 projects / App-Launch</div>
          <div style="padding: 4px 0 4px 16px; color: #fff; background: #094771; border-radius: 4px; display: flex; align-items: center; gap: 6px;">
            <span>📄</span> <span>project-plan.md</span>
          </div>
          <div style="padding: 4px 0 4px 30px; color: #388bfd; font-size: 11px;">✓ project-plan.tasks.json</div>
          <div style="padding: 4px 0 4px 30px; color: #cca700; font-size: 11px;">📈 project-plan.chart.json</div>
          <div style="padding: 4px 0 4px 16px; color: #aaa;">📄 kickoff.md</div>
          <div style="padding: 6px 0; font-weight: 600; color: #ccc;">📁 meetings</div>
          <div style="padding: 4px 0 4px 16px; color: #aaa;">📄 2026-10-23-sync.md</div>
          <div style="padding: 6px 0; font-weight: 600; color: #ccc;">📁 knowledge</div>
          <div style="padding: 4px 0 4px 16px; color: #aaa;">📄 architecture.md</div>
          <div style="padding: 6px 0; font-weight: 600; color: #ccc;">📥 inbox.md</div>
        </div>

        <!-- Sidebar Chat Webview -->
        <div style="height: 300px; border-top: 1px solid rgba(128,128,128,0.25);">
          <iframe src="file:///tmp/screenshot-chat.html" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
      </div>

      <!-- Main Editor -->
      <div class="editor-pane">
        <div class="tabs">
          <div class="tab active">
            <span>📄</span>
            <span>project-plan.md</span>
            <span style="opacity: 0.6; margin-left: 6px;">×</span>
          </div>
          <div class="tab">
            <span>📄</span>
            <span>inbox.md</span>
          </div>
        </div>

        <!-- Embed the real CodeMirror Markdown Editor app -->
        <div style="flex: 1; position: relative;">
          <iframe id="editor-frame" src="file:///tmp/screenshot-editor-inner.html" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

// Create inner editor HTML
const editorInnerHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="${workspaceRoot}/dist/webviews/globals.css">
  <style>
    ${commonCssVars}
    body {
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
  </style>
  <script id="initial-data" type="application/json">
  {
    "content": "# Q4 Produkt-Release & Architekturplan\\n\\nDieses Dokument definiert die Kernmeilensteine für das Release. Verknüpft mit [[knowledge/architecture]].\\n\\n## Aufgaben & Status\\n\\n- [x] CodeMirror 6 Live-Vorschau Editor fertigstellen\\n- [x] Vektor-PDF Export mit Headless Chromium & Inhaltsverzeichnis\\n- [ ] Janus KI-Sidebar mit Provider-unabhängigem Chat aktivieren @2026-10-25\\n\\n## Sprint-Ressourcen\\n\\n| Modul | Companion Datei | Status | Zuständig |\\n| --- | --- | --- | --- |\\n| Aufgaben-Engine | project-plan.tasks.json | Aktiv | Janus Core |\\n| Diagramm-Engine | project-plan.chart.json | Bereit | Mermaid & D3 |\\n\\n*Erstellt mit Janus Note für VS Code.*"
  }
  </script>
  <script>
    window.acquireVsCodeApi = function() {
      return {
        postMessage: function(msg) {},
        getState: function() { return {}; },
        setState: function() {}
      };
    };
  </script>
</head>
<body>
  <div id="root" style="height: 100%;"></div>
  <script src="${workspaceRoot}/dist/webviews/markdown.js"></script>
</body>
</html>`;

fs.writeFileSync(path.join('/tmp', 'screenshot-editor-inner.html'), editorInnerHtml);
fs.writeFileSync(path.join('/tmp', 'screenshot-hero.html'), heroHtml);
capture(path.join('/tmp', 'screenshot-hero.html'), path.join(assetsDir, '01-hero-editor.png'), 1280, 800);

console.log('🎉 All real PNG screenshots generated successfully in assets/screenshots/ !');
