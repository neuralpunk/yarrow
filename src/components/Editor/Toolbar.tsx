import type { ReactNode } from "react";
import {
  NewDirectionIcon,
  ConnectIcon,
  HistoryIcon,
  SearchIcon,
  SyncIcon,
  FocusIcon,
  ExitFocusIcon,
  SettingsIcon,
  StatusDot,
} from "../../lib/icons";
import { SK } from "../../lib/platform";

interface Props {
  currentPath: string;
  pathCount: number;
  connectionCount: number;
  dirty: boolean;
  syncStatus: "synced" | "pending" | "syncing" | "error" | "no-remote";
  syncMessage: string;
  focusMode: boolean;
  onNewDirection: () => void;
  onConnect: () => void;
  onHistory: () => void;
  onSync: () => void;
  onToggleFocus: () => void;
  onOpenPalette: () => void;
  onOpenSettings: () => void;
}

export default function Toolbar({
  currentPath,
  dirty,
  syncStatus,
  syncMessage,
  focusMode,
  onNewDirection,
  onConnect,
  onHistory,
  onSync,
  onToggleFocus,
  onOpenPalette,
  onOpenSettings,
}: Props) {
  return (
    <div className="toolbar h-12 flex items-center px-4 border-b border-bd bg-s1/60 backdrop-blur-[2px] gap-3 min-w-0">
      <div className="flex items-center gap-2 text-xs shrink-0 min-w-0">
        <span className="tb-on-path text-t3 whitespace-nowrap">on path</span>
        <span
          className="y-tip max-w-[180px] truncate px-2.5 py-0.5 bg-yelp text-yeld rounded-full font-medium whitespace-nowrap"
          data-tip={currentPath || "main"}
          title={currentPath || "main"}
        >
          {currentPath || "main"}
        </span>
      </div>

      {/* Note actions — things you do to the current note */}
      <div className="flex items-center gap-1 text-xs shrink-0 min-w-0">
        <ToolButton
          onClick={onConnect}
          icon={<ConnectIcon />}
          label="Connect"
          tip="Link this note to another — supports, challenges, or came from"
        />
        <ToolButton
          onClick={onHistory}
          icon={<HistoryIcon />}
          label="History"
          tip="Every save is kept — scrub back through versions"
        />
      </div>

      <span className="h-5 w-px bg-bd shrink-0" aria-hidden="true" />

      {/* Path actions — things you do to the current path */}
      <div className="flex items-center gap-1 text-xs shrink-0 min-w-0">
        <ToolButton
          onClick={onNewDirection}
          icon={<NewDirectionIcon />}
          label="New direction"
          tip={`Branch this path — try a different angle without losing what you have (${SK.newDirection})`}
          primary
        />
        <ToolButton
          onClick={onOpenPalette}
          icon={<SearchIcon />}
          label="Find"
          tip={`Search notes or do anything (${SK.palette})`}
        />
      </div>

      <div className="ml-auto flex items-center gap-1 text-xs shrink-0">
        <IconButton
          onClick={onToggleFocus}
          tip={focusMode ? `Show sidebars (${SK.focusToggle})` : `Hide sidebars for writing (${SK.focusToggle})`}
        >
          {focusMode ? <ExitFocusIcon /> : <FocusIcon />}
        </IconButton>
        <IconButton onClick={onOpenSettings} tip={`Settings (${SK.settings})`} aria="Open settings">
          <SettingsIcon />
        </IconButton>
        <span className="h-5 w-px bg-bd mx-1 shrink-0" aria-hidden="true" />
        <div className="mx-2 flex items-center gap-1.5 text-2xs whitespace-nowrap">
          <StatusDot
            color={dirty ? "var(--yel)" : "var(--t3)"}
            className={dirty ? "animate-pulse2" : ""}
            size={7}
          />
          <span className={`tb-status-label ${dirty ? "text-yeld" : "text-t3"}`}>
            {dirty ? "editing…" : "saved"}
          </span>
        </div>
        <button
          onClick={onSync}
          title={syncMessage || syncLabel(syncStatus)}
          className={`y-tip flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition whitespace-nowrap ${
            syncStatus === "synced"
              ? "bg-s3 text-ch2 hover:bg-bd"
              : syncStatus === "syncing"
                ? "bg-yel/60 text-on-yel"
                : syncStatus === "error"
                  ? "bg-danger/20 text-danger hover:bg-danger/30"
                  : "btn-yel"
          }`}
          data-tip={syncMessage || syncLabel(syncStatus)}
        >
          <SyncIcon size={13} className={syncStatus === "syncing" ? "animate-spin" : ""} />
          <span className="tb-label">Sync</span>
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  tip,
  primary,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  tip: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`y-tip inline-flex items-center gap-1.5 px-2 py-1 rounded transition whitespace-nowrap ${
        primary
          ? "text-ch2 hover:bg-yelp hover:text-yeld"
          : "text-t2 hover:bg-s2 hover:text-char"
      }`}
      data-tip={tip}
    >
      <span className="shrink-0">{icon}</span>
      <span className="tb-label">{label}</span>
    </button>
  );
}

function IconButton({
  onClick,
  tip,
  aria,
  children,
}: {
  onClick: () => void;
  tip: string;
  aria?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria ?? tip}
      className="y-tip w-8 h-8 flex items-center justify-center rounded text-t2 hover:bg-s2 hover:text-char transition"
      data-tip={tip}
    >
      {children}
    </button>
  );
}

function syncLabel(s: Props["syncStatus"]): string {
  switch (s) {
    case "synced": return "Synced";
    case "pending": return "Local changes not yet synced — click to sync";
    case "syncing": return "Syncing…";
    case "error": return "Sync failed — click to retry";
    case "no-remote": return "Click to set up sync";
  }
}
