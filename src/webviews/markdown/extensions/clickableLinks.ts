import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

export interface ClickableLinksOptions {
  onOpenLink: (target: string, linkType?: string) => void;
}

/**
 * CodeMirror 6 extension that makes `.cm-link-text` inline elements interactive.
 * Intercepts mousedown/mouseup/click to ensure direct click navigation without
 * modifier keys, while avoiding caret-placement interference during clicks.
 */
export function clickableLinks(options: ClickableLinksOptions): Extension {
  let pendingClick: { target: string; linkType?: string; x: number; y: number } | null = null;
  let lastOpenTime = 0;

  const triggerOpen = (target: string, linkType?: string) => {
    const now = Date.now();
    if (now - lastOpenTime > 300) {
      lastOpenTime = now;
      options.onOpenLink(target, linkType);
    }
  };

  return EditorView.domEventHandlers({
    mousedown(event, _view) {
      // Allow Alt+Click to place the cursor normally for editing
      if (event.button !== 0 || event.altKey) {
        pendingClick = null;
        return false;
      }

      const targetEl = event.target as HTMLElement | null;
      const linkEl = targetEl?.closest?.('.cm-link-text') as HTMLElement | null;
      if (!linkEl) {
        pendingClick = null;
        return false;
      }

      const target = linkEl.getAttribute('data-link-target');
      if (!target) {
        pendingClick = null;
        return false;
      }

      pendingClick = {
        target,
        linkType: linkEl.getAttribute('data-link-type') ?? undefined,
        x: event.clientX,
        y: event.clientY,
      };

      // Prevent CodeMirror from moving the caret or replacing the DOM span on mousedown
      event.preventDefault();
      return true;
    },

    mouseup(event, _view) {
      if (!pendingClick) return false;

      const dist = Math.hypot(event.clientX - pendingClick.x, event.clientY - pendingClick.y);
      const { target, linkType } = pendingClick;
      pendingClick = null;

      if (dist < 10) {
        event.preventDefault();
        event.stopPropagation();
        triggerOpen(target, linkType);
        return true;
      }
      return false;
    },

    click(event, _view) {
      if (event.button !== 0 || event.altKey) return false;

      const targetEl = event.target as HTMLElement | null;
      const linkEl = targetEl?.closest?.('.cm-link-text') as HTMLElement | null;
      if (!linkEl) return false;

      const target = linkEl.getAttribute('data-link-target');
      if (!target) return false;

      event.preventDefault();
      event.stopPropagation();
      triggerOpen(target, linkEl.getAttribute('data-link-type') ?? undefined);
      return true;
    },
  });
}

