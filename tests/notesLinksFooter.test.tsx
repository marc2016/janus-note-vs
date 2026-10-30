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

  describe('sort button', () => {
    const linksData: NoteLinksData = {
      noteUri: 'file:///workspace/notes/inbox.md',
      companions: {},
      outgoingLinks: [],
      backlinks: [],
    };

    it('shows Inbox einsortieren by default', () => {
      const markup = renderToStaticMarkup(
        <NotesLinksFooter linksData={linksData} onOpenLink={() => {}} onAddLink={() => {}} onSortAiInbox={() => {}} />
      );
      expect(markup).toContain('Inbox einsortieren');
    });

    it('shows Tagesnotiz einsortieren for daily notes', () => {
      const markup = renderToStaticMarkup(
        <NotesLinksFooter
          linksData={linksData}
          onOpenLink={() => {}}
          onAddLink={() => {}}
          onSortAiInbox={() => {}}
          sortLabel="Tagesnotiz einsortieren"
        />
      );
      expect(markup).toContain('Tagesnotiz einsortieren');
      expect(markup).not.toContain('Inbox einsortieren');
    });

    it('shows no sort button without a sort handler', () => {
      const markup = renderToStaticMarkup(
        <NotesLinksFooter linksData={linksData} onOpenLink={() => {}} onAddLink={() => {}} />
      );
      expect(markup).not.toContain('einsortieren');
    });
  });
});

describe('folder links in the footer', () => {
  it('shows a folder link with the folder hint and opens it on click target', () => {
    const linksData: NoteLinksData = {
      noteUri: 'file:///workspace/notes/plan.md',
      companions: {},
      outgoingLinks: [
        {
          title: 'App-Launch',
          target: 'projects/App-Launch/',
          uri: 'file:///workspace/notes/projects/App-Launch',
          relativePath: 'projects/App-Launch/',
          exists: true,
          kind: 'folder',
        },
      ],
      backlinks: [],
    };
    const markup = renderToStaticMarkup(<NotesLinksFooter linksData={linksData} onOpenLink={() => {}} onAddLink={() => {}} />);
    expect(markup).toContain('App-Launch');
    expect(markup).toContain('Klicken, um die Ordnerübersicht zu öffnen');
  });
});
