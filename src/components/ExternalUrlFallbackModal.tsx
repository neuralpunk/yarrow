import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EXTERNAL_FALLBACK_EVENT } from "../lib/openExternal";
import { useT } from "../lib/i18n";

// Shown only when handing a URL off to the OS browser fails. Modern desktop
// platforms make that essentially never happen, but if it does the user
// still needs a way to see the URL, copy it, retry, or simply close — never
// trapped. Renders an iframe so sites that permit embedding still load
// inline; sites that block embedding (most of them, via X-Frame-Options /
// frame-ancestors) just show a blank pane, but the chrome bar always works.
export default function ExternalUrlFallbackModal() {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const t = useT();

  useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) setUrl(detail.url);
    };
    window.addEventListener(EXTERNAL_FALLBACK_EVENT, onEvt);
    return () => window.removeEventListener(EXTERNAL_FALLBACK_EVENT, onEvt);
  }, []);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url]);

  if (!url) return null;

  const close = () => setUrl(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // No clipboard permission — leave the URL visible so the user can
      // select it manually from the address bar.
    }
  };
  const retry = () => {
    openUrl(url).then(close).catch(() => {
      // Still failing — keep the modal open. The user has copy + close.
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      aria-label={t("modals.externalUrl.dialogLabel")}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-bd2 bg-s1 text-sm">
        <span className="text-t3 text-xs flex-shrink-0">{t("modals.externalUrl.urlLabel")}</span>
        <span
          className="font-mono text-xs text-char truncate flex-1 select-text"
          title={url}
        >
          {url}
        </span>
        <button
          type="button"
          onClick={copy}
          className="px-2 py-1 rounded text-xs text-t2 hover:text-char hover:bg-s2 transition"
        >
          {copied ? t("modals.externalUrl.copied") : t("modals.externalUrl.copy")}
        </button>
        <button
          type="button"
          onClick={retry}
          className="px-2 py-1 rounded text-xs text-t2 hover:text-char hover:bg-s2 transition"
        >
          {t("modals.externalUrl.openInBrowser")}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label={t("modals.modal.closeEsc")}
          title={t("modals.modal.closeEsc")}
          className="w-7 h-7 rounded flex items-center justify-center text-t3 hover:text-char hover:bg-s2 transition"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M 3 3 L 11 11 M 11 3 L 3 11" />
          </svg>
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={url}
        className="flex-1 w-full bg-bg"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        title={t("modals.externalUrl.iframeTitle", { url })}
      />
    </div>
  );
}
