// Svelte port of the Phosphor Light icon set.
//
// Mirrors the legacy `icons.tsx` semantic-name aliases so consuming
// .svelte components can `import { NewDirectionIcon } from
// "../lib/icons"` unchanged. Phosphor Svelte components accept the
// same `size`, `weight`, `color`, and `class` props as the React
// version — except call sites must pass `weight="light"` explicitly
// (or leave it default). The legacy React `wrap()` factory enforced
// `weight="light"` everywhere except the right rail, which used
// `weight="regular"`. In Svelte 5 we keep that convention via prop
// pass-through; right-rail buttons set `weight="regular"` inline.
//
// Discipline: pick one weight and stick to it. Mixing Light + Regular
// Phosphor produces the same visual incoherence as mixing Phosphor +
// Lucide. If a glyph needs more emphasis, use colour or scale, never
// a heavier weight. Per-icon stroke overrides are reserved for the
// +/× affordance buttons where heavier weight reads as button intent.

// Path / branching — Path for the editorial "trajectory through
// notes" framing; GitBranch for "branch from here" so the two
// adjacent rail buttons don't read as the same action.
import Path from "phosphor-svelte/lib/Path";
import GitBranch from "phosphor-svelte/lib/GitBranch";
// Connections + history
import LinkSimple from "phosphor-svelte/lib/LinkSimple";
import LinkBreak from "phosphor-svelte/lib/LinkBreak";
import ClockCounterClockwise from "phosphor-svelte/lib/ClockCounterClockwise";
// Search + sync
import MagnifyingGlass from "phosphor-svelte/lib/MagnifyingGlass";
import ArrowsClockwise from "phosphor-svelte/lib/ArrowsClockwise";
// Affordances
import Plus from "phosphor-svelte/lib/Plus";
import X from "phosphor-svelte/lib/X";
import CornersOut from "phosphor-svelte/lib/CornersOut";
import CornersIn from "phosphor-svelte/lib/CornersIn";
import CaretRight from "phosphor-svelte/lib/CaretRight";
import CaretDown from "phosphor-svelte/lib/CaretDown";
// Themes
import Sun from "phosphor-svelte/lib/Sun";
import Moon from "phosphor-svelte/lib/Moon";
import Desktop from "phosphor-svelte/lib/Desktop";
// Chrome
import Gear from "phosphor-svelte/lib/Gear";
import ArrowElbowDownLeft from "phosphor-svelte/lib/ArrowElbowDownLeft";
import Question from "phosphor-svelte/lib/Question";
import Command from "phosphor-svelte/lib/Command";
// Notes + journal
import NotePencil from "phosphor-svelte/lib/NotePencil";
import FileText from "phosphor-svelte/lib/FileText";
import Pencil from "phosphor-svelte/lib/Pencil";
import Trash from "phosphor-svelte/lib/Trash";
import Sparkle from "phosphor-svelte/lib/Sparkle";
import CalendarDots from "phosphor-svelte/lib/CalendarDots";
import Pulse from "phosphor-svelte/lib/Pulse";
import CheckSquare from "phosphor-svelte/lib/CheckSquare";
import FolderSimplePlus from "phosphor-svelte/lib/FolderSimplePlus";
import CaretUp from "phosphor-svelte/lib/CaretUp";

/** Stroke width should optically match the weight of surrounding text.
 *  The recommended scale (Yarrow visual-polish doc §6.1, tuned a touch
 *  heavier than the strict ratio because Yarrow's chrome runs at body
 *  weight 425 on Linux/webkit2gtk where lighter strokes shimmer):
 *
 *    ≤ 12 px → 1.5    20 px → 1.85
 *    14 px   → 1.65   24 px → 2.0
 *    16 px   → 1.75   32 px+ → 2.25
 *
 *  Phosphor Light targets ~1.5 px at 16 px natively, so the values
 *  above are now a sanity-bound the Phosphor weight already meets.
 *  We keep the helper exported for any inline SVG icons elsewhere
 *  in the codebase that want to follow the same scale. */
export function strokeForSize(size: number): number {
  if (size <= 12) return 1.5;
  if (size <= 14) return 1.65;
  if (size <= 16) return 1.75;
  if (size <= 20) return 1.85;
  if (size <= 24) return 2.0;
  return 2.25;
}

// Semantic re-exports — same names as the legacy icons.tsx so
// component imports stay one-to-one across the migration.
export {
  Path as NewDirectionIcon,
  GitBranch as BranchHereIcon,
  LinkSimple as ConnectIcon,
  ClockCounterClockwise as HistoryIcon,
  MagnifyingGlass as SearchIcon,
  ArrowsClockwise as SyncIcon,
  Plus as PlusIcon,
  X as XIcon,
  NotePencil as ScratchpadIcon,
  LinkBreak as UnlinkIcon,
  CornersOut as FocusIcon,
  CornersIn as ExitFocusIcon,
  CaretRight as ChevronRightIcon,
  CaretDown as ChevronDownIcon,
  Sun as SunIcon,
  Moon as MoonIcon,
  Desktop as AutoThemeIcon,
  Gear as SettingsIcon,
  ArrowElbowDownLeft as EnterKeyIcon,
  Question as HelpIcon,
  Question as HelpCircleIcon,
  Command as CommandIcon,
  FileText as NoteIcon,
  Pencil as RenameIcon,
  Trash as DeleteIcon,
  Sparkle as SparkIcon,
  CalendarDots as JournalIcon,
  Pulse as ActivityIcon,
  CheckSquare as SelectModeIcon,
  FolderSimplePlus as NewFolderIcon,
  CaretUp as ChevronUpIcon,
};
