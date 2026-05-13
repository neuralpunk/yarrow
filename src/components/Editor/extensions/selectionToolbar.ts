import { ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

// 3.1 — Selection Toolbar trigger plugin.
// Watches selection state; whenever the user has a non-empty selection
// inside the editor, dispatches `yarrow:editor-selection-toolbar` with
// the selection range, the selected text, and viewport coordinates of
// the selection's midpoint. The host (AppShell) listens for this event
// and renders `SelectionToolbar.svelte` at the supplied coords.
//
// We dispatch ONLY on selection-set transitions, not on every doc
// change, so applying a formatting action (which collapses the
// selection) immediately tears the toolbar down via the empty-selection
// dismissal — no flicker.

export type SelectionToolbarPayload = {
  from: number;
  to: number;
  x: number;
  y: number;
  text: string;
} | null;

export function selectionToolbarPlugin() {
  return ViewPlugin.fromClass(
    class {
      view: EditorView;
      lastKey = "";

      constructor(view: EditorView) {
        this.view = view;
      }

      update(update: ViewUpdate) {
        if (!update.selectionSet && !update.docChanged) return;
        const sel = update.state.selection.main;
        if (sel.empty) {
          this.dispatch(null);
          return;
        }
        // Don't show the toolbar while the user is still dragging or
        // composing — too jittery. Selection-set fires once on the
        // final selection anyway.
        if (update.view.composing) return;
        const key = `${sel.from}-${sel.to}`;
        if (key === this.lastKey) return;
        this.lastKey = key;

        const fromCoords = update.view.coordsAtPos(sel.from);
        const toCoords = update.view.coordsAtPos(sel.to);
        if (!fromCoords) return;
        const right = toCoords?.right ?? fromCoords.right;
        // Use the midpoint of the first and last lines of the
        // selection for the toolbar's horizontal anchor; the toolbar
        // itself will adjust for edge-clamping in the Svelte layer.
        const x = (fromCoords.left + right) / 2;
        const y = fromCoords.top;
        this.dispatch({
          from: sel.from,
          to: sel.to,
          x,
          y,
          text: update.state.sliceDoc(sel.from, sel.to),
        });
      }

      dispatch(payload: SelectionToolbarPayload) {
        if (!payload) this.lastKey = "";
        if (payload) {
          console.info(
            "[yarrow] selection toolbar plugin → dispatch",
            payload.from,
            payload.to,
            `"${payload.text.slice(0, 24)}"`,
          );
        }
        window.dispatchEvent(
          new CustomEvent<SelectionToolbarPayload>(
            "yarrow:editor-selection-toolbar",
            { detail: payload },
          ),
        );
      }

      destroy() {
        this.dispatch(null);
      }
    },
  );
}
