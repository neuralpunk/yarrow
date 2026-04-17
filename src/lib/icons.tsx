import {
  GitFork,
  Link2,
  History,
  Search,
  RefreshCw,
  Plus,
  X,
  NotebookPen,
  Unlink,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Settings as SettingsGear,
  CornerDownLeft,
  HelpCircle,
  Command as CommandGlyph,
  FileText,
  Pencil,
  Trash2,
  CircleHelp,
  Sparkles,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

export type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function wrap(Icon: LucideIcon, defaultSize = 14, defaultStroke = 1.8) {
  return function WrappedIcon({
    size = defaultSize,
    className,
    strokeWidth = defaultStroke,
  }: IconProps) {
    return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
  };
}

// Semantic names keep the intent clear and let us re-map if we switch libraries.
export const NewDirectionIcon = wrap(GitFork);
export const ConnectIcon      = wrap(Link2);
export const HistoryIcon      = wrap(History);
export const SearchIcon       = wrap(Search);
export const SyncIcon         = wrap(RefreshCw);
export const PlusIcon         = wrap(Plus, 14, 2);
export const XIcon            = wrap(X, 13, 2);
export const ScratchpadIcon   = wrap(NotebookPen);
export const UnlinkIcon       = wrap(Unlink, 12);
export const FocusIcon        = wrap(Maximize2);
export const ExitFocusIcon    = wrap(Minimize2);
export const ChevronRightIcon = wrap(ChevronRight, 12);
export const ChevronDownIcon  = wrap(ChevronDown, 12);
export const SunIcon          = wrap(Sun);
export const MoonIcon         = wrap(Moon);
export const AutoThemeIcon    = wrap(Monitor);
export const SettingsIcon     = wrap(SettingsGear);
export const EnterKeyIcon     = wrap(CornerDownLeft, 12);
export const HelpIcon         = wrap(HelpCircle, 12, 1.6);
export const HelpCircleIcon   = wrap(CircleHelp, 13);
export const CommandIcon      = wrap(CommandGlyph);
export const NoteIcon         = wrap(FileText);
export const RenameIcon       = wrap(Pencil, 12);
export const DeleteIcon       = wrap(Trash2, 12);
export const SparkIcon        = wrap(Sparkles, 14);
export const JournalIcon      = wrap(CalendarDays);

/** Small circular status indicator, coloured via the given CSS color. */
export function StatusDot({
  color,
  size = 8,
  className,
}: {
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full ${className ?? ""}`}
      style={{ width: size, height: size, background: color }}
    />
  );
}

/** Small keycap badge: <Kbd>⌘K</Kbd>. Uses font-mono for alignment. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="font-mono text-[11px] text-t3 bg-s2 border border-bd rounded px-1.5 py-[1px]"
      style={{ fontFeatureSettings: '"cv02"' }}
    >
      {children}
    </kbd>
  );
}
