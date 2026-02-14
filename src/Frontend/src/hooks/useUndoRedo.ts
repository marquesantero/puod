import { useState, useCallback, useRef } from "react";

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseUndoRedoReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T), addToHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  history: { past: number; future: number };
}

const MAX_HISTORY = 50; // Keep last 50 states

export function useUndoRedo<T>(initialState: T): UseUndoRedoReturn<T> {
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Track if we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false);

  const setState = useCallback(
    (newState: T | ((prev: T) => T), addToHistory: boolean = true) => {
      setUndoRedoState((current) => {
        const nextState = typeof newState === "function" ? (newState as (prev: T) => T)(current.present) : newState;

        // Don't add to history if state hasn't changed
        if (JSON.stringify(nextState) === JSON.stringify(current.present)) {
          return current;
        }

        // If we're in an undo/redo operation or explicitly told not to add to history
        if (isUndoRedoRef.current || !addToHistory) {
          return {
            ...current,
            present: nextState,
          };
        }

        // Add current state to past and update present
        const newPast = [...current.past, current.present].slice(-MAX_HISTORY);

        return {
          past: newPast,
          present: nextState,
          future: [], // Clear future on new change
        };
      });
    },
    []
  );

  const undo = useCallback(() => {
    setUndoRedoState((current) => {
      if (current.past.length === 0) return current;

      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, current.past.length - 1);

      isUndoRedoRef.current = true;

      // Use setTimeout to ensure the ref is set before state updates
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);

      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setUndoRedoState((current) => {
      if (current.future.length === 0) return current;

      const next = current.future[0];
      const newFuture = current.future.slice(1);

      isUndoRedoRef.current = true;

      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);

      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setUndoRedoState((current) => ({
      past: [],
      present: current.present,
      future: [],
    }));
  }, []);

  return {
    state: undoRedoState.present,
    setState,
    undo,
    redo,
    canUndo: undoRedoState.past.length > 0,
    canRedo: undoRedoState.future.length > 0,
    clearHistory,
    history: {
      past: undoRedoState.past.length,
      future: undoRedoState.future.length,
    },
  };
}

/**
 * Hook for keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
 */
export function useUndoRedoKeyboard(undo: () => void, redo: () => void, enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ctrl+Z or Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z (Mac) or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) || (e.ctrlKey && e.key === "y")) {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo, enabled]
  );

  // Attach/detach keyboard listeners
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }
}
