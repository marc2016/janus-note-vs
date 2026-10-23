import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { pathToFileURL } from 'url';
import { execFile } from 'child_process';
import { marked } from 'marked';
import { findChromiumBrowser } from './browserLocator';

export interface CompilePrintHtmlOptions {
  noteFilePath?: string;
  title?: string;
  customCss?: string;
  mermaidScriptUrl?: string;
}

export interface CompendiumNoteInput {
  markdown: string;
  filePath: string;
  title?: string;
}

export interface CompileMultiNotePrintHtmlOptions {
  title?: string;
  includeToc?: boolean;
  customCss?: string;
  mermaidScriptUrl?: string;
}

export interface ExportPdfOptions {
  markdown: string;
  outputPath: string;
  noteFilePath?: string;
  title?: string;
  browserPath?: string;
  timeoutMs?: number;
  customCss?: string;
  execFileFn?: typeof execFile;
  findBrowserFn?: typeof findChromiumBrowser;
}

export interface ExportCompendiumOptions {
  notes: CompendiumNoteInput[];
  outputPath: string;
  title?: string;
  includeToc?: boolean;
  browserPath?: string;
  timeoutMs?: number;
  customCss?: string;
  execFileFn?: typeof execFile;
  findBrowserFn?: typeof findChromiumBrowser;
}

export const DEFAULT_PRINT_CSS = `
@page {
  size: A4;
  margin: 20mm;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

*, *:before, *:after {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #1a1a1a;
  background-color: #ffffff;
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  color: #111111;
  font-weight: 600;
  margin-top: 1.4em;
  margin-bottom: 0.6em;
  page-break-after: avoid;
  break-after: avoid;
}

h1 { font-size: 20pt; border-bottom: 1.5px solid #eaeaea; padding-bottom: 0.3em; margin-top: 0; }
h2 { font-size: 15pt; border-bottom: 1px solid #eaeaea; padding-bottom: 0.2em; }
h3 { font-size: 13pt; }
h4 { font-size: 11pt; }

p, ul, ol, dl {
  margin-top: 0;
  margin-bottom: 1em;
}

li {
  margin-bottom: 0.3em;
}

ul.task-list, ul:has(.task-checkbox) {
  list-style: none;
  padding-left: 0;
}

li:has(.task-checkbox) {
  list-style: none;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.task-checkbox {
  display: inline-block;
  width: 14px;
  height: 14px;
  min-width: 14px;
  min-height: 14px;
  border: 1.5px solid #4a5568;
  border-radius: 3px;
  margin-right: 6px;
  vertical-align: middle;
  position: relative;
  top: 1px;
}

.task-checkbox.checked {
  background-color: #2563eb;
  border-color: #2563eb;
}

.task-checkbox.checked::after {
  content: "";
  position: absolute;
  left: 3.5px;
  top: 0.5px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

blockquote {
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #4a5568;
  border-left: 4px solid #cbd5e0;
  background-color: #f7fafc;
  page-break-inside: avoid;
  break-inside: avoid;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1.2em;
  page-break-inside: avoid;
  break-inside: avoid;
  font-size: 10pt;
}

th, td {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
}

th {
  background-color: #f7fafc;
  font-weight: 600;
  color: #2d3748;
}

tr:nth-child(even) td {
  background-color: #fcfcfc;
}

pre, code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

code {
  font-size: 0.9em;
  background-color: #f1f5f9;
  color: #0f172a;
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

pre {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  page-break-inside: avoid;
  break-inside: avoid;
}

pre code {
  background-color: transparent;
  padding: 0;
  font-size: 9.5pt;
  color: inherit;
}

img {
  max-width: 100%;
  height: auto;
  page-break-inside: avoid;
  break-inside: avoid;
}

.mermaid {
  text-align: center;
  margin: 1.5em 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
`;

export function resolveImageSource(src: string, noteFilePath?: string): string {
  if (!src) return src;
  if (/^(https?:|data:|file:)/i.test(src)) {
    return src;
  }
  if (!noteFilePath) {
    return src;
  }

  const noteDir = path.dirname(noteFilePath);
  const absolutePath = path.isAbsolute(src) ? src : path.resolve(noteDir, src);
  return pathToFileURL(absolutePath).href;
}

