import type { CenterActionId } from "../components/Editor/center/actions";
import type { StringKey } from "./i18n/index.svelte";

// ────────────── Still Point gesture bindings (Svelte 5 port) ──────────────
//
// Three of the radial centre's five gestures are user-configurable: a
// single tap, a press-and-hold, and a double-tap. The other two
// (drag-out and scroll wheel) are structural to how the radial works
// and aren't bindable.
//
// Each slot stores a `CenterActionId` in localStorage. The matching
// `gestureBinding(slot).value` is the reactive reader; `read()` is
// for code paths that need a synchronous answer (RadialMenu's gesture
// handlers run outside any reactive context).
//
// Defaults match the v2.1 behaviour with one change: long-press now
// opens the Quick Hand modal instead of the Connection Graph.

export type GestureSlot = "tap" | "longPress" | "doubleTap";

interface SlotDescriptor {
  storageKey: string;
  event: string;
  default: CenterActionId;
}

const DESCRIPTORS: Record<GestureSlot, SlotDescriptor> = {
  tap: {
    storageKey: "yarrow.gesture.tap",
    event: "yarrow:gesture-tap-changed",
    default: "palette",
  },
  longPress: {
    storageKey: "yarrow.gesture.longPress",
    event: "yarrow:gesture-longPress-changed",
    default: "quickHand",
  },
  doubleTap: {
    storageKey: "yarrow.gesture.doubleTap",
    event: "yarrow:gesture-doubleTap-changed",
    default: "focus",
  },
};

const VALID_ACTIONS = new Set<CenterActionId>([
  "palette",
  "quickHand",
  "constellationModal",
  "constellation",
  "focus",
  "scratchpad",
  "todayJournal",
  "newNote",
  "newPath",
  "outline-solid",
  "livePreview",
  "cookMode",
  "settings",
]);

function read(slot: GestureSlot): CenterActionId {
  const d = DESCRIPTORS[slot];
  try {
    const raw = localStorage.getItem(d.storageKey);
    if (raw && VALID_ACTIONS.has(raw as CenterActionId)) {
      return raw as CenterActionId;
    }
    return d.default;
  } catch {
    return d.default;
  }
}

export function readGestureBinding(slot: GestureSlot): CenterActionId {
  return read(slot);
}

function write(slot: GestureSlot, action: CenterActionId): void {
  const d = DESCRIPTORS[slot];
  try { localStorage.setItem(d.storageKey, action); } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent(d.event, { detail: action }));
}

class GestureBindingStore {
  value = $state<CenterActionId>("palette");
  #slot: GestureSlot;

  constructor(slot: GestureSlot) {
    this.#slot = slot;
    this.value = read(slot);
    $effect.root(() => {
      const d = DESCRIPTORS[slot];
      const onChange = (e: Event) => {
        const next = (e as CustomEvent<CenterActionId>).detail;
        const fresh = VALID_ACTIONS.has(next) ? next : read(this.#slot);
        if (fresh !== this.value) this.value = fresh;
      };
      const onStorage = (e: StorageEvent) => {
        if (e.key === d.storageKey) {
          const fresh = read(this.#slot);
          if (fresh !== this.value) this.value = fresh;
        }
      };
      window.addEventListener(d.event, onChange as EventListener);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(d.event, onChange as EventListener);
        window.removeEventListener("storage", onStorage);
      };
    });
  }

  set(next: CenterActionId) {
    if (this.value === next) return;
    write(this.#slot, next);
    this.value = next;
  }
}

export const gestureTap = new GestureBindingStore("tap");
export const gestureLongPress = new GestureBindingStore("longPress");
export const gestureDoubleTap = new GestureBindingStore("doubleTap");

export function gestureStore(slot: GestureSlot): GestureBindingStore {
  if (slot === "tap") return gestureTap;
  if (slot === "longPress") return gestureLongPress;
  return gestureDoubleTap;
}

/** Reset all three slots to their recommended defaults. Fires the
 *  per-slot change events so any open Settings pane updates live. */
export function resetGestureBindings(): void {
  (Object.keys(DESCRIPTORS) as GestureSlot[]).forEach((slot) => {
    write(slot, DESCRIPTORS[slot].default);
  });
}

export function getDefaultBinding(slot: GestureSlot): CenterActionId {
  return DESCRIPTORS[slot].default;
}

// ────────────── Bindable-action catalogue ──────────────

export interface BindableAction {
  id: CenterActionId;
  i18nLabel: StringKey;
  i18nBlurb: StringKey;
  group: "core" | "navigation" | "writing" | "system";
}

export const BINDABLE_ACTIONS: BindableAction[] = [
  {
    id: "palette",
    i18nLabel: "settings.gestures.action.palette.label",
    i18nBlurb: "settings.gestures.action.palette.blurb",
    group: "core",
  },
  {
    id: "quickHand",
    i18nLabel: "settings.gestures.action.quickHand.label",
    i18nBlurb: "settings.gestures.action.quickHand.blurb",
    group: "core",
  },
  {
    id: "constellationModal",
    i18nLabel: "settings.gestures.action.constellationModal.label",
    i18nBlurb: "settings.gestures.action.constellationModal.blurb",
    group: "core",
  },
  {
    id: "constellation",
    i18nLabel: "settings.gestures.action.constellation.label",
    i18nBlurb: "settings.gestures.action.constellation.blurb",
    group: "navigation",
  },
  {
    id: "outline-solid",
    i18nLabel: "settings.gestures.action.outline.label",
    i18nBlurb: "settings.gestures.action.outline.blurb",
    group: "navigation",
  },
  {
    id: "todayJournal",
    i18nLabel: "settings.gestures.action.todayJournal.label",
    i18nBlurb: "settings.gestures.action.todayJournal.blurb",
    group: "navigation",
  },
  {
    id: "newNote",
    i18nLabel: "settings.gestures.action.newNote.label",
    i18nBlurb: "settings.gestures.action.newNote.blurb",
    group: "writing",
  },
  {
    id: "newPath",
    i18nLabel: "settings.gestures.action.newPath.label",
    i18nBlurb: "settings.gestures.action.newPath.blurb",
    group: "writing",
  },
  {
    id: "livePreview",
    i18nLabel: "settings.gestures.action.livePreview.label",
    i18nBlurb: "settings.gestures.action.livePreview.blurb",
    group: "writing",
  },
  {
    id: "cookMode",
    i18nLabel: "settings.gestures.action.cookMode.label",
    i18nBlurb: "settings.gestures.action.cookMode.blurb",
    group: "writing",
  },
  {
    id: "focus",
    i18nLabel: "settings.gestures.action.focus.label",
    i18nBlurb: "settings.gestures.action.focus.blurb",
    group: "writing",
  },
  {
    id: "scratchpad",
    i18nLabel: "settings.gestures.action.scratchpad.label",
    i18nBlurb: "settings.gestures.action.scratchpad.blurb",
    group: "system",
  },
  {
    id: "settings",
    i18nLabel: "settings.gestures.action.settings.label",
    i18nBlurb: "settings.gestures.action.settings.blurb",
    group: "system",
  },
];
