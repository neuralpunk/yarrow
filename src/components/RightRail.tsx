import { memo, type ReactNode } from "react";
import {
  ConnectIcon,
  HistoryIcon,
  NewDirectionIcon,
  ScratchpadIcon,
  SettingsIcon,
} from "../lib/icons";
import { useShowRawMarkdown } from "../lib/editorPrefs";
import { SK } from "../lib/platform";
import { useT } from "../lib/i18n";

export type RailOverlay = "map" | "links" | "history" | "paths";

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

      <div className="flex-1" />

      <RailButton active={false} onClick={onOpenSettings} label={t("sidebar.rail.settings")}>
        <SettingsIcon />
      </RailButton>
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