export function findLocalMermaidScript(): string | null {
  // Check common node_modules paths
  const candidatePaths = [
    path.join(__dirname, '../../node_modules/mermaid/dist/mermaid.min.js'),
    path.join(__dirname, '../node_modules/mermaid/dist/mermaid.min.js'),
    path.join(process.cwd(), 'node_modules/mermaid/dist/mermaid.min.js'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }

  return null;
}

export function formatMarkdownHtml(
  rawMarkdown: string,
  noteFilePath?: string
): { html: string; hasMermaid: boolean } {
  let rawHtml = marked.parse(rawMarkdown, {
    async: false,
    gfm: true,
    breaks: true,
  }) as string;

  rawHtml = rawHtml.replace(
    /<input[^>]*checked[^>]*type=["']checkbox["'][^>]*>/gi,
    '<span class="task-checkbox checked"></span>'
  );
  rawHtml = rawHtml.replace(
    /<input[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi,
    '<span class="task-checkbox checked"></span>'
  );
  rawHtml = rawHtml.replace(
    /<input[^>]*type=["']checkbox["'][^>]*>/gi,
    '<span class="task-checkbox unchecked"></span>'
  );

  if (noteFilePath) {
    rawHtml = rawHtml.replace(
      /<img([^>]+)src=["']([^"']+)["']([^>]*)>/gi,
      (_match, before, src, after) => {
        const resolvedSrc = resolveImageSource(src, noteFilePath);
        return `<img${before}src="${resolvedSrc}"${after}>`;
      }
    );
  }

  const hasMermaid = /class=["']language-mermaid["']/i.test(rawHtml);
  if (hasMermaid) {
    rawHtml = rawHtml.replace(
      /<pre><code class=["']language-mermaid["']>([\s\S]*?)<\/code><\/pre>/gi,
      (_match, code) => {
        const unescaped = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        return `<div class="mermaid">${unescaped}</div>`;
      }
    );
  }

  return { html: rawHtml, hasMermaid };
}

export function compileNoteToPrintHtml(
  markdown: string,
  options: CompilePrintHtmlOptions = {}
): string {
  const formatted = formatMarkdownHtml(markdown, options.noteFilePath);
  const title = options.title || 'Janus Note';
  const customCss = options.customCss || '';
  const mermaidScriptUrl =
    options.mermaidScriptUrl || findLocalMermaidScript() || 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

  const mermaidScripts = formatted.hasMermaid
    ? `
  <script src="${mermaidScriptUrl}"></script>
  <script>
    try {
      mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
    } catch (e) {
      console.error('Mermaid initialization failed', e);
    }
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
${DEFAULT_PRINT_CSS}
${customCss}
  </style>
</head>
<body>
  <div class="note-container">
${formatted.html}
  </div>
${mermaidScripts}
</body>
</html>`;
}

export function compileMultiNoteToPrintHtml(
  notes: CompendiumNoteInput[],
  options: CompileMultiNotePrintHtmlOptions = {}
): string {
  const compendiumTitle = options.title || 'Janus Note Kompendium';
  const includeToc = options.includeToc !== false;
  let anyMermaid = false;

  let tocHtml = '';
  if (includeToc) {
    const tocItems = notes
      .map((note, index) => {
        const noteTitle = note.title || path.basename(note.filePath, path.extname(note.filePath));
        return `<li class="toc-item"><a href="#note-${index}" class="toc-link"><span class="toc-title">${noteTitle}</span><span class="toc-dot-leader"></span></a></li>`;
      })
      .join('\n');

    tocHtml = `
    <div class="toc-page">
      <h1 class="toc-main-title">${compendiumTitle}</h1>
      <h2 class="toc-heading">Inhaltsverzeichnis</h2>
      <ul class="toc-list">
        ${tocItems}
      </ul>
    </div>
    <div style="page-break-after: always;"></div>`;
  }

  const notesHtml = notes
    .map((note, index) => {
      const noteTitle = note.title || path.basename(note.filePath, path.extname(note.filePath));
      const formatted = formatMarkdownHtml(note.markdown, note.filePath);
      if (formatted.hasMermaid) {
        anyMermaid = true;
      }
      const breakBefore = includeToc || index > 0 ? 'style="page-break-before: always;"' : '';
      return `
    <section id="note-${index}" class="note-section" ${breakBefore}>
      <header class="note-header">
        <h1 class="note-title">${noteTitle}</h1>
      </header>
      <div class="note-content">
        ${formatted.html}
      </div>
    </section>`;
    })
    .join('\n');

  const customCss = options.customCss || '';
  const mermaidScriptUrl =
    options.mermaidScriptUrl || findLocalMermaidScript() || 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

  const mermaidScripts = anyMermaid
    ? `
  <script src="${mermaidScriptUrl}"></script>
  <script>
    try {
      mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
    } catch (e) {
      console.error('Mermaid initialization failed', e);
    }
  </script>`
    : '';

  const tocCss = `
.toc-page {
  padding-top: 2em;
}
.toc-main-title {
  font-size: 26pt;
  margin-bottom: 0.3em;
  color: #0f172a;
}
.toc-heading {
  font-size: 16pt;
  color: #64748b;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.4em;
  margin-bottom: 1.5em;
}
.toc-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}
.toc-item {
  margin-bottom: 0.8em;
}
.toc-link {
  display: flex;
  align-items: baseline;
  text-decoration: none;
  color: #1e293b;
  font-size: 12pt;
  font-weight: 500;
}
.toc-link:hover {
  color: #2563eb;
}
.toc-dot-leader {
  flex-grow: 1;
  border-bottom: 1px dotted #cbd5e1;
  margin: 0 8px;
}
.note-section {
  margin-bottom: 2em;
}
.note-header {
  border-bottom: 1.5px solid #eaeaea;
  margin-bottom: 1.2em;
}
.note-header .note-title {
  font-size: 20pt;
  margin: 0 0 0.3em 0;
}
`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>${compendiumTitle}</title>
  <style>
${DEFAULT_PRINT_CSS}
${tocCss}
${customCss}
  </style>
</head>
<body>
  <div class="compendium-container">
${tocHtml}
${notesHtml}
  </div>
${mermaidScripts}
</body>
</html>`;
}

export class PdfExportService {
  constructor(private readonly customBrowserPath?: string) {}

  public async exportNoteToPdf(options: ExportPdfOptions): Promise<string> {
    const locateBrowser = options.findBrowserFn || findChromiumBrowser;
    const browserBinary = locateBrowser({
      customPath: options.browserPath || this.customBrowserPath,
    });

    if (!browserBinary) {
      throw new Error(
        'Kein Chromium-basierter Browser gefunden. Bitte installieren Sie Google Chrome, Microsoft Edge oder Brave, oder setzen Sie "janus.export.browserPath" in den Einstellungen.'
      );
    }

    const html = compileNoteToPrintHtml(options.markdown, {
      noteFilePath: options.noteFilePath,
      title: options.title,
      customCss: options.customCss,
    });

    // Write HTML to a temporary file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janus-pdf-'));
    const tempHtmlFile = path.join(tempDir, 'export.html');
    fs.writeFileSync(tempHtmlFile, html, 'utf-8');

    // Ensure output directory exists
    const outDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const args = [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--allow-file-access-from-files',
      `--print-to-pdf=${options.outputPath}`,
      tempHtmlFile,
    ];

    const runExecFile = options.execFileFn || execFile;
    const timeout = options.timeoutMs || 30000;

    try {
      await new Promise<void>((resolve, reject) => {
        runExecFile(browserBinary, args, { timeout }, (error, _stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `PDF-Generierung fehlgeschlagen: ${error.message}${
                  stderr ? `\n${stderr}` : ''
                }`
              )
            );
          } else {
            resolve();
          }
        });
      });

      return options.outputPath;
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(tempHtmlFile)) {
          fs.unlinkSync(tempHtmlFile);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      } catch {
        // Ignore temp cleanup errors
      }
    }
  }

  public async exportCompendiumToPdf(options: ExportCompendiumOptions): Promise<string> {
    const locateBrowser = options.findBrowserFn || findChromiumBrowser;
    const browserBinary = locateBrowser({
      customPath: options.browserPath || this.customBrowserPath,
    });

    if (!browserBinary) {
      throw new Error(
        'Kein Chromium-basierter Browser gefunden. Bitte installieren Sie Google Chrome, Microsoft Edge oder Brave, oder setzen Sie "janus.export.browserPath" in den Einstellungen.'
      );
    }

    const html = compileMultiNoteToPrintHtml(options.notes, {
      title: options.title,
      includeToc: options.includeToc,
      customCss: options.customCss,
    });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janus-compendium-'));
    const tempHtmlFile = path.join(tempDir, 'compendium.html');
    fs.writeFileSync(tempHtmlFile, html, 'utf-8');

    const outDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const args = [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--allow-file-access-from-files',
      `--print-to-pdf=${options.outputPath}`,
      tempHtmlFile,
    ];

    const runExecFile = options.execFileFn || execFile;
    const timeout = options.timeoutMs || 45000;

    try {
      await new Promise<void>((resolve, reject) => {
        runExecFile(browserBinary, args, { timeout }, (error, _stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `Sammel-PDF-Generierung fehlgeschlagen: ${error.message}${
                  stderr ? `\n${stderr}` : ''
                }`
              )
            );
          } else {
            resolve();
          }
        });
      });

      return options.outputPath;
    } finally {
      try {
        if (fs.existsSync(tempHtmlFile)) {
          fs.unlinkSync(tempHtmlFile);
        }
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      } catch {
        // Ignore temp cleanup errors
      }
    }
  }
}
