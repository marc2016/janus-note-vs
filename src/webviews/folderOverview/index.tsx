import React from 'react';
import { createRoot } from 'react-dom/client';
import { FolderOverviewApp } from './FolderOverviewApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<FolderOverviewApp />);
}

