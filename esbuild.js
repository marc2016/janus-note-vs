const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

function buildTailwind() {
  if (!fs.existsSync('dist/webviews')) {
    fs.mkdirSync('dist/webviews', { recursive: true });
  }
  execSync('npx @tailwindcss/cli -i src/webviews/styles/globals.css -o dist/webviews/globals.css', {
    stdio: 'inherit',
  });
}

async function build() {
  buildTailwind();

  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    sourcemap: true,
    minify: false,
    logLevel: 'info',
  });

  const webviewsCtx = await esbuild.context({
    entryPoints: {
      tasks: 'src/webviews/tasks/index.tsx',
      chart: 'src/webviews/chart/index.tsx',
      markdown: 'src/webviews/markdown/index.tsx',
      settings: 'src/webviews/settings/index.tsx',
      calendar: 'src/webviews/calendar/index.tsx',
      folderOverview: 'src/webviews/folderOverview/index.tsx',
      exportCompendium: 'src/webviews/exportCompendium/index.tsx',
      chat: 'src/webviews/chat/index.tsx',
      noteGraph: 'src/webviews/noteGraph/index.tsx',
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    outdir: 'dist/webviews',
    sourcemap: true,
    minify: false,
    logLevel: 'info',
    define: {
      'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
    },
  });

  if (isWatch) {
    await Promise.all([extensionCtx.watch(), webviewsCtx.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewsCtx.rebuild()]);
    await Promise.all([extensionCtx.dispose(), webviewsCtx.dispose()]);
    console.log('Build completed successfully.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
