import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { Range, Extension } from '@codemirror/state';

class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly bracketPos: number
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.bracketPos === other.bracketPos;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-task-widget-wrap';
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.marginRight = '6px';
    wrap.style.userSelect = 'none';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cm-task-checkbox';
    checkbox.checked = this.checked;
    checkbox.style.cursor = 'pointer';
    checkbox.style.margin = '0';
    checkbox.style.width = '14px';
    checkbox.style.height = '14px';
    checkbox.style.accentColor = 'var(--vscode-checkbox-selectBackground, #007acc)';

    checkbox.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    checkbox.addEventListener('change', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nextChar = this.checked ? ' ' : 'x';
      // Pos + 1 is the character between '[' and ']'
      view.dispatch({
        changes: {
          from: this.bracketPos + 1,
          to: this.bracketPos + 2,
          insert: nextChar,
        },
      });
    });

    wrap.appendChild(checkbox);
    return wrap;
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click' || event.type === 'change';
  }
}

export const taskCheckboxTheme = EditorView.baseTheme({
  '.cm-task-checkbox': {
    verticalAlign: 'middle',
  },
  '.cm-line.cm-task-checked': {
    opacity: '0.7',
  },
});

function buildCheckboxDecorations(view: EditorView): DecorationSet {
  const builder: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      // Match list item with checkbox: optional indent + bullet + space + [ ] or [x]
      const match = line.text.match(/^(\s*[-*+]\s+)\[([ xX])\]/);
      if (match) {
        const prefixLen = match[1].length;
        const bracketPos = line.from + prefixLen;
        const isChecked = match[2].toLowerCase() === 'x';

        // Add line decoration if checked
        if (isChecked) {
          builder.push(
            Decoration.line({
              class: 'cm-task-checked',
            }).range(line.from)
          );
        }

        // Replace the `[ ]` or `[x]` (3 characters) with the interactive checkbox widget
        builder.push(
          Decoration.replace({
            widget: new TaskCheckboxWidget(isChecked, bracketPos),
          }).range(bracketPos, bracketPos + 3)
        );
      }

      if (line.to >= view.state.doc.length) break;
      pos = line.to + 1;
    }
  }

  return Decoration.set(builder, true);
}

export const taskCheckboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCheckboxDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCheckboxDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

export function taskCheckboxes(): Extension {
  return [taskCheckboxTheme, taskCheckboxPlugin];
}
