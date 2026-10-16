import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    alias: {
      vscode: path.resolve(__dirname, './tests/__mocks__/vscode.ts'),
    },
  },
});
