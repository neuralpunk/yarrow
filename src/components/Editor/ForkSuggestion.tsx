import { NewDirectionIcon } from "../../lib/icons";
import { useT } from "../../lib/i18n";

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function ForkSuggestion({ visible, onAccept, onDismiss }: Props) {
  const t = useT();
  if (!visible) return null;
  return (
    <div className="absolute bottom-6 right-8 z-20 max-w-sm bg-bg border border-yel/60 rounded-xl shadow-lg p-3 animate-slideUp">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-yel">
          <NewDirectionIcon size={18} strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div className="text-sm text-char font-medium mb-0.5">
            {t("editor.forkSuggestion.title")}
          </div>
          <div className="text-xs text-t2 mb-2 leading-relaxed">
            {t("editor.forkSuggestion.body")}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="px-2.5 py-1 text-xs bg-yel text-on-yel rounded hover:bg-yel2"
            >
              {t("editor.forkSuggestion.accept")}
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 text-xs text-t2 hover:text-char"
            >
              {t("editor.forkSuggestion.dismiss")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
