import { useEffect } from "react";
import { useT } from "../../../lib/i18n";

// Format modal — opened from the radial when the user picks "Format…".
// Six small buttons: Heading, Code Block, Bold, Italic, Strikethrough,
// Math. Behaves differently based on whether there's a selection:
//
//   · with selection    — wraps the selection in the appropriate
//                         markers (** ** for bold, etc.)
//   · without selection — inserts an empty wrapper at the cursor and
//                         lands the caret inside it (`**|**`)
//
// Heading and Code Block always insert at the line level regardless
// of selection state — they're block-level, not inline.

interface Props {
  open: boolean;
  onClose: () => void;
  /** The text currently selected in the editor (empty if none). Used
   *  to decide whether to wrap or insert-empty for the inline ones. */
  selection: string;
  /** Insert raw text at cursor (or replace selection). */
  insertRaw: (
    text: string,
    opts?: { caretOffset?: number; atLineStart?: boolean },
  ) => void;
  /** Replace the current selection with `wrapper` text. */
  wrapSelection: (opening: string, closing: string) => void;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HeadingIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
    <path d="M6 4v16M18 4v16M6 12h12" />
  </svg>
);
const CodeBlockIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
  </svg>
);
const BoldIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z" />
  </svg>
);
const ItalicIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} strokeWidth={2.2}>
    <path d="M19 4h-9M14 20H5M15 4 9 20" />
  </svg>
);
const StrikethroughIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 12h14" />
    <path d="M16 7q-3-2-7-1.5T7 9q0 2 4 3" />
    <path d="M8 17q3 2 7 1.5T17 15" />
  </svg>
);
const MathIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 19h2L13 5h2" />
    <path d="M9 12h6" />
    <path d="M16 14l4 4M20 14l-4 4" />
  </svg>
);

export default function FormatModal({
  open,
  onClose,
  selection,
  insertRaw,
  wrapSelection,
}: Props) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const close = () => onClose();

  const inlineWrap = (opening: string, closing: string, emptyCaret: number) => {
    if (selection) {
      wrapSelection(opening, closing);
    } else {
      const text = opening + closing;
      insertRaw(text, { caretOffset: emptyCaret });
    }
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-char/30 backdrop-blur-sm animate-fadeIn"
      onMouseDown={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="format-title"
    >
      <div
        className="w-[480px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[20px] shadow-2xl px-9 pt-8 pb-6 relative animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="format-title"
          className="text-center font-serif text-[26px] leading-tight tracking-tight text-char mb-1"
        >
          {t("modals.format.title")}
        </h2>
        <p className="text-center text-t2 text-[13px] italic mb-6 font-serif">
          {selection
            ? t("modals.format.subtitle.wrap")
            : t("modals.format.subtitle.insert")}
        </p>

        <div className="grid grid-cols-3 gap-3">
          <ModalBtn
            icon={HeadingIcon}
            label={t("modals.format.btn.heading")}
            keys={t("modals.format.keys.heading")}
            onClick={() => {
              insertRaw("# ", { atLineStart: true });
              close();
            }}
          />
          <ModalBtn
            icon={CodeBlockIcon}
            label={t("modals.format.btn.code")}
            keys={t("modals.format.keys.code")}
            onClick={() => {
              insertRaw("```\n\n```\n", {
                atLineStart: true,
                caretOffset: "```\n".length,
              });
              close();
            }}
          />
          <ModalBtn
            icon={BoldIcon}
            label={t("modals.format.btn.bold")}
            keys={t("modals.format.keys.bold")}
            onClick={() => inlineWrap("**", "**", 2)}
          />
          <ModalBtn
            icon={ItalicIcon}
            label={t("modals.format.btn.italic")}
            keys={t("modals.format.keys.italic")}
            onClick={() => inlineWrap("*", "*", 1)}
          />
          <ModalBtn
            icon={StrikethroughIcon}
            label={t("modals.format.btn.strikethrough")}
            keys={t("modals.format.keys.strikethrough")}
            onClick={() => inlineWrap("~~", "~~", 2)}
          />
          <ModalBtn
            icon={MathIcon}
            label={t("modals.format.btn.math")}
            keys={t("modals.format.keys.math")}
            onClick={() => inlineWrap("$", "$", 1)}
          />
        </div>

        <div className="mt-5 pt-4 border-t border-bd flex items-center justify-end text-[12.5px] text-t3">
          <span>
            <kbd className="font-mono text-[10.5px] bg-s1 border border-bd px-1.5 py-0.5 rounded text-t2">
              esc
            </kbd>{" "}
            {t("modals.format.escHint")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ModalBtn({
  icon,
  label,
  keys,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  keys: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-bg-soft border border-bd rounded-[12px] px-2 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-150 hover:border-yel hover:bg-yelp hover:-translate-y-0.5 active:translate-y-0 text-char focus:outline-none focus:border-yel"
    >
      <span className="w-7 h-7 grid place-items-center text-yeld">{icon}</span>
      <span className="font-serif font-medium text-[13px] leading-tight tracking-tight text-center">
        {label}
      </span>
      <span className="font-mono text-[9.5px] tracking-wider text-t3 uppercase">
        {keys}
      </span>
    </button>
  );
}
