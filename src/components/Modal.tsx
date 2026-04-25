import { ReactNode, useEffect } from "react";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
  /**
   * Render a small X close affordance in the top-right. Default true
   * since most modals want it. Callers that display their own bespoke
   * header (e.g. a full-screen wizard with its own chrome) can pass
   * `showClose={false}` to suppress.
   */
  showClose?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = "w-[420px]",
  showClose = true,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/10"
      onMouseDown={onClose}
    >
      <div
        className={`${width} bg-bg border border-bd2 rounded-xl shadow-2xl p-5 relative`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("modals.modal.close")}
            title={t("modals.modal.closeEsc")}
            className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-t3 hover:text-char hover:bg-s2 transition"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M 3 3 L 11 11 M 11 3 L 3 11" />
            </svg>
          </button>
        )}
        {title && (
          <h2 className="font-serif text-xl mb-3 text-char pr-8">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
