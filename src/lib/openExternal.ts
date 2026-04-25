// Centralized handling for external URLs. Without this, an `<a href="https://…">`
// click inside the Tauri webview navigates the webview itself — there's no
// browser chrome, so the user is trapped and has to force-quit the app.
//
// Strategy:
//  1. Always try to hand the URL off to the OS default browser via plugin-opener.
//  2. If that ever fails (extremely rare on desktop), dispatch a fallback
//     event that App.tsx mounts a modal for, so the user still has a clear
//     way out instead of being stranded mid-navigation.

import { openUrl } from "@tauri-apps/plugin-opener";

export const EXTERNAL_FALLBACK_EVENT = "yarrow:external-url-fallback";

export function isExternalHref(href: string): boolean {
  return /^(https?|mailto|tel):/i.test(href);
}

export function openExternal(url: string): void {
  openUrl(url).catch(() => {
    window.dispatchEvent(
      new CustomEvent(EXTERNAL_FALLBACK_EVENT, { detail: { url } }),
    );
  });
}

// Document-level capture handler: catches any `<a href="http(s)://…">` click
// the app might render — note bodies, wikilink previews, settings pages,
// future surfaces — without each component having to remember to wire it up.
// Capture phase runs before React's bubble-phase delegation, so this fires
// first regardless of where the anchor lives.
export function installExternalLinkInterceptor(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented) return;
    const a = (e.target as HTMLElement | null)?.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!isExternalHref(href)) return;
    e.preventDefault();
    e.stopPropagation();
    openExternal(href);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

