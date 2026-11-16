"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Native modal dialog provides focus trapping, inert background and Escape. */
export function NavigationDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(360px,90vw)] max-w-none border-r border-border bg-background p-0 text-foreground backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-[var(--topbar-h)] shrink-0 items-center justify-between border-b border-border px-6">
          <span className="label">{title}</span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="grid size-11 place-items-center"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
          {children}
        </div>
      </div>
    </dialog>
  );
}
