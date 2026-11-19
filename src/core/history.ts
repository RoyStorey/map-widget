export interface HistoryEntry {
  label: string;
  undo: () => void;
  redo: () => void;
}

/** Linear undo/redo stack. */
export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  constructor(private limit = 100, private onChange: () => void = () => {}) {}

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
  }

  undo(): string | null {
    const e = this.undoStack.pop();
    if (!e) return null;
    e.undo();
    this.redoStack.push(e);
    this.onChange();
    return e.label;
  }

  redo(): string | null {
    const e = this.redoStack.pop();
    if (!e) return null;
    e.redo();
    this.undoStack.push(e);
    this.onChange();
    return e.label;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange();
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get nextUndoLabel() { return this.undoStack[this.undoStack.length - 1]?.label; }
  get nextRedoLabel() { return this.redoStack[this.redoStack.length - 1]?.label; }
}
