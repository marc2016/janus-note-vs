import React from 'react';
import { createRoot } from 'react-dom/client';
import { DiagramViewApp } from './DiagramViewApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<DiagramViewApp />);
}
