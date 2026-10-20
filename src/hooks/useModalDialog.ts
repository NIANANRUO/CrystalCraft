import { useEffect, useRef } from 'react';

const openDialogs: HTMLElement[] = [];

/** Keep keyboard navigation and Escape inside the topmost dialog. */
export function useModalDialog(onClose: () => void, isOpen = true) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(dialog);
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    )).filter(element => element.getClientRects().length > 0);
    (focusable()[0] || dialog).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0] || dialog;
        const last = elements[elements.length - 1] || dialog;
        if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      const index = openDialogs.indexOf(dialog);
      if (index !== -1) openDialogs.splice(index, 1);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
