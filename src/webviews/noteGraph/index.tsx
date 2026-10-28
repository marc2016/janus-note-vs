import React from 'react';
import { createRoot } from 'react-dom/client';
import { NoteGraphApp } from './NoteGraphApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<NoteGraphApp />);
}
