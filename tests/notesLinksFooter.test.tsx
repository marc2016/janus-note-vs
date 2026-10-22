import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  NotesLinksFooter,
  NoteLinksData,
} from '../src/webviews/markdown/components/NotesLinksFooter';

describe('NotesLinksFooter Component', () => {
  it('renders backlinks with line number badges if lineNumber is present', () => {
    const linksData: NoteLinksData = {
      noteUri: 'file:///workspace/notes/target.md',
      companions: {},
      outgoingLinks: [],
      backlinks: [
        {
          title: 'SourceNote',
          target: 'target',
          uri: 'file:///workspace/notes/source.md',
          relativePath: 'source.md',
          exists: true,
          lineNumber: 24,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <NotesLinksFooter
        linksData={linksData}
        onOpenLink={() => {}}
      />
    );

    expect(markup).toContain('SourceNote :24');
    expect(markup).toContain('janus-pill-backlink');
    expect(markup).toContain('Zeile 24');
  });

  it('renders outgoing links with line number badges if lineNumber is present', () => {
    const linksData: NoteLinksData = {
      noteUri: 'file:///workspace/notes/source.md',
      companions: {},
      outgoingLinks: [
        {
          title: 'TargetNote',
          target: 'TargetNote:42',
          uri: 'file:///workspace/notes/target.md',
          relativePath: 'target.md',
          exists: true,
          lineNumber: 42,
        },
      ],
      backlinks: [],
    };

    const markup = renderToStaticMarkup(
      <NotesLinksFooter
        linksData={linksData}
        onOpenLink={() => {}}
      />
    );

    expect(markup).toContain('TargetNote :42');
    expect(markup).toContain('janus-pill-link');
  });

  it('renders links without line numbers when lineNumber is not defined', () => {
    const linksData: NoteLinksData = {
      noteUri: 'file:///workspace/notes/source.md',
      companions: {},
      outgoingLinks: [
        {
          title: 'TargetNote',
          target: 'TargetNote',
          uri: 'file:///workspace/notes/target.md',
          relativePath: 'target.md',
          exists: true,
        },
      ],
      backlinks: [
        {
          title: 'SourceNote',
          target: 'source',
          uri: 'file:///workspace/notes/source.md',
          relativePath: 'source.md',
          exists: true,
        },
      ],
    };

    const markup = renderToStaticMarkup(
      <NotesLinksFooter
        linksData={linksData}
        onOpenLink={() => {}}
      />
    );

    expect(markup).toContain('TargetNote');
    expect(markup).not.toContain('TargetNote :');
    expect(markup).toContain('SourceNote');
    expect(markup).not.toContain('SourceNote :');
  });
});
