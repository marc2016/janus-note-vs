// Polyfill globalThis.navigator for Node.js < 21 environments (e.g. Node 18/20 in GitHub Actions CI)
// where browser-oriented packages like codemirror-markdown-tables read `navigator.language` at import time.
if (typeof globalThis.navigator === 'undefined') {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      language: 'en-US',
      languages: ['en-US', 'en'],
      userAgent: 'node',
      platform: process.platform,
    },
    configurable: true,
    writable: true,
  });
}

