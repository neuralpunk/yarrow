import { getCurrentWindow } from "@tauri-apps/api/window";
import Logo from "./Logo";
import { APP_VERSION } from "../lib/version";

interface Props {
  workspaceName?: string;
}

export default function Titlebar({ workspaceName }: Props) {
  const win = getCurrentWindow();
  return (
    <div
      data-tauri-drag-region
      className="h-8 shrink-0 flex items-center px-3 gap-2 bg-bg-soft border-b border-bd select-none"
    >
      <Logo size={14} className="shrink-0 opacity-80 pointer-events-none" />
      <span
        data-tauri-drag-region
        className="font-serif text-[13px] text-char pointer-events-none"
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
      <div className="ml-auto flex items-center gap-0.5">
        <WinBtn onClick={() => win.minimize()} label="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 5H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()} label="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" strokeWidth="1.2" rx="1" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => win.close()} label="Close" danger>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </WinBtn>
      </div>
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
