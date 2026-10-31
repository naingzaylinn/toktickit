import { useLayoutEffect, useRef, type RefObject } from "react";

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Caller captures the trigger before asynchronous opening and supplies a safe
// fallback. Cleanup restores only while the originating screen is current.
export function useDialogFocus({ open, dialog, initial, trigger, fallback, onEscape, canRestore }: {
  open: boolean;
  dialog: RefObject<HTMLDivElement>;
  initial: () => HTMLElement | null;
  trigger: RefObject<HTMLElement | null>;
  fallback: () => HTMLElement | null;
  onEscape: () => void;
  canRestore: () => boolean;
}) {
  const latest = useRef({ initial, fallback, onEscape, canRestore });
  latest.current = { initial, fallback, onEscape, canRestore };
  useLayoutEffect(() => {
    const root = dialog.current;
    if (!open || !root) return;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>(focusable)).filter(el => !el.hidden && !el.closest('[hidden], [inert]'));
    (latest.current.initial() ?? controls()[0] ?? root).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); latest.current.onEscape(); }
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (!root.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) (latest.current.initial() ?? controls()[0] ?? root).focus();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", containFocus);
      if (latest.current.canRestore()) {
        const origin = trigger.current;
        (origin?.isConnected && !origin.matches(":disabled") ? origin : latest.current.fallback())?.focus();
      }
    };
  }, [open, dialog, trigger]);
}
