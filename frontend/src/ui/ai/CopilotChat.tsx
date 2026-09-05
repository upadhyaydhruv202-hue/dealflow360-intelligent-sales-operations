import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Button } from '../primitives/Button';
import { AiConfidenceBadge, AiLoadingState, EvidencePanel, ToolActivityIndicator, type ToolActivity } from './AiPrimitives';

export type CopilotRole = 'user' | 'assistant';

export type CopilotChatTool = ToolActivity;

export interface CopilotChatMessage {
  id: string;
  role: CopilotRole;
  content: string;
  confidence?: number;
  evidence?: string;
  error?: string;
  tools?: CopilotChatTool[];
}

export function CopilotChat({
  messages,
  loading = false,
  error,
  disabled = false,
  pendingConfirmation = false,
  onSend,
  onRetry,
  onClear,
  onConfirm,
}: {
  messages: CopilotChatMessage[];
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  pendingConfirmation?: boolean;
  onSend: (message: string) => void;
  onRetry?: () => void;
  onClear?: () => void;
  onConfirm?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, loading]);

  function submitDraft() {
    const value = draft.trim();
    if (!value || loading || disabled) {
      return;
    }
    onSend(value);
    setDraft('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitDraft();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitDraft();
    }
  }

  return (
    <section className="flex h-[36rem] flex-col rounded-xl border border-edge bg-surface-elevated shadow-sm">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Copilot</h2>
          <p className="text-xs text-foreground-muted">Allowlisted tools only. High-risk actions need confirmation.</p>
        </div>
        <div className="flex gap-2">
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry} disabled={loading || disabled}>
              Retry
            </Button>
          ) : null}
          {onClear ? (
            <Button variant="outline" size="sm" onClick={onClear} disabled={loading || disabled}>
              Clear
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !loading ? (
          <p className="text-sm text-foreground-muted">
            Ask a question. The copilot can only use approved application tools.
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            data-role={message.role}
            className={
              message.role === 'user'
                ? 'ml-8 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground'
                : 'mr-8 rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground'
            }
          >
            <p>{message.content}</p>
            {message.confidence != null ? (
              <div className="mt-2">
                <AiConfidenceBadge value={message.confidence} />
              </div>
            ) : null}
            {message.evidence ? <EvidencePanel items={[message.evidence]} /> : null}
            {message.error ? <p className="mt-1 text-xs text-danger">{message.error}</p> : null}
            {message.tools && message.tools.length > 0 ? <ToolActivityIndicator tools={message.tools} /> : null}
          </article>
        ))}
        {loading ? <AiLoadingState /> : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-4 pb-2 text-sm text-danger">{error}</p> : null}

      {pendingConfirmation && onConfirm ? (
        <div className="border-t border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-sm text-foreground">A high-risk tool is waiting for confirmation.</p>
          <Button className="mt-2" size="sm" variant="secondary" onClick={onConfirm} disabled={loading || disabled}>
            Confirm action
          </Button>
        </div>
      ) : null}

      <form className="border-t border-edge p-3" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="copilot-message">
          Message
        </label>
        <textarea
          id="copilot-message"
          name="message"
          rows={2}
          className="w-full rounded-lg border border-edge bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none ring-accent focus:ring-2 disabled:bg-surface-muted"
          placeholder="Ask the copilot…"
          disabled={loading || disabled}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={loading || disabled}>
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}
