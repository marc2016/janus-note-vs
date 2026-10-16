import React from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownEditorApp } from './MarkdownEditorApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MarkdownEditorApp />);
}
