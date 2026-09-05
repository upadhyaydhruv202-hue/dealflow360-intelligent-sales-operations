import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '../cn';
import { useControllableOpen } from '../hooks';
import { focusRing } from '../styles';

export interface DropdownItem {
  id: string;
  label: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items?: DropdownItem[];
  children?: ReactNode;
  align?: 'start' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
}

export function Dropdown({
  trigger,
  items,
  children,
  align = 'end',
  open: openProp,
  onOpenChange,
  label = 'Open menu',
}: DropdownProps) {
  const [open, setOpen] = useControllableOpen(openProp, onOpenChange);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const enabledItems = (items ?? []).filter((item) => !item.disabled);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent | globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, setOpen]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(0);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!items || items.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (enabledItems.length === 0) {
        return;
      }
      setActiveIndex((current) => (current + 1) % enabledItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (enabledItems.length === 0) {
        return;
      }
      setActiveIndex((current) => (current - 1 + enabledItems.length) % enabledItems.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, enabledItems.length - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = enabledItems[activeIndex];
      item?.onSelect?.();
      setOpen(false);
    }
  }

  const triggerProps = {
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  };

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
        ...triggerProps,
        onClick: (event: { currentTarget?: unknown }) => {
          const original = (trigger as ReactElement<{ onClick?: (event: unknown) => void }>).props.onClick;
          original?.(event);
          setOpen(!open);
        },
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
          const original = (trigger as ReactElement<{ onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void }>)
            .props.onKeyDown;
          original?.(event);
          handleTriggerKeyDown(event);
        },
      })
    : (
        <button
          type="button"
          className={cn('inline-flex', focusRing, 'rounded-lg')}
          aria-label={label}
          {...triggerProps}
          onClick={() => setOpen(!open)}
          onKeyDown={handleTriggerKeyDown}
        >
          {trigger}
        </button>
      );

  return (
    <div ref={rootRef} className="relative inline-flex">
      {triggerNode}
      {open ? (
        <div
          id={menuId}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-44 rounded-xl border border-edge bg-surface-elevated p-1 shadow-panel',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items?.map((item) => {
            const enabledIndex = enabledItems.findIndex((candidate) => candidate.id === item.id);
            const active = !item.disabled && enabledIndex === activeIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  'flex w-full rounded-lg px-3 py-2 text-left text-sm',
                  item.destructive ? 'text-danger' : 'text-foreground',
                  item.disabled && 'cursor-not-allowed opacity-50',
                  active && 'bg-surface-muted',
                )}
                onMouseEnter={() => {
                  if (!item.disabled && enabledIndex >= 0) {
                    setActiveIndex(enabledIndex);
                  }
                }}
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            );
          })}
          {children}
        </div>
      ) : null}
    </div>
  );
}
