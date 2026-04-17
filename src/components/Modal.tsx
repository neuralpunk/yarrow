import { ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, children, width = "w-[420px]" }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-char/10 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <div
        className={`${width} bg-bg border border-bd2 rounded-xl shadow-2xl p-5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="font-serif text-xl mb-3 text-char">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
