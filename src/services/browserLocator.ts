import * as fs from 'fs';
import * as path from 'path';

export interface BrowserLocatorOptions {
  customPath?: string;
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  existsSync?: (filePath: string) => boolean;
}

export function getBrowserCandidates(
  platform: NodeJS.Platform = process.platform,
  env: Record<string, string | undefined> = process.env
): string[] {
  const home = env.HOME || '';

  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      path.join(home, 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      path.join(home, 'Applications/Brave Browser.app/Contents/MacOS/Brave Browser'),
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(home, 'Applications/Chromium.app/Contents/MacOS/Chromium'),
    ];
  }

  if (platform === 'win32') {
    const programFiles = env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = env.LOCALAPPDATA || 'C:\\Users\\Default\\AppData\\Local';

    return [
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFiles, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
      path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
    ];
  }

  // Linux and other platforms
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/usr/bin/brave-browser',
    '/snap/bin/chromium',
  ];
}

export function findChromiumBrowser(options: BrowserLocatorOptions = {}): string | null {
  const exists = options.existsSync || fs.existsSync;
  const customPath = options.customPath?.trim();

  if (customPath) {
    if (exists(customPath)) {
      return customPath;
    }
  }

  const candidates = getBrowserCandidates(options.platform, options.env);
  for (const candidate of candidates) {
    if (exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

