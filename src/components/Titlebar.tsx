import { getCurrentWindow } from "@tauri-apps/api/window";
import { APP_VERSION } from "../lib/version";
import { useT } from "../lib/i18n";

interface Props {
  workspaceName?: string;
}

// Platform detection at module load. The window-control story differs
// per OS:
//
//   · macOS — `titleBarStyle: "Overlay"` draws traffic lights at the
//     top-left of the webview. Our custom Titlebar shares that strip,
//     so we pad the wordmark clear of them and skip our own buttons
//     entirely (would conflict with the OS-drawn ones).
//   · Windows — `decorations: true` always paints a standard title
//     bar with native min / max / close in the OS's expected place.
//     Our Titlebar is the identity strip *below* it; rendering our
//     own buttons would be a confusing duplicate.
//   · Linux — even with `decorations: true`, GNOME Mutter (and some
//     other Wayland compositors) decline to draw server-side
//     decorations. Apps without their own controls become unclosable
//     except via keyboard shortcut. So we keep our custom buttons
//     here as a defensive fallback. KDE / XFCE users will see a
//     native bar above plus ours below — slight redundancy, but
//     cheap insurance against the no-chrome case.
//   · `unknown` — same fallback as Linux.
const PLATFORM: "mac" | "windows" | "linux" | "unknown" = (() => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = (navigator.userAgent || "").toLowerCase();
  const p = (navigator.platform || "").toLowerCase();
  if (p.includes("mac") || /iphone|ipad|ipod/.test(p) || /mac os x/.test(ua)) return "mac";
  if (p.includes("win") || /windows/.test(ua)) return "windows";
  if (p.includes("linux") || /linux|x11/.test(ua)) return "linux";
  return "unknown";
})();

const IS_MAC = PLATFORM === "mac";
const SHOW_CUSTOM_CONTROLS = PLATFORM === "linux" || PLATFORM === "unknown";

export default function Titlebar({ workspaceName }: Props) {
  const t = useT();
  const win = SHOW_CUSTOM_CONTROLS ? getCurrentWindow() : null;
  return (
    <div
      data-tauri-drag-region
      className={`h-8 shrink-0 flex items-center gap-2 bg-bg-soft border-b border-bd select-none ${
        IS_MAC ? "pl-[80px] pr-3" : "px-3"
      }`}
    >
      <span
        data-tauri-drag-region
        className="font-serif italic text-[14px] text-char pointer-events-none"
      >
        Yarrow
      </span>
      <span
        data-tauri-drag-region
        className="text-2xs text-t3 font-mono pointer-events-none"
      >
        v{APP_VERSION}
      </span>
      {workspaceName && (
        <>
          <span
            data-tauri-drag-region
            className="text-t3 text-xs pointer-events-none"
          >
            ·
          </span>
          <span
            data-tauri-drag-region
            className="text-xs text-t2 truncate pointer-events-none"
          >
            {workspaceName}
          </span>
        </>
      )}
      {SHOW_CUSTOM_CONTROLS && win && (
        <div className="ml-auto flex items-center gap-0.5">
          <WinBtn onClick={() => win.minimize()} label={t("modals.titlebar.minimize")}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </WinBtn>
          <WinBtn onClick={() => win.toggleMaximize()} label={t("modals.titlebar.maximize")}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1.2" rx="1" />
            </svg>
          </WinBtn>
          <WinBtn onClick={() => win.close()} label={t("modals.titlebar.close")} danger>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </WinBtn>
        </div>
      )}
    </div>
  );
}

function WinBtn({
  onClick,
  label,
  children,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-7 h-6 flex items-center justify-center rounded transition text-t2 ${
        danger ? "hover:bg-danger hover:text-bg" : "hover:bg-s2 hover:text-char"
      }`}
    >
      {children}
    </button>
  );
}
