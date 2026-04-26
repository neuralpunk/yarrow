import { useEffect, useRef, useState } from "react";
import { useT } from "../../../lib/i18n";
import { parseDuration } from "../../../lib/timers";

// 2.2.0 — Timer picker.
//
// Reached from "Timer…" in the Inserts modal (radial) or in the
// Inserts submenu (linear right-click). Lets the user drop a
// `[label](timer:Xm)` markdown link at the cursor — preset buttons
// for the common bake durations, plus a custom input for anything
// else. Optional label field defaults to the duration text.
//
// On insert, the modal calls `onInsert(text)` with the rendered
// markdown link; AppShell dispatches the standard
// `yarrow:editor-insert-raw` event so the editor places the text at
// the cursor (or replaces the active selection).

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
}

interface Preset {
  /** Tauri-flavoured key, e.g. `25m`. Lower-case. */
  duration: string;
  /** Display label on the preset chip — translated. */
  i18nLabel:
    | "modals.timerPicker.preset.10m"
    | "modals.timerPicker.preset.15m"
    | "modals.timerPicker.preset.30m"
    | "modals.timerPicker.preset.1h";
}

// 2.2.0 round 2: longest → shortest. The most-reached-for bake
// duration on a typical home recipe is "1 hr" (full bake), then 30 m
// (shorter bake / proof), 15 m (rest / cool), 10 m (quick bake).
// Custom slot covers everything in between.
const PRESETS: Preset[] = [
  { duration: "1h",  i18nLabel: "modals.timerPicker.preset.1h"  },
  { duration: "30m", i18nLabel: "modals.timerPicker.preset.30m" },
  { duration: "15m", i18nLabel: "modals.timerPicker.preset.15m" },
  { duration: "10m", i18nLabel: "modals.timerPicker.preset.10m" },
];

export default function TimerPickerModal({ open, onClose, onInsert }: Props) {
  const t = useT();
  const [duration, setDuration] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDuration("");
    setLabel("");
    setCustomMode(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const insertWith = (dur: string) => {
    const parsed = parseDuration(dur);
    if (parsed == null || parsed === 0) {
      setError(t("modals.timerPicker.errBadDuration"));
      return;
    }
    const trimmedLabel = label.trim();
    const linkLabel = trimmedLabel || dur;
    const md = `[${linkLabel}](timer:${dur})`;
    onInsert(md);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-char/30 backdrop-blur-sm animate-fadeIn"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="timer-picker-title"
    >
      <div
        className="w-[460px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[20px] shadow-2xl px-9 pt-8 pb-6 relative animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="timer-picker-title"
          className="text-center font-serif text-[26px] leading-tight tracking-tight text-char mb-1"
        >
          {t("modals.timerPicker.title")}
        </h2>
        <p className="text-center text-t2 text-[13px] italic mb-5 font-serif">
          {t("modals.timerPicker.subtitle")}
        </p>

        <label className="block text-2xs uppercase tracking-wider text-t3 mb-1.5">
          {t("modals.timerPicker.labelCaption")}
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("modals.timerPicker.labelPlaceholder")}
          className="w-full px-3 py-2 text-sm bg-bg-soft border border-bd2 rounded-md text-char focus:outline-none focus:border-yel mb-4"
        />

        <label className="block text-2xs uppercase tracking-wider text-t3 mb-1.5">
          {t("modals.timerPicker.durationCaption")}
        </label>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.duration}
              type="button"
              onClick={() => insertWith(p.duration)}
              className="px-3 py-3 bg-bg-soft border border-bd rounded-md font-mono text-sm text-char hover:bg-yelp hover:border-yel hover:text-yeld transition-all duration-150 active:scale-95"
            >
              {t(p.i18nLabel)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomMode(true);
              window.setTimeout(() => customRef.current?.focus(), 0);
            }}
            className={`px-3 py-3 border rounded-md font-serif italic text-sm transition-all duration-150 active:scale-95 ${
              customMode
                ? "bg-yelp border-yel text-yeld"
                : "bg-bg-soft border-bd-dashed border-bd text-t2 hover:bg-yelp hover:border-yel hover:text-yeld"
            }`}
          >
            {t("modals.timerPicker.preset.custom")}
          </button>
        </div>

        {customMode && (
          <div className="mt-2 mb-2">
            <input
              ref={customRef}
              type="text"
              value={duration}
              onChange={(e) => { setDuration(e.target.value); setError(null); }}
              placeholder={t("modals.timerPicker.customPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  insertWith(duration);
                }
              }}
              className="w-full px-3 py-2 text-sm font-mono bg-bg border border-bd2 rounded-md text-char focus:outline-none focus:border-yel"
            />
            <p className="text-2xs text-t3 mt-1.5 italic font-serif">
              {t("modals.timerPicker.customHint")}
            </p>
          </div>
        )}

        {error && (
          <div className="text-xs text-char mt-3 px-3 py-2 bg-danger/10 border border-danger/30 rounded-md leading-relaxed">
            {error}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-bd flex items-center justify-between">
          <span className="text-2xs text-t3 italic font-serif">
            {t("modals.timerPicker.hint")}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-t2 hover:text-char"
            >
              {t("modals.timerPicker.cancel")}
            </button>
            {customMode && (
              <button
                type="button"
                onClick={() => insertWith(duration)}
                disabled={!duration.trim()}
                className="btn-yel px-3 py-1.5 text-sm rounded-md disabled:opacity-60"
              >
                {t("modals.timerPicker.insert")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
