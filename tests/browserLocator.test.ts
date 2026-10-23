import { describe, it, expect } from 'vitest';
import { findChromiumBrowser, getBrowserCandidates } from '../src/services/browserLocator';

describe('browserLocator', () => {
  describe('getBrowserCandidates', () => {
    it('returns darwin candidate paths for macOS', () => {
      const candidates = getBrowserCandidates('darwin', { HOME: '/Users/test' });
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates).toContain('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
      expect(candidates).toContain('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    });

    it('returns win32 candidate paths for Windows', () => {
      const candidates = getBrowserCandidates('win32', {
        PROGRAMFILES: 'C:\\Program Files',
        'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
        LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local',
      });
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0]).toContain('chrome.exe');
    });

    it('returns linux candidate paths for Linux', () => {
      const candidates = getBrowserCandidates('linux', {});
      expect(candidates).toContain('/usr/bin/google-chrome');
      expect(candidates).toContain('/usr/bin/chromium');
    });
  });

  describe('findChromiumBrowser', () => {
    it('returns custom path if it exists', () => {
      const existsMock = (p: string) => p === '/custom/path/to/chrome';
      const result = findChromiumBrowser({
        customPath: '/custom/path/to/chrome',
        existsSync: existsMock,
      });
      expect(result).toBe('/custom/path/to/chrome');
    });

    it('ignores custom path if it does not exist and falls back to candidate', () => {
      const edgePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
      const existsMock = (p: string) => p === edgePath;
      const result = findChromiumBrowser({
        customPath: '/non/existent/browser',
        platform: 'darwin',
        existsSync: existsMock,
      });
      expect(result).toBe(edgePath);
    });

    it('returns first matching candidate on macOS', () => {
      const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      const existsMock = (p: string) => p === chromePath;
      const result = findChromiumBrowser({
        platform: 'darwin',
        existsSync: existsMock,
      });
      expect(result).toBe(chromePath);
    });

    it('returns null if no candidate exists', () => {
      const existsMock = () => false;
      const result = findChromiumBrowser({
        platform: 'darwin',
        existsSync: existsMock,
      });
      expect(result).toBeNull();
    });
  });
});

