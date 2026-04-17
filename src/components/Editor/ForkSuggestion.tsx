import { NewDirectionIcon } from "../../lib/icons";

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function ForkSuggestion({ visible, onAccept, onDismiss }: Props) {
  if (!visible) return null;
  return (
    <div className="absolute bottom-6 right-8 z-20 max-w-sm bg-bg border border-yel/60 rounded-xl shadow-lg p-3 animate-slideUp">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-yel">
          <NewDirectionIcon size={18} strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div className="text-sm text-char font-medium mb-0.5">
            Explore a different direction?
          </div>
          <div className="text-xs text-t2 mb-2 leading-relaxed">
            This paragraph sounds like it's pulling against what came before.
            You can branch off to try it out without losing the current take.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="px-2.5 py-1 text-xs bg-yel text-char rounded hover:bg-yel2"
            >
              Yes, explore it
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 text-xs text-t2 hover:text-char"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
