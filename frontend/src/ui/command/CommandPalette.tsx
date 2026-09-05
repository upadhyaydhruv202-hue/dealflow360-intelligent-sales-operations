import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, Moon, Search, SunMedium } from 'lucide-react';

import { useOptionalAuth } from '../../auth/AuthProvider';
import { useOptionalFeatures } from '../../features';
import { appNavGroups } from '../../layouts/nav';
import { hasPermission } from '../../lib/rbac';
import { apiGet } from '../../services/api';
import { cn } from '../cn';
import { useTheme } from '../theme/ThemeProvider';

interface QuoteHit {
  id: string;
  number: string;
  status: string;
  customer?: { name?: string };
}

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const features = useOptionalFeatures();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [quotes, setQuotes] = useState<QuoteHit[]>([]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
      return;
    }
    if (!auth?.accessToken || !hasPermission(auth.user, 'dealflow.quotes.read')) {
      return;
    }
    let cancelled = false;
    void apiGet<QuoteHit[]>('/api/v1/dealflow/quotes', auth.accessToken)
      .then((rows) => {
        if (!cancelled) setQuotes(rows);
      })
      .catch(() => {
        if (!cancelled) setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.accessToken, auth?.user, open]);

  const items = useMemo(() => {
    const commands: CommandItem[] = [];
    for (const group of appNavGroups) {
      for (const item of group.items) {
        if (item.feature && features?.isEnabled(item.feature) !== true) {
          continue;
        }
        commands.push({
          id: `nav-${item.to}`,
          label: item.command ?? item.label,
          hint: item.to,
          group: 'Navigate',
          onSelect: () => navigate(item.to),
        });
      }
    }
    if (hasPermission(auth?.user, 'dealflow.quotes.write')) {
      commands.push({
        id: 'create-quote',
        label: 'Create quotation',
        hint: 'New quote',
        group: 'Actions',
        onSelect: () => navigate('/dealflow/quotes?new=1'),
      });
    }
    commands.push({
      id: 'theme',
      label: resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      hint: 'Theme',
      group: 'Preferences',
      onSelect: () => toggleTheme(),
    });
    if (auth?.isAuthenticated) {
      commands.push({
        id: 'logout',
        label: 'Sign out',
        group: 'Account',
        onSelect: () => {
          void auth.logout();
          navigate('/login');
        },
      });
    } else {
      commands.push({
        id: 'login',
        label: 'Sign in',
        group: 'Account',
        onSelect: () => navigate('/login'),
      });
    }
    const haystack = query.trim().toLowerCase();
    const filtered = haystack
      ? commands.filter((item) => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(haystack))
      : commands;
    const quoteHits = haystack
      ? quotes
          .filter((quote) => `${quote.number} ${quote.customer?.name ?? ''}`.toLowerCase().includes(haystack))
          .slice(0, 6)
          .map((quote) => ({
            id: `quote-${quote.id}`,
            label: `${quote.number} · ${quote.customer?.name ?? 'Customer'}`,
            hint: quote.status.replaceAll('_', ' '),
            group: 'Records',
            onSelect: () => navigate(`/dealflow/quotes/${quote.id}`),
          }))
      : [];
    return [...quoteHits, ...filtered];
  }, [auth, features, navigate, query, quotes, resolvedTheme, toggleTheme]);

  useEffect(() => {
    setActive(0);
  }, [query, items.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((current) => (current + 1) % Math.max(items.length, 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((current) => (current - 1 + items.length) % Math.max(items.length, 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = items[active];
        if (item) {
          item.onSelect();
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items, onClose, open]);

  if (!open) {
    return null;
  }

  const groups = [...new Set(items.map((item) => item.group))];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0 bg-foreground/30" aria-label="Close command palette" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-panel border border-edge bg-surface-elevated shadow-panel"
      >
        <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
          <Search className="h-4 w-4 text-foreground-muted" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, records, or actions"
            className="w-full bg-transparent text-sm outline-none placeholder:text-foreground-muted"
            aria-label="Command search"
          />
          <kbd className="hidden rounded-md border border-edge px-1.5 py-0.5 text-[10px] text-foreground-muted sm:inline">esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-foreground-muted">No matching commands.</li>
          ) : (
            groups.map((group) => (
              <li key={group}>
                <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  {group}
                </p>
                <ul>
                  {items
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const index = items.indexOf(item);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={index === active}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-df',
                              index === active
                                ? 'bg-surface-muted text-foreground'
                                : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
                            )}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => {
                              item.onSelect();
                              onClose();
                            }}
                          >
                            <span className="flex items-center gap-2">
                              {item.id === 'create-quote' ? <FilePlus2 className="h-3.5 w-3.5" /> : null}
                              {item.id === 'theme' ? (
                                resolvedTheme === 'dark' ? (
                                  <SunMedium className="h-3.5 w-3.5" />
                                ) : (
                                  <Moon className="h-3.5 w-3.5" />
                                )
                              ) : null}
                              {item.label}
                            </span>
                            {item.hint ? <span className="text-caption text-foreground-muted">{item.hint}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { open, setOpen };
}
