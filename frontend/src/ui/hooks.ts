import { useCallback, useEffect, useId, useState, type RefObject } from 'react';

export function useControllableOpen(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  defaultOpen = false,
) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const value = isControlled ? open : uncontrolled;

  const setValue = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolled(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return [value, setValue] as const;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reduced;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement>, onEscape?: () => void) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = getFocusableElements(container);
    (focusables[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab' || !container) {
        return;
      }

      const items = getFocusableElements(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [active, containerRef, onEscape]);
}

export function useStableId(prefix: string, id?: string) {
  const generated = useId();
  return id ?? `${prefix}-${generated}`;
}
