import { useEffect, useState } from "react";
import { SK } from "../lib/platform";

interface Props {
  /** When a workspace is first opened we start the cycle; subsequent
   *  workspace opens on the same machine stay dismissed via localStorage. */
  workspacePath: string;
}

const STORAGE_KEY = "yarrow.onboardingHints.dismissed";

interface Hint {
  id: string;
  title: string;
  body: React.ReactNode;
}

const HINTS: Hint[] = [
  {
    id: "palette",
    title: "Do anything with the command palette",
    body: (
      <>
        Press <kbd className="px-1.5 py-0.5 rounded bg-s2 text-2xs font-mono text-char border border-bd">{SK.palette}</kbd> to jump to a note, switch paths, create a template, print, import from Obsidian — everything's in there.
      </>
    ),
  },
  {
    id: "paths",
    title: "Branch any thought into a path",
    body: (
      <>
        Want to try a different angle on a note? Press <kbd className="px-1.5 py-0.5 rounded bg-s2 text-2xs font-mono text-char border border-bd">{SK.newDirection}</kbd> (or click <em>Branch this</em>) to start a <em>path</em> — an "if…" version that lives alongside the original. The original never changes.
      </>
    ),
  },
  {
    id: "decide",
    title: "Compare paths to decide between them",
    body: (
      <>
        Open <strong>Paths</strong> from the right rail. Every card shows what you'd gain or lose vs. your current path. For "must-have" thinking, open <strong>Decision matrix</strong> from the palette — star the notes you can't live without and read off the column scores.
      </>
    ),
  },
];

/** Dismissible first-launch tutorial — three short cards, one at a time,
 *  advanced via a "Next tip" button. Dismissed state persists per machine
 *  so power users never see it again. */
export default function OnboardingHints({ workspacePath }: Props) {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  // Don't pop the card immediately on a cold boot — give the app a moment
  // to finish its first render so the hint doesn't collide with layout.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (dismissed) return;
    const t = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(t);
  }, [dismissed, workspacePath]);

  if (dismissed || !visible) return null;
  const hint = HINTS[idx];
  const isLast = idx === HINTS.length - 1;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="fixed z-40 bottom-5 right-5 w-[340px] bg-bg border border-bd2 rounded-xl shadow-2xl animate-fadeIn"
      role="dialog"
      aria-label="First-run tips"
    >
      <div className="px-4 pt-3 pb-2 flex items-baseline gap-2">
        <span className="text-2xs font-mono uppercase tracking-wider text-yeld">
          Tip {idx + 1} of {HINTS.length}
        </span>
        <button
          onClick={dismiss}
          className="ml-auto text-t3 hover:text-char text-sm leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-s2"
          aria-label="Dismiss tips"
          title="Don't show these again"
        >
          ×
        </button>
      </div>
      <div className="px-4 pb-3">
        <div className="font-serif text-base text-char mb-1.5">{hint.title}</div>
        <div className="text-xs text-t2 leading-relaxed">{hint.body}</div>
      </div>
      <div className="px-4 py-2 border-t border-bd flex items-center gap-2">
        <div className="flex gap-1">
          {HINTS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-yel" : "bg-bd2"}`}
            />
          ))}
        </div>
        <button
          onClick={dismiss}
          className="ml-auto text-xs text-t3 hover:text-char"
        >
          Skip tips
        </button>
        {isLast ? (
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1 rounded bg-yel text-on-yel hover:bg-yel2"
          >
            Got it
          </button>
        ) : (
          <button
            onClick={() => setIdx(idx + 1)}
            className="text-xs px-3 py-1 rounded bg-yel text-on-yel hover:bg-yel2"
          >
            Next tip →
          </button>
        )}
      </div>
    </div>
  );
}
