import { describe, it, expect, vi } from 'vitest';
import { EditorState, TransactionSpec } from '@codemirror/state';
import { history } from '@codemirror/commands';
import { handleUndoRedoKey, undoRedoCommand } from '../src/webviews/markdown/lib/undoRedo';

const key = (k: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe('undoRedoCommand', () => {
  it('maps the Mac shortcuts', () => {
    expect(undoRedoCommand(key('z', { metaKey: true }), true)).toBe('undo');
    expect(undoRedoCommand(key('Z', { metaKey: true, shiftKey: true }), true)).toBe('redo');
    expect(undoRedoCommand(key('z', { ctrlKey: true }), true)).toBeUndefined();
    expect(undoRedoCommand(key('y', { metaKey: true }), true)).toBeUndefined();
  });

  it('maps the Windows/Linux shortcuts', () => {
    expect(undoRedoCommand(key('z', { ctrlKey: true }), false)).toBe('undo');
    expect(undoRedoCommand(key('z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo');
    expect(undoRedoCommand(key('y', { ctrlKey: true }), false)).toBe('redo');
    expect(undoRedoCommand(key('z', { metaKey: true }), false)).toBeUndefined();
  });

  it('ignores Alt combinations and other keys', () => {
    expect(undoRedoCommand(key('z', { metaKey: true, altKey: true }), true)).toBeUndefined();
    expect(undoRedoCommand(key('a', { metaKey: true }), true)).toBeUndefined();
    expect(undoRedoCommand(key('z'), true)).toBeUndefined();
  });
});

describe('handleUndoRedoKey', () => {
  function fakeView(doc: string) {
    const view = {
      state: EditorState.create({ doc, extensions: [history()] }),
      dispatch(spec: TransactionSpec | any) {
        view.state = (spec.state ? spec : view.state.update(spec)).state;
      },
    };
    return view;
  }

  it('undoes and redoes one step and stops the key from reaching VS Code', () => {
    const view = fakeView('Termin am Freitag\nRest');
    view.dispatch({ changes: { from: 0, to: 18 }, userEvent: 'delete' });
    expect(view.state.doc.toString()).toBe('Rest');

    const undoKey = key('z', { metaKey: true });
    expect(handleUndoRedoKey(view as any, undoKey as any, true)).toBe(true);
    expect(view.state.doc.toString()).toBe('Termin am Freitag\nRest');
    expect(undoKey.preventDefault).toHaveBeenCalled();
    expect(undoKey.stopPropagation).toHaveBeenCalled();

    handleUndoRedoKey(view as any, key('z', { metaKey: true, shiftKey: true }) as any, true);
    expect(view.state.doc.toString()).toBe('Rest');
  });

  it('leaves other keys alone', () => {
    const view = fakeView('x');
    const other = key('b', { metaKey: true });
    expect(handleUndoRedoKey(view as any, other as any, true)).toBe(false);
    expect(other.stopPropagation).not.toHaveBeenCalled();
  });
});
