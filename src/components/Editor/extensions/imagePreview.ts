import { RangeSetBuilder } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { api } from "../../../lib/tauri";

// ────────────── inline image preview ──────────────
// Matches `![alt](attachments/xxx.ext)` and renders the image beneath
// the line. The widget loads bytes via `api.readAttachment` → data URL,
// caching by relpath so scrolling doesn't refetch. This module is split
// out of NoteEditor so the "Inline image previews" extra can be
// enable/disable without rebuilding the editor bundle.

const ATTACH_IMG_RE = /!\[[^\]]*\]\((attachments\/[^)\s]+)\)/;

// LRU-ish cache: bounded by entry count so a long session editing a
// vault with many attachments doesn't hand all its RAM to data-URL
// strings. JS Maps iterate in insertion order, so deleting the first
// key approximates "evict oldest".
const IMAGE_CACHE_MAX = 50;
const imageCache = new Map<string, string>();
function cacheImage(relpath: string, url: string) {
  if (imageCache.has(relpath)) imageCache.delete(relpath);
  imageCache.set(relpath, url);
  while (imageCache.size > IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
}
function getCachedImage(relpath: string): string | undefined {
  const hit = imageCache.get(relpath);
  if (hit !== undefined) {
    imageCache.delete(relpath);
    imageCache.set(relpath, hit);
  }
  return hit;
}

class ImageWidget extends WidgetType {
  constructor(readonly relpath: string) {
    super();
  }
  eq(other: ImageWidget) {
    return other.relpath === this.relpath;
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-yarrow-img";
    wrap.contentEditable = "false";
    const img = document.createElement("img");
    img.alt = "";
    wrap.appendChild(img);
    const cached = getCachedImage(this.relpath);
    if (cached) {
      img.src = cached;
    } else {
      api
        .readAttachment(this.relpath)
        .then((d) => {
          const url = `data:${d.mime};base64,${d.base64}`;
          cacheImage(this.relpath, url);
          img.src = url;
        })
        .catch(() => {
          wrap.classList.add("cm-yarrow-img-missing");
          wrap.textContent = `Missing: ${this.relpath}`;
        });
    }
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

export function imagePreviewPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const fenceMask = new Uint8Array(doc.lines + 1);
        let inFence = false;
        for (let n = 1; n <= doc.lines; n++) {
          const text = doc.line(n).text;
          if (/^\s*```/.test(text)) {
            fenceMask[n] = 1;
            inFence = !inFence;
          } else {
            fenceMask[n] = inFence ? 1 : 0;
          }
        }
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (fenceMask[line.number] === 0) {
              const m = ATTACH_IMG_RE.exec(line.text);
              if (m) {
                builder.add(
                  line.to,
                  line.to,
                  Decoration.widget({
                    widget: new ImageWidget(m[1]),
                    side: 1,
                    block: true,
                  }),
                );
              }
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations },
  );
}
