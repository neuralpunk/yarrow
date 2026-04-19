import { NewDirectionIcon } from "../../lib/icons";
import { SK } from "../../lib/platform";

interface Props {
  onClick: () => void;
}

export default function FloatingDirectionCTA({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title={`Try another version (${SK.newDirection})`}
      className="cta-float absolute right-6 bottom-6 z-10 flex items-center gap-2 pl-3 pr-4 py-2.5
                 bg-char text-bg rounded-full shadow-lg hover:bg-ch2 hover:shadow-xl
                 text-xs font-medium"
    >
      <NewDirectionIcon size={14} />
      <span>Try another version</span>
      <kbd className="opacity-50 text-[10px] font-mono ml-1">⌘⇧N</kbd>
    </button>
  );
}
