import { memo, type ReactNode } from "react";
import {
  ConnectIcon,
  HistoryIcon,
  NewDirectionIcon,
  ScratchpadIcon,
  SettingsIcon,
} from "../lib/icons";
import { useShowRawMarkdown, useCookMode } from "../lib/editorPrefs";
import { useExtraCooking } from "../lib/extraPrefs";
import { SK } from "../lib/platform";
import { useT } from "../lib/i18n";

export type RailOverlay =
  | "map"
  | "links"
  | "history"
  | "paths"
  | "outline";

interface Props {
  activeOverlay: RailOverlay | null;
  scratchpadOpen: boolean;
  mappingEnabled?: boolean;
  onOpen: (k: RailOverlay) => void;
  onToggleScratchpad: () => void;
  onOpenSettings: () => void;
  /** Open the Kits picker (journal / research / clinical templates).
   *  Threaded through from AppShell so the rail doesn't need its own
   *  copy of the templates list. Optional so existing callers stay
   *  source-compatible. */
  onOpenKits?: () => void;
  /** Optional intercept for the reading/writing flip. When the parent
   *  supplies this, we hand the desired next state over (true = writing
   *  mode visible / raw markdown) and let the parent persist it after any
   *  side-effects — e.g. flushing the editor's debounced save before a
   *  switch to reading mode, so the rendered preview never shows stale
   *  disk content. */
  onSetReadingWriting?: (writing: boolean) => void;
}

function RightRailInner({
  activeOverlay,
  scratchpadOpen,
  mappingEnabled = true,
  onOpen,
  onToggleScratchpad,
  onOpenSettings,
  onOpenKits,
  onSetReadingWriting,
}: Props) {
  const t = useT();
  const [showRaw, setShowRaw] = useShowRawMarkdown();
  // 2.2.0 round 2 — cook-mode toggle. Visible only when the user has
  // turned on the Cooking additions extra in Settings → Writing.
  const [cookingOn] = useExtraCooking();
  const [cookMode, setCookMode] = useCookMode();
  const writing = showRaw; // raw markdown visible = writing mode
  const flip = () => {
    const next = !writing;
    if (onSetReadingWriting) onSetReadingWriting(next);
    else setShowRaw(next);
  };
  return (
    <aside className="w-[52px] shrink-0 border-l border-bd bg-s1 flex flex-col items-center py-4 gap-1.5">
      <RailButton
        active={writing}
        onClick={flip}
        label={writing ? t("sidebar.rail.writingMode") : t("sidebar.rail.readingMode")}
      >
        {writing ? <PencilIcon /> : <GlassesIcon />}
      </RailButton>

      <div className="w-5 h-px bg-bd my-1" />

      {mappingEnabled && (
        <>
          <RailButton
            active={activeOverlay === "map"}
            onClick={() => onOpen("map")}
            label={t("sidebar.rail.map")}
          >
            <MapIcon />
          </RailButton>
          <RailButton
            active={activeOverlay === "links"}
            onClick={() => onOpen("links")}
            label={t("sidebar.rail.links")}
          >
            <ConnectIcon />
          </RailButton>
        </>
      )}
      <RailButton
        active={activeOverlay === "outline"}
        onClick={() => onOpen("outline")}
        label={t("sidebar.rail.outline")}
      >
        <OutlineIcon />
      </RailButton>
      <RailButton
        active={activeOverlay === "history"}
        onClick={() => onOpen("history")}
        label={t("sidebar.rail.history")}
      >
        <HistoryIcon />
      </RailButton>
      {mappingEnabled && (
        <RailButton
          active={activeOverlay === "paths"}
          onClick={() => onOpen("paths")}
          label={t("sidebar.rail.paths")}
        >
          <NewDirectionIcon />
        </RailButton>
      )}

      <div className="w-5 h-px bg-bd my-1" />

      {onOpenKits && (
        <RailButton
          active={false}
          onClick={onOpenKits}
          label={t("sidebar.rail.kits")}
        >
          <KitsIcon />
        </RailButton>
      )}

      <RailButton
        active={scratchpadOpen}
        onClick={onToggleScratchpad}
        label={t("sidebar.rail.scratchpad", { shortcut: SK.scratchpad })}
      >
        <ScratchpadIcon size={14} />
      </RailButton>

      {/* 2.2.0 round 2 — cook-mode quick toggle. Only surfaces when
          the Cooking additions extra is on. Active state mirrors the
          actual cookMode pref so the rail stays in sync with toggles
          fired from Settings or the command palette. */}
      {cookingOn && (
        <RailButton
          active={cookMode}
          onClick={() => setCookMode(!cookMode)}
          label={t("sidebar.rail.cookMode")}
        >
          <CookModeIcon />
        </RailButton>
      )}

      {/* Settings used to live at the very bottom of the rail
          (pushed there by `<div className="flex-1" />`). On platforms
          where the OS / window-manager clipped the bottom of the
          viewport the settings cog became unreachable, so we now
          place it near the top half of the rail — just below
          Scratchpad, with its own hairline divider so it still
          reads as a distinct group. */}
      <div className="w-5 h-px bg-bd my-1" />

      <RailButton active={false} onClick={onOpenSettings} label={t("sidebar.rail.settings")}>
        <SettingsIcon />
      </RailButton>

      <div className="flex-1" />
    </aside>
  );
}

function RailButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      data-tip={label}
      data-tip-align="right"
      data-active={active ? "true" : "false"}
      className={`y-tip rail-btn w-9 h-9 flex items-center justify-center rounded-full ${
        active ? "bg-yelp text-yeld" : "text-t3 hover:bg-s2 hover:text-char"
      }`}
    >
      {children}
    </button>
  );
}

function GlassesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="10" r="2.6" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M6.6 10h2.8M2 7.5l1.3-3.2M14 7.5l-1.3-3.2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.2 1.8l2 2L5 11l-3 1 1-3 7.2-7.2z" />
      <path d="M9 3l2 2" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="3" cy="3" r="1.6" />
      <circle cx="11" cy="3" r="1.6" />
      <circle cx="7" cy="11" r="1.6" />
      <path d="M4.2 4.1L5.8 9.7M8.2 9.7L9.8 4.1M4.6 3h4.8" />
    </svg>
  );
}

// Outline icon — three stepped bars suggesting a heading hierarchy.
function OutlineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2" y1="3.5"  x2="12" y2="3.5" />
      <line x1="4" y1="7"    x2="11" y2="7" />
      <line x1="6" y1="10.5" x2="10" y2="10.5" />
    </svg>
  );
}

// Cook-mode icon — a small simmering pot. Round body with a handle on
// each side and three steam wisps rising from the lid. Reads as
// "cooking" without competing with the editorial line of the other
// rail icons.
function CookModeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* steam wisps */}
      <path d="M5 1.5 q-0.6 0.8 0 1.6" />
      <path d="M7 1.2 q-0.6 0.9 0 1.9" />
      <path d="M9 1.5 q-0.6 0.8 0 1.6" />
      {/* lid */}
      <path d="M3 5 h8" />
      {/* pot body + handles */}
      <path d="M3.5 5 v3.5 a1.6 1.6 0 0 0 1.6 1.6 h3.8 a1.6 1.6 0 0 0 1.6 -1.6 V5" />
      <path d="M2 6 h1.5" />
      <path d="M10.5 6 H12" />
    </svg>
  );
}

// Kits icon — three offset cards stacked, reading as "templates / shapes."
// Quiet enough to sit alongside the navigation icons without competing.
function KitsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="2" width="7" height="8.5" rx="1" />
      <path d="M2 4.5v6.2c0 .55.45 1 1 1h6.2" />
      <path d="M6 5.5h2.5M6 7.5h2.5" />
    </svg>
  );
}

export default memo(RightRailInner);
