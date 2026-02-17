import { useEffect, useCallback } from "react";

/**
 * Keyboard shortcuts para o canvas de dashboard.
 *
 * Atalhos suportados:
 *  - Ctrl+Z / Cmd+Z        → Undo
 *  - Ctrl+Shift+Z / Cmd+Shift+Z (ou Ctrl+Y) → Redo
 *  - Ctrl+S / Cmd+S        → Salvar dashboard
 *  - Delete / Backspace     → Remover card selecionado
 *  - Escape                 → Desselecionar card / fechar modal
 *  - Ctrl+A / Cmd+A        → Selecionar todos (futuro — emite callback)
 *  - Ctrl+D / Cmd+D        → Duplicar card selecionado
 *  - F11                    → Toggle fullscreen
 */

export interface CanvasShortcutsConfig {
  /** Chamado ao pressionar Ctrl+Z */
  onUndo: () => void;
  /** Chamado ao pressionar Ctrl+Shift+Z ou Ctrl+Y */
  onRedo: () => void;
  /** Chamado ao pressionar Ctrl+S */
  onSave: () => void;
  /** Chamado ao pressionar Delete/Backspace com card selecionado */
  onDeleteSelected?: () => void;
  /** Chamado ao pressionar Escape */
  onEscape?: () => void;
  /** Chamado ao pressionar Ctrl+D com card selecionado */
  onDuplicateSelected?: () => void;
  /** Chamado ao pressionar F11 */
  onToggleFullscreen?: () => void;

  /** Se true, o hook ignora todos os eventos (ex.: quando input tem foco) */
  disabled?: boolean;
}

export function useCanvasShortcuts(config: CanvasShortcutsConfig) {
  const {
    onUndo,
    onRedo,
    onSave,
    onDeleteSelected,
    onEscape,
    onDuplicateSelected,
    onToggleFullscreen,
    disabled = false,
  } = config;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      // Ignorar se o foco está em um input, textarea, select ou contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        // Exceção: Escape deve funcionar mesmo em inputs
        if (e.key !== "Escape") return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // ── Ctrl+Z → Undo ──
      if (isMod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        onUndo();
        return;
      }

      // ── Ctrl+Shift+Z ou Ctrl+Y → Redo ──
      if (isMod && e.shiftKey && e.key === "z") {
        e.preventDefault();
        onRedo();
        return;
      }
      if (isMod && e.key === "y") {
        e.preventDefault();
        onRedo();
        return;
      }

      // ── Ctrl+S → Save ──
      if (isMod && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      // ── Delete / Backspace → Remover selecionado ──
      if ((e.key === "Delete" || e.key === "Backspace") && onDeleteSelected) {
        e.preventDefault();
        onDeleteSelected();
        return;
      }

      // ── Ctrl+D → Duplicar selecionado ──
      if (isMod && e.key === "d" && onDuplicateSelected) {
        e.preventDefault();
        onDuplicateSelected();
        return;
      }

      // ── Escape → Desselecionar / fechar ──
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // ── F11 → Fullscreen ──
      if (e.key === "F11" && onToggleFullscreen) {
        e.preventDefault();
        onToggleFullscreen();
        return;
      }
    },
    [
      disabled,
      onUndo,
      onRedo,
      onSave,
      onDeleteSelected,
      onEscape,
      onDuplicateSelected,
      onToggleFullscreen,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
