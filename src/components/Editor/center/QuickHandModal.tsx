import { useEffect } from "react";
import { useT } from "../../../lib/i18n";
import type { StringKey } from "../../../lib/i18n";
import { fireCenterAction, type CenterActionId } from "./actions";

// Quick Hand — version A of the press-and-hold modal. A 3×3 grid of
// small on-theme buttons that surface the actions users reach for most
// often. Each button fires its own center-action; the modal closes
// either on action commit, click-outside, or Escape.
//
// This is one of two "long-press destinations" — the other is the
// Constellation flyout. Either can be bound to any of the three
// configurable gesture slots from Settings → Gestures.

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional callback to navigate to Settings → Gestures. */
  onCustomize?: () => void;
}

interface QHEntry {
  id: CenterActionId;
  /** i18n key for the button label. */
  i18nLabel: StringKey;
  /** Short keyboard hint or category text shown under the label. */
  i18nKeys: StringKey;
  icon: React.ReactNode;
}

// Hand-drawn-ish 22 px icons keyed to each action. Using the same
// stroke-1.5, round-cap style that the rest of Yarrow's icons use so
// the modal sits visually with the existing chrome.
const QH_ENTRIES: QHEntry[] = [
  {
    id: "newNote",
    i18nLabel: "modals.quickHand.btn.newNote",
    i18nKeys: "modals.quickHand.keys.newNote",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    id: "newPath",
    i18nLabel: "modals.quickHand.btn.newPath",
    i18nKeys: "modals.quickHand.keys.newPath",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M5 18 V6" />
        <path d="M5 6 q5 0 7 6" />
        <path d="M5 6 q5 0 7 12" />
        <circle cx="13" cy="6" r="1.4" />
        <circle cx="13" cy="12" r="1.4" />
        <circle cx="13" cy="18" r="1.4" />
      </svg>
    ),
  },
  {
    id: "todayJournal",
    i18nLabel: "modals.quickHand.btn.todayJournal",
    i18nKeys: "modals.quickHand.keys.todayJournal",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <line x1="9" y1="3" x2="9" y2="6" />
        <line x1="15" y1="3" x2="15" y2="6" />
        <line x1="4" y1="11" x2="20" y2="11" />
      </svg>
    ),
  },
  {
    id: "outline",
    i18nLabel: "modals.quickHand.btn.outline",
    i18nKeys: "modals.quickHand.keys.outline",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 9h16" />
        <path d="M9 4v16" />
      </svg>
    ),
  },
  {
    id: "livePreview",
    i18nLabel: "modals.quickHand.btn.livePreview",
    i18nKeys: "modals.quickHand.keys.livePreview",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 4h16v8h-16z" />
        <path d="M4 14h16v6h-16z" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    id: "focus",
    i18nLabel: "modals.quickHand.btn.focus",
    i18nKeys: "modals.quickHand.keys.focus",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 12 q9 -8 18 0" />
        <path d="M3 12 q9 8 18 0" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    id: "constellation",
    i18nLabel: "modals.quickHand.btn.constellation",
    i18nKeys: "modals.quickHand.keys.constellation",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="6" cy="7" r="1.6" />
        <circle cx="18" cy="7" r="1.6" />
        <circle cx="6" cy="17" r="1.6" />
        <circle cx="18" cy="17" r="1.6" />
        <line x1="9" y1="9" x2="6.8" y2="7.6" />
        <line x1="15" y1="9" x2="17.2" y2="7.6" />
        <line x1="9" y1="15" x2="6.8" y2="16.4" />
        <line x1="15" y1="15" x2="17.2" y2="16.4" />
      </svg>
    ),
  },
  {
    id: "scratchpad",
    i18nLabel: "modals.quickHand.btn.scratchpad",
    i18nKeys: "modals.quickHand.keys.scratchpad",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M5 4 L17 4 L19 6 L19 20 L5 20 Z" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  {
    id: "settings",
    i18nLabel: "modals.quickHand.btn.settings",
    i18nKeys: "modals.quickHand.keys.settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3 v2 M12 19 v2 M3 12 h2 M19 12 h2 M5.6 5.6 l1.4 1.4 M17 17 l1.4 1.4 M5.6 18.4 l1.4 -1.4 M17 7 l1.4 -1.4" />
      </svg>
    ),
  },
];

export default function QuickHandModal({ open, onClose, onCustomize }: Props) {
  const t = useT();

  // Escape closes the modal — the parent owns `open`, we just signal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fire = (id: CenterActionId) => {
    onClose();
    // Defer so the modal's exit completes before the new surface mounts.
    // 0 ms is enough for React to flush the setState; the visual feel
    // is "tap → modal fades → action lands."
    window.setTimeout(() => fireCenterAction(id), 0);
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-char/30 backdrop-blur-sm animate-fadeIn"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-hand-title"
    >
      <div
        className="w-[560px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[22px] shadow-2xl px-11 pt-9 pb-7 relative animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Glyph cap floating above the title */}
        <div
          className="absolute -top-[22px] left-1/2 -translate-x-1/2 w-11 h-11 rounded-[14px] bg-bg border border-bd2 grid place-items-center shadow-md"
          aria-hidden="true"
        >
          <svg width="22" height="22" viewBox="0 0 22 22">
            <circle cx="7" cy="7" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="11" cy="7" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="15" cy="7" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="7" cy="11" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="11" cy="11" r="1.6" fill="currentColor" />
            <circle cx="15" cy="11" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="7" cy="15" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="11" cy="15" r="0.8" fill="currentColor" opacity="0.32" />
            <circle cx="15" cy="15" r="0.8" fill="currentColor" opacity="0.32" />
          </svg>
        </div>

        <h2
          id="quick-hand-title"
          className="text-center font-serif text-[30px] leading-tight tracking-tight text-char mt-3 mb-1"
        >
          {t("modals.quickHand.title")}
        </h2>
        <p className="text-center text-t2 text-[13.5px] italic mb-7 font-serif">
          {t("modals.quickHand.subtitle")}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {QH_ENTRIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => fire(entry.id)}
              className="bg-bg-soft border border-bd rounded-[14px] px-2 pt-[18px] pb-[14px] flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 hover:border-yel hover:bg-yelp hover:-translate-y-0.5 active:translate-y-0 text-char focus:outline-none focus:border-yel"
            >
              <span className="w-7 h-7 grid place-items-center text-yeld">
                {entry.icon}
              </span>
              <span className="font-serif font-medium text-[13.5px] leading-tight tracking-tight text-center">
                {t(entry.i18nLabel)}
              </span>
              <span className="font-mono text-[9.5px] tracking-wider text-t3 uppercase">
                {t(entry.i18nKeys)}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-[26px] pt-[18px] border-t border-bd flex items-center justify-between text-[12.5px] text-t3">
          {onCustomize ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                window.setTimeout(() => onCustomize(), 0);
              }}
              className="font-serif text-[13px] italic text-yel hover:text-yel2 cursor-pointer bg-transparent border-none p-0"
            >
              {t("modals.quickHand.customize")}
            </button>
          ) : (
            <span />
          )}
          <span>
            <kbd className="font-mono text-[10.5px] bg-s1 border border-bd px-1.5 py-0.5 rounded text-t2">
              esc
            </kbd>{" "}
            {t("modals.quickHand.escHint")}
          </span>
        </div>
      </div>
    </div>
  );
}
