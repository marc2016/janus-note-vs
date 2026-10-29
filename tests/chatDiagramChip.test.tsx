import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiagramContextChip } from '../src/webviews/chat/JanusChatApp';

describe('DiagramContextChip', () => {
  it('shows the diagram label and a remove button', () => {
    const markup = renderToStaticMarkup(
      <DiagramContextChip context={{ label: 'Diagramm · project-plan.md, Zeile 54', line: 54 }} onRemove={() => {}} />
    );
    expect(markup).toContain('Diagramm · project-plan.md, Zeile 54');
    expect(markup).toContain('aria-label="Diagramm-Kontext entfernen"');
  });
});

describe('DiagramContextChip for a selection', () => {
  it('shows the selection label from the host', () => {
    const markup = renderToStaticMarkup(
      <DiagramContextChip context={{ label: 'Auswahl · plan.md, Zeilen 12–15', line: 12 }} onRemove={() => {}} />
    );
    expect(markup).toContain('Auswahl · plan.md, Zeilen 12–15');
  });
});
