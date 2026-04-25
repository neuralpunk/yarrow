// The core guidance surface — a centered overlay with an illustration,
// eyebrow, title, body, optional aside, and up to two action buttons.
// Rendered by GuidanceHost when the guidance store has an active modal key.

import { useEffect } from "react";
import type { GuidanceDef, GuidanceAction } from "../../lib/guidance";
import { renderInlines } from "../../lib/guidance";
import { useGuidance, useGuidanceOverrideActions } from "../../lib/guidanceStore";
import { useT } from "../../lib/i18n";

interface Props {
  def: GuidanceDef;
}

function Inlines({ text }: { text: string }) {
  const parts = renderInlines(text);
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "bold") return <strong key={i} className="text-char font-medium">{p.value}</strong>;
        if (p.kind === "italic") return <em key={i} className="text-accent2">{p.value}</em>;
        return <span key={i}>{p.value}</span>;
      })}
    </>
  );
}

export default function TeachingModal({ def }: Props) {
  const { dismiss, markSeen } = useGuidance();
  const overrides = useGuidanceOverrideActions();
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "Enter") runAction(def.primary, "primary");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.key]);

  const runAction = async (a: GuidanceAction | undefined, which: "primary" | "secondary") => {
    if (!a) return;
    let keepOpen: void | boolean = undefined;
    if (a.run) keepOpen = await a.run();
    const override = which === "primary" ? overrides?.onPrimary : overrides?.onSecondary;
    if (override) override();
    if (keepOpen !== true) dismiss();
  };

  const Illustration = def.illustration;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-char/25 animate-fadeIn"
      onMouseDown={dismiss}
    >
      <div
        className="w-[540px] max-w-[92vw] bg-bg border border-bd2 rounded-2xl shadow-2xl overflow-hidden animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {Illustration && (
          <div className="px-8 pt-8 pb-2 flex items-center justify-center">
            <Illustration />
          </div>
        )}
        <div className="px-8 pt-4 pb-8">
          {def.eyebrow && (
            <div className="text-2xs text-yeld uppercase tracking-[0.2em] font-semibold mb-3 font-sans">
              {def.eyebrow}
            </div>
          )}
          <h2 className="font-serif text-[26px] leading-[1.15] text-char mb-4 tracking-tight">
            {def.title}
          </h2>
          <p className="font-sans text-[15px] leading-[1.65] text-ch2 mb-4">
            <Inlines text={def.body} />
          </p>
          {def.aside && (
            <p className="font-serif italic text-[14px] leading-[1.6] text-t2 pt-3 border-t border-bd/60">
              <Inlines text={def.aside} />
            </p>
          )}
          <div className="mt-6 flex items-center gap-2 justify-end">
            <button
              onClick={() => markSeen(def.key as any)}
              className="text-xs text-t3 hover:text-t2 mr-auto"
              title={t("modals.guidance.stopShowingTitle")}
            >
              {t("modals.guidance.stopShowing")}
            </button>
            {def.secondary && (
              <button
                onClick={() => runAction(def.secondary, "secondary")}
                className="px-4 py-2 rounded-md text-sm text-ch2 hover:bg-s2 transition"
              >
                {def.secondary.label}
              </button>
            )}
            {def.primary && (
              <button
                onClick={() => runAction(def.primary, "primary")}
                className={
                  def.primary.tone === "danger"
                    ? "px-4 py-2 rounded-md text-sm bg-danger/90 text-white hover:bg-danger transition"
                    : "btn-yel px-4 py-2 rounded-md text-sm font-medium"
                }
                autoFocus
              >
                {def.primary.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
