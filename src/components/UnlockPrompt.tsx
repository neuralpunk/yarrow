import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import { useT } from "../lib/i18n";

interface Props {
  open: boolean;
  reason?: string;
  onUnlocked: () => void;
  onClose: () => void;
}

/**
 * Blocking overlay that asks for the workspace password before decrypting a
 * locked note. Also offers the "I forgot" path that hands off to recovery.
 *
 * Kept dead simple: one password field, show/hide toggle, optional recovery
 * expand. The idle-lock timer lives in the backend; this component only
 * handles the actual unlock call.
 */
export default function UnlockPrompt({ open, reason, onUnlocked, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [newPw, setNewPw] = useState("");
  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setPassword(""); setPhrase(""); setNewPw("");
    setMode("password"); setBusy(false); setError(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === "password") {
        await api.unlockEncryption(password);
      } else {
        await api.recoverEncryption(phrase.trim(), newPw);
      }
      onUnlocked();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-char/40 animate-fadeIn"
      onMouseDown={onClose}
    >
      <div
        className="w-[440px] max-w-[92vw] bg-bg border border-bd2 rounded-xl shadow-2xl p-5 animate-slideUp"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <LockIcon />
          <h2 className="font-serif text-xl text-char">{t("modals.unlock.title")}</h2>
        </div>
        <p className="text-xs text-t2 mb-4 leading-relaxed">
          {reason ?? t("modals.unlock.defaultReason")}
        </p>

        {mode === "password" ? (
          <>
            <label className="text-xs text-t2 block mb-1">{t("modals.unlock.passwordLabel")}</label>
            <div className="flex items-center gap-2 mb-3">
              <input
                ref={inputRef}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                className="flex-1 px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm"
                placeholder={t("modals.unlock.passwordPlaceholder")}
              />
              <button
                type="button"
                onClick={() => setShowPw((x) => !x)}
                className="text-2xs text-t2 hover:text-char px-2 py-1 rounded"
              >
                {showPw ? t("modals.unlock.hide") : t("modals.unlock.show")}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="text-xs text-t2 block mb-1">{t("modals.unlock.recoveryLabel")}</label>
            <textarea
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-xs mb-3 resize-none"
              rows={2}
              placeholder={t("modals.unlock.recoveryPlaceholder")}
            />
            <label className="text-xs text-t2 block mb-1">{t("modals.unlock.newPasswordLabel")}</label>
            <input
              type={showPw ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              className="w-full px-3 py-2 bg-bg border border-bd rounded-md text-char font-mono text-sm mb-3"
              placeholder={t("modals.unlock.newPasswordPlaceholder")}
            />
            <p className="text-2xs text-t3 mb-3 leading-relaxed">
              {t("modals.unlock.recoveryNote")}
            </p>
          </>
        )}

        {error && (
          <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "password" ? "recovery" : "password")}
            className="text-2xs text-t2 hover:text-char"
          >
            {mode === "password" ? t("modals.unlock.forgot") : t("modals.unlock.usePassword")}
          </button>
          <div className="ml-auto flex gap-2">
            <button
              className="px-3 py-1.5 text-sm text-t2 hover:text-char"
              onClick={onClose}
            >
              {t("modals.unlock.notNow")}
            </button>
            <button
              className="btn-yel px-3 py-1.5 text-sm rounded-md"
              onClick={submit}
              disabled={
                busy ||
                (mode === "password" ? !password : !phrase.trim() || newPw.length < 8)
              }
            >
              {busy ? t("modals.unlock.unlocking") : mode === "password" ? t("modals.unlock.unlock") : t("modals.unlock.resetUnlock")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-yel">
      <rect x="2.5" y="6.5" width="9" height="6" rx="1.2" />
      <path d="M4.5 6.5V4.5a2.5 2.5 0 1 1 5 0v2" />
    </svg>
  );
}
