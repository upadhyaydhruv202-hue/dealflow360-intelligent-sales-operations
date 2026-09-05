import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../cn';
import { focusRing } from '../styles';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ items, value, defaultValue, onChange, className }: TabsProps) {
  const tablistId = useId();
  const enabled = items.filter((item) => !item.disabled);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? enabled[0]?.id ?? items[0]?.id);
  const selected = value ?? uncontrolled;

  function selectTab(id: string) {
    if (value === undefined) {
      setUncontrolled(id);
    }
    onChange?.(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = enabled.findIndex((item) => item.id === selected);
    if (currentIndex < 0) {
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = enabled[(currentIndex + delta + enabled.length) % enabled.length];
      selectTab(next.id);
      document.getElementById(`${tablistId}-${next.id}`)?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectTab(enabled[0].id);
      document.getElementById(`${tablistId}-${enabled[0].id}`)?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const last = enabled[enabled.length - 1];
      selectTab(last.id);
      document.getElementById(`${tablistId}-${last.id}`)?.focus();
    }
  }

  const active = items.find((item) => item.id === selected) ?? items[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex gap-1 border-b border-edge"
        onKeyDown={handleKeyDown}
      >
        {items.map((item) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              id={`${tablistId}-${item.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${tablistId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              className={cn(
                '-mb-px rounded-t-lg px-3 py-2 text-sm font-medium',
                focusRing,
                isSelected
                  ? 'border-b-2 border-accent text-foreground'
                  : 'text-foreground-muted hover:text-foreground',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
              onClick={() => selectTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          id={`${tablistId}-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`${tablistId}-${active.id}`}
          className="pt-4"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
