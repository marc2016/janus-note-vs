import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import {
  compileNoteToPrintHtml,
  compileMultiNoteToPrintHtml,
  resolveImageSource,
  PdfExportService,
  DEFAULT_PRINT_CSS,
} from '../src/services/pdfExportService';

describe('pdfExportService', () => {
  describe('resolveImageSource', () => {
    it('leaves http and https URLs untouched', () => {
      expect(resolveImageSource('https://example.com/pic.png')).toBe(
        'https://example.com/pic.png'
      );
      expect(resolveImageSource('http://example.com/pic.png')).toBe(
        'http://example.com/pic.png'
      );
    });

    it('leaves data URLs untouched', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(resolveImageSource(dataUri)).toBe(dataUri);
    });

    it('resolves relative path against noteFilePath', () => {
      const notePath = path.resolve('/workspace/notes/test.md');
      const resolved = resolveImageSource('./images/diagram.png', notePath);
      expect(resolved.startsWith('file://')).toBe(true);
      expect(resolved).toContain('images/diagram.png');
    });
  });

  describe('compileNoteToPrintHtml', () => {
    it('compiles basic markdown headings and paragraphs', () => {
      const md = '# Main Title\n\nThis is a paragraph with **bold** text.';
      const html = compileNoteToPrintHtml(md, { title: 'Test Document' });

      expect(html).toContain('<title>Test Document</title>');
      expect(html).toContain('Main Title</h1>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain(DEFAULT_PRINT_CSS);
    });

    it('converts markdown task checkboxes to styled elements', () => {
      const md = '- [ ] Open Task\n- [x] Completed Task';
      const html = compileNoteToPrintHtml(md);

      expect(html).toContain('task-checkbox unchecked');
      expect(html).toContain('task-checkbox checked');
      expect(html).toContain('Open Task');
      expect(html).toContain('Completed Task');
    });

    it('resolves relative image tags in the markdown', () => {
      const md = '![Diagram](./assets/arch.png)';
      const notePath = path.resolve('/docs/note.md');
      const html = compileNoteToPrintHtml(md, { noteFilePath: notePath });

      expect(html).toContain('<img');
      expect(html).toContain('src="file://');
      expect(html).toContain('assets/arch.png');
    });

    it('transforms mermaid code block into div.mermaid and includes mermaid script', () => {
      const md = '```mermaid\ngraph TD;\n  A-->B;\n```';
      const html = compileNoteToPrintHtml(md);

      expect(html).toContain('<div class="mermaid">graph TD;\n  A-->B;\n</div>');
      expect(html).toContain('mermaid.initialize');
    });

    it('does not include mermaid script when no mermaid diagram exists', () => {
      const md = '# Plain Note\n\nNo diagrams here.';
      const html = compileNoteToPrintHtml(md);

      expect(html).not.toContain('mermaid.initialize');
      expect(html).not.toContain('<div class="mermaid">');
    });

    it('contains page break and A4 print CSS rules', () => {
      const html = compileNoteToPrintHtml('# Header');
      expect(html).toContain('size: A4');
      expect(html).toContain('break-inside: avoid');
      expect(html).toContain('break-after: avoid');
    });
  });

  describe('PdfExportService.exportNoteToPdf', () => {
    it('throws an error if no browser is found and no custom path is configured', async () => {
      const service = new PdfExportService();
      await expect(
        service.exportNoteToPdf({
          markdown: '# Note',
          outputPath: '/tmp/out.pdf',
          findBrowserFn: () => null,
        })
      ).rejects.toThrow('Kein Chromium-basierter Browser gefunden');
    });

    it('invokes browser binary with correct headless arguments', async () => {
      let executedBinary = '';
      let executedArgs: readonly string[] = [];

      const mockExecFile: any = (
        file: string,
        args: readonly string[],
        _opts: any,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        executedBinary = file;
        executedArgs = args;
        callback(null, '', '');
      };

      const customBrowser = path.resolve(__dirname, 'mock-browser');
      const service = new PdfExportService(customBrowser);

      // Pass an existing browser path for test (e.g. process.execPath which exists)
      const outputPath = path.resolve(__dirname, 'output.pdf');
      const result = await service.exportNoteToPdf({
        markdown: '# Test Note\nContent',
        outputPath,
        browserPath: process.execPath, // node binary exists
        execFileFn: mockExecFile,
      });

      expect(result).toBe(outputPath);
      expect(executedBinary).toBe(process.execPath);
      expect(executedArgs).toContain('--headless');
      expect(executedArgs).toContain('--disable-gpu');
      expect(executedArgs).toContain('--no-pdf-header-footer');
      expect(executedArgs).toContain(`--print-to-pdf=${outputPath}`);
    });

    it('handles execFile error properly', async () => {
      const mockExecFile: any = (
        _file: string,
        _args: readonly string[],
        _opts: any,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        callback(new Error('Process crashed'), '', 'Error output');
      };

      const service = new PdfExportService();
      await expect(
        service.exportNoteToPdf({
          markdown: '# Test',
          outputPath: '/tmp/test.pdf',
          browserPath: process.execPath,
          execFileFn: mockExecFile,
        })
      ).rejects.toThrow('PDF-Generierung fehlgeschlagen: Process crashed');
    });
  });

  describe('compileMultiNoteToPrintHtml', () => {
    const sampleNotes = [
      {
        title: 'Einführung',
        markdown: '# Einführung\n\nErster Inhalt.',
        filePath: '/notes/01-intro.md',
      },
      {
        title: 'Architektur',
        markdown: '# Architektur\n\nZweiter Inhalt:\n- [x] Done.',
        filePath: '/notes/02-arch.md',
      },
    ];

    it('generates a table of contents with internal anchor links when includeToc is true', () => {
      const html = compileMultiNoteToPrintHtml(sampleNotes, {
        title: 'Projekt Kompendium',
        includeToc: true,
      });

      expect(html).toContain('Projekt Kompendium');
      expect(html).toContain('Inhaltsverzeichnis</h2>');
      expect(html).toContain('href="#note-0"');
      expect(html).toContain('href="#note-1"');
      expect(html).toContain('id="note-0"');
      expect(html).toContain('id="note-1"');
      expect(html).toContain('Einführung</h1>');
      expect(html).toContain('Architektur</h1>');
      expect(html).toContain('page-break-before: always;');
      expect(html).toContain('task-checkbox checked');
    });

    it('omits table of contents when includeToc is false', () => {
      const html = compileMultiNoteToPrintHtml(sampleNotes, {
        includeToc: false,
      });

      expect(html).not.toContain('Inhaltsverzeichnis</h2>');
      expect(html).not.toContain('<ul class="toc-list">');
      expect(html).toContain('id="note-0"');
      expect(html).toContain('id="note-1"');
    });
  });

  describe('PdfExportService.exportCompendiumToPdf', () => {
    it('invokes browser binary with headless flags for compendium export', async () => {
      let executedBinary = '';
      let executedArgs: readonly string[] = [];

      const mockExecFile: any = (
        file: string,
        args: readonly string[],
        _opts: any,
        callback: (error: Error | null, stdout: string, stderr: string) => void
      ) => {
        executedBinary = file;
        executedArgs = args;
        callback(null, '', '');
      };

      const service = new PdfExportService();
      const outputPath = path.resolve(__dirname, 'compendium.pdf');
      const result = await service.exportCompendiumToPdf({
        notes: [
          {
            title: 'Note 1',
            markdown: '# Note 1',
            filePath: '/notes/note1.md',
          },
        ],
        outputPath,
        browserPath: process.execPath,
        execFileFn: mockExecFile,
      });

      expect(result).toBe(outputPath);
      expect(executedBinary).toBe(process.execPath);
      expect(executedArgs).toContain('--headless');
      expect(executedArgs).toContain(`--print-to-pdf=${outputPath}`);
    });
  });
});
