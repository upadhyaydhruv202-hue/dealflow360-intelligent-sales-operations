import { useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import { askRag, indexRagDocument, type RagAnswer } from '../services/rag';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardHeader,
  CardTitle,
  AiConfidenceBadge,
  EvidencePanel,
  PageContainer,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

const SAMPLE_DOCUMENT = [
  'Refund policy for late shipments.',
  'Customers may request a refund within 14 days of delivery when a shipment arrives late.',
  'Refunds are issued to the original payment method.',
].join(' ');

export function RagPage() {
  const { accessToken } = useAuth();
  const [source, setSource] = useState('Refund policy');
  const [text, setText] = useState(SAMPLE_DOCUMENT);
  const [query, setQuery] = useState('What is the refund window for a late shipment?');
  const [indexedId, setIndexedId] = useState<string>();
  const [indexStatus, setIndexStatus] = useState<'indexed' | 'processing'>();
  const [answer, setAnswer] = useState<RagAnswer>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function indexSample() {
    if (!accessToken) {
      setError('Sign in to index documents.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const result = await indexRagDocument({ source, text, async: false }, accessToken);
      setIndexedId(result.documentId);
      setIndexStatus(result.status);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Indexing failed'));
    } finally {
      setLoading(false);
    }
  }

  async function ask() {
    if (!accessToken) {
      setError('Sign in to ask a question.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      setAnswer(await askRag({ query }, accessToken));
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'The RAG request failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'RAG' }]} />}
      title="Semantic search"
      description="Optional retrieval-augmented generation. Documents are treated as untrusted data. Answers must cite retrieved chunks and must not invent facts when evidence is missing."
    >
      <SessionGate
        title="Sign in to use RAG"
        hint="Manager and admin roles have rag.use after seed."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Index a document</CardTitle>
            </CardHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void indexSample();
              }}
            >
              <div>
                <label className={labelClass} htmlFor="rag-source">
                  Source
                </label>
                <input
                  id="rag-source"
                  className={`${controlBase} mt-1`}
                  value={source}
                  disabled={loading || !accessToken}
                  onChange={(event) => setSource(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="rag-text">
                  Text
                </label>
                <textarea
                  id="rag-text"
                  className={`${controlBase} mt-1 min-h-32`}
                  value={text}
                  disabled={loading || !accessToken}
                  onChange={(event) => setText(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !accessToken} loading={loading}>
                Index document
              </Button>
              {indexedId ? (
                <p className="text-xs text-foreground-muted">
                  {indexStatus === 'processing' ? 'Indexing' : 'Indexed'} <code>{indexedId}</code>
                </p>
              ) : null}
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ask</CardTitle>
            </CardHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void ask();
              }}
            >
              <div>
                <label className={labelClass} htmlFor="rag-query">
                  Question
                </label>
                <textarea
                  id="rag-query"
                  className={`${controlBase} mt-1 min-h-24`}
                  value={query}
                  disabled={loading || !accessToken}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !accessToken} loading={loading}>
                Ask with sources
              </Button>
            </form>
          </Card>
        </div>

        {error ? (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        ) : null}

        {answer ? <RagAnswerCard answer={answer} /> : null}
      </SessionGate>
    </PageContainer>
  );
}

function RagAnswerCard({ answer }: { answer: RagAnswer }) {
  return (
    <Card className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>Answer</CardTitle>
        <Badge tone={answer.grounded ? 'success' : 'warning'}>
          {answer.grounded ? 'grounded' : 'insufficient evidence'}
        </Badge>
        <AiConfidenceBadge value={answer.confidence} />
      </div>
      <p className="text-sm">{answer.answer}</p>
      <EvidencePanel
        title="Sources"
        items={answer.sources.map(
          (source) =>
            `${source.source} (${source.documentId}, score ${source.score.toFixed(2)}): ${source.quote}`,
        )}
      />
    </Card>
  );
}
