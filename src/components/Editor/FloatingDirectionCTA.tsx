import { NewDirectionIcon } from "../../lib/icons";
import { SK } from "../../lib/platform";
import { useT } from "../../lib/i18n";

interface Props {
  onClick: () => void;
}

export default function FloatingDirectionCTA({ onClick }: Props) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      title={t("editor.directionCta.title", { shortcut: SK.newDirection })}
      className="cta-float absolute right-6 bottom-6 z-10 flex items-center gap-2 pl-3 pr-4 py-2.5
                 bg-char text-bg rounded-full shadow-lg hover:bg-ch2 hover:shadow-xl
                 text-xs font-medium"
    >
      <NewDirectionIcon size={14} />
      <span>{t("editor.directionCta.label")}</span>
      <kbd className="opacity-50 text-[10px] font-mono ml-1">⌘⇧N</kbd>
    </button>
  );
}
