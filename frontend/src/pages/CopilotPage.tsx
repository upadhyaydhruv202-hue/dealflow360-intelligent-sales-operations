import { useMemo, useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { CopilotChat, type CopilotChatMessage } from '../components/CopilotChat';
import { getApiErrorMessage } from '../services/api';
import { clearCopilotConversation, sendCopilotMessage } from '../services/copilot';
import { Breadcrumb, PageContainer } from '../ui';

export function CopilotPage() {
  const { accessToken } = useAuth();
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<CopilotChatMessage[]>([]);
  const [lastUserMessage, setLastUserMessage] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const pendingConfirmation = useMemo(
    () => messages.some((message) => message.tools?.some((tool) => tool.status === 'pending_confirmation')),
    [messages],
  );

  async function runTurn(input: { message?: string; confirm?: boolean }) {
    if (!accessToken) {
      setError('Sign in to use Copilot.');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const result = await sendCopilotMessage(
        {
          message: input.message,
          conversationId,
          confirm: input.confirm,
        },
        accessToken,
      );
      setConversationId(result.conversationId);
      setMessages((current) => {
        const next = [...current];
        if (input.message) {
          next.push({ id: `user-${result.message.id}`, role: 'user', content: input.message });
        }
        next.push({
          id: result.message.id,
          role: 'assistant',
          content: result.message.content,
          confidence: result.message.confidence,
          evidence: result.message.evidence,
          error: result.message.errorCode,
          tools: result.tools,
        });
        return next;
      });
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Copilot' }]} />}
      title="Copilot"
      description="Controlled assistant with an allowlisted tool registry. It cannot run arbitrary SQL, JavaScript, shell, HTTP, or Odoo methods."
    >
      <SessionGate title="Sign in to use Copilot" hint="Manager and admin roles have copilot.use after seed.">
        <CopilotChat
          messages={messages}
          loading={loading}
          error={error}
          disabled={!accessToken}
          pendingConfirmation={pendingConfirmation}
          onSend={(message) => {
            setLastUserMessage(message);
            void runTurn({ message });
          }}
          onRetry={() => {
            if (lastUserMessage) {
              void runTurn({ message: lastUserMessage });
            }
          }}
          onClear={() => {
            if (conversationId && accessToken) {
              void clearCopilotConversation(conversationId, accessToken).catch((caught) => {
                setError(toErrorMessage(caught));
              });
            }
            setMessages([]);
            setConversationId(undefined);
          }}
          onConfirm={() => {
            void runTurn({ confirm: true });
          }}
        />
      </SessionGate>
    </PageContainer>
  );
}

function toErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, 'The copilot request failed');
}
