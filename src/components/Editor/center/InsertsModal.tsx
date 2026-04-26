import { useEffect } from "react";
import { useT } from "../../../lib/i18n";

// Inserts modal — opened from the radial when the user has no
// selection and picks "Inserts…". Four small buttons that route to
// the existing wikilink/task/table/callout flows. Closes on click,
// click-outside, or Escape.

interface Props {
  open: boolean;
  onClose: () => void;
  onInsertWikilink: () => void;
  onInsertTask: () => void;
  onInsertTable: () => void;
  onInsertCallout: () => void;
  onInsertTimer: () => void;
  onClipRecipe: () => void;
  onAddToShoppingList: () => void;
  /** Wikilink button is disabled when the workspace is in basic mode
   *  (mappingEnabled: false) — same gate as the radial uses. */
  wikilinkDisabled?: boolean;
  /** Add-to-shopping-list is meaningful only when there's an active
   *  note to scan. Disabled in onboarding / no-note states. */
  shoppingDisabled?: boolean;
  /** When false, the entire "RECIPE FLOWS" group is hidden — used by
   *  the Cooking additions extra. */
  cookingEnabled?: boolean;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const WikilinkIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const TaskIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <rect x="3" y="5" width="16" height="16" rx="2" />
    <path d="m7 12 3 3 7-7" />
  </svg>
);
const TableIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 4v16M15 4v16" />
  </svg>
);
const CalloutIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4l-4 4v-4H6a2 2 0 0 1-2-2Z" />
    <path d="M12 8v4M12 14h.01" />
  </svg>
);
const TimerIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 9v4l2.5 2" />
    <path d="M9 3h6" />
  </svg>
);
const RecipeUrlIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" />
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />
  </svg>
);
const ShoppingIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
    <path d="M5 7h14l-1.4 11.2a1.5 1.5 0 0 1-1.5 1.3H7.9a1.5 1.5 0 0 1-1.5-1.3L5 7z" />
    <path d="M9 10V6a3 3 0 0 1 6 0v4" />
  </svg>
);

export default function InsertsModal({
  open,
  onClose,
  onInsertWikilink,
  onInsertTask,
  onInsertTable,
  onInsertCallout,
  onInsertTimer,
  onClipRecipe,
  onAddToShoppingList,
  wikilinkDisabled,
  shoppingDisabled,
  cookingEnabled,
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

  const fire = (action: () => void) => {
    onClose();
    window.setTimeout(action, 0);
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-char/30 backdrop-blur-sm animate-fadeIn"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inserts-title"
    >
      <div
        className="w-[560px] max-w-[calc(100vw-48px)] bg-bg border border-bd2 rounded-[20px] shadow-2xl px-9 pt-8 pb-6 relative animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="inserts-title"
          className="text-center font-serif text-[26px] leading-tight tracking-tight text-char mb-1"
        >
          {t("modals.inserts.title")}
        </h2>
        <p className="text-center text-t2 text-[13px] italic mb-6 font-serif">
          {t("modals.inserts.subtitle")}
        </p>

        {/* Row 1 — markdown inserts that land in the body. */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <ModalBtn
            icon={WikilinkIcon}
            label={t("modals.inserts.btn.wikilink")}
            keys={t("modals.inserts.keys.wikilink")}
            disabled={wikilinkDisabled}
            onClick={() => fire(onInsertWikilink)}
          />
          <ModalBtn
            icon={TaskIcon}
            label={t("modals.inserts.btn.task")}
            keys={t("modals.inserts.keys.task")}
            onClick={() => fire(onInsertTask)}
          />
          <ModalBtn
            icon={TableIcon}
            label={t("modals.inserts.btn.table")}
            keys={t("modals.inserts.keys.table")}
            onClick={() => fire(onInsertTable)}
          />
          <ModalBtn
            icon={CalloutIcon}
            label={t("modals.inserts.btn.callout")}
            keys={t("modals.inserts.keys.callout")}
            onClick={() => fire(onInsertCallout)}
          />
        </div>

        {/* Row 2 — recipe / timer flows. Hidden entirely unless the
            user has enabled the Cooking additions extra in
            Settings → Writing → Writing extras. */}
        {cookingEnabled && (
          <>
            <div className="text-2xs uppercase tracking-wider text-t3 mt-4 mb-2 font-mono">
              {t("modals.inserts.recipeGroup")}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ModalBtn
                icon={TimerIcon}
                label={t("modals.inserts.btn.timer")}
                keys={t("modals.inserts.keys.timer")}
                onClick={() => fire(onInsertTimer)}
              />
              <ModalBtn
                icon={RecipeUrlIcon}
                label={t("modals.inserts.btn.clipRecipe")}
                keys={t("modals.inserts.keys.clipRecipe")}
                onClick={() => fire(onClipRecipe)}
              />
              <ModalBtn
                icon={ShoppingIcon}
                label={t("modals.inserts.btn.shoppingList")}
                keys={t("modals.inserts.keys.shoppingList")}
                disabled={shoppingDisabled}
                onClick={() => fire(onAddToShoppingList)}
              />
            </div>
          </>
        )}

        <div className="mt-5 pt-4 border-t border-bd flex items-center justify-end text-[12.5px] text-t3">
          <span>
            <kbd className="font-mono text-[10.5px] bg-s1 border border-bd px-1.5 py-0.5 rounded text-t2">
              esc
            </kbd>{" "}
            {t("modals.inserts.escHint")}
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
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  keys: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="bg-bg-soft border border-bd rounded-[12px] px-3 py-4 flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 hover:border-yel hover:bg-yelp hover:-translate-y-0.5 active:translate-y-0 text-char focus:outline-none focus:border-yel disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-bd disabled:hover:bg-bg-soft disabled:hover:translate-y-0"
    >
      <span className="w-7 h-7 grid place-items-center text-yeld">{icon}</span>
      <span className="font-serif font-medium text-[13.5px] leading-tight tracking-tight text-center">
        {label}
      </span>
      <span className="font-mono text-[9.5px] tracking-wider text-t3 uppercase">
        {keys}
      </span>
    </button>
  );
}
