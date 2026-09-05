import { useEffect, useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { getApiErrorMessage } from '../services/api';
import {
  listSearchIndexes,
  searchRecords,
  type SearchHit,
  type SearchIndexSummary,
} from '../services/search';
import {
  Alert,
  Badge,
  Breadcrumb,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  FilterPanel,
  PageContainer,
  Pagination,
  Search,
  Select,
} from '../ui';
import { controlBase, labelClass } from '../ui/styles';

export function SearchPage() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState('refund');
  const [mode, setMode] = useState('auto');
  const [status, setStatus] = useState('');
  const [sortField, setSortField] = useState('_score');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [indexes, setIndexes] = useState<SearchIndexSummary[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [usedMode, setUsedMode] = useState<string>();
  const [provider, setProvider] = useState<string>();
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    void listSearchIndexes(accessToken)
      .then((result) => {
        setIndexes(result.indexes);
        setProvider(result.provider);
      })
      .catch((caught) => {
        setError(getApiErrorMessage(caught, 'Could not load search indexes'));
      });
  }, [accessToken]);

  async function runSearch(nextPage = 1) {
    if (!accessToken) {
      setError('Sign in to search.');
      return;
    }
    setLoading(true);
    setError(undefined);
    setPage(nextPage);
    try {
      const result = await searchRecords(
        {
          query,
          mode: mode as 'auto' | 'keyword' | 'fulltext' | 'fuzzy',
          filters: status ? [{ field: 'status', operator: 'eq', value: status }] : undefined,
          sort: { field: sortField, order: sortField === 'title' ? 'asc' : 'desc' },
          page: nextPage,
          pageSize,
        },
        accessToken,
      );
      setHits(result.hits);
      setTotal(result.pagination.totalItems);
      setUsedMode(result.fallbackFrom ? `${result.mode} (from ${result.fallbackFrom})` : result.mode);
      setProvider(result.provider);
      setSearched(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Search failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Search' }]} />}
      title="Search"
      description="Keyword, filter, sort, and PostgreSQL full-text search behind SearchService. Fuzzy matching is for short typos. Semantic meaning search stays on optional RAG. Elasticsearch is not included."
    >
      <SessionGate title="Sign in to search" hint="Manager, admin, and staff roles have search.use after seed.">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Query</CardTitle>
            {provider ? <Badge tone="neutral">{provider}</Badge> : null}
          </CardHeader>
          <div className="space-y-4">
            <Search
              value={query}
              onChange={setQuery}
              onSubmitSearch={() => void runSearch(1)}
              loading={loading}
              placeholder="Refund, shipping SLA, onboarding…"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                label="Mode"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'keyword', label: 'Keyword' },
                  { value: 'fulltext', label: 'Full-text' },
                  { value: 'fuzzy', label: 'Fuzzy' },
                ]}
              />
              <Select
                label="Sort"
                value={sortField}
                onChange={(event) => setSortField(event.target.value)}
                options={[
                  { value: '_score', label: 'Score' },
                  { value: 'createdAt', label: 'Created' },
                  { value: 'title', label: 'Title' },
                ]}
              />
              <p className="self-end text-xs text-foreground-muted">
                {indexes.length} index{indexes.length === 1 ? '' : 'es'} available
                {usedMode ? ` · mode ${usedMode}` : ''}
              </p>
            </div>
          </div>
        </Card>

        <FilterPanel
          title="Filters"
          appliedCount={status ? 1 : 0}
          onReset={() => {
            setStatus('');
            void runSearch(1);
          }}
          onApply={() => void runSearch(1)}
        >
          <div>
            <label className={labelClass} htmlFor="search-status">
              Status
            </label>
            <select
              id="search-status"
              className={`${controlBase} mt-1`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Any</option>
              <option value="published">published</option>
              <option value="draft">draft</option>
            </select>
          </div>
        </FilterPanel>

        {error ? (
          <Alert variant="error" className="mt-6">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 space-y-3">
          {hits.map((hit) => (
            <Card key={`${hit.index}:${hit.documentId}`}>
              <CardHeader>
                <CardTitle>{hit.title}</CardTitle>
                <Badge tone="neutral">{hit.score.toFixed(2)}</Badge>
              </CardHeader>
              <p className="text-sm text-foreground-muted">{hit.snippet}</p>
              {hit.highlights?.length ? (
                <p className="mt-2 text-xs">{hit.highlights.join(' · ')}</p>
              ) : null}
              <p className="mt-2 text-xs text-foreground-muted">
                {hit.index} / {hit.documentId}
              </p>
            </Card>
          ))}
        </div>

        {searched && hits.length === 0 && !error ? (
          <EmptyState className="mt-6" title="No matching documents" description="Try another query, mode, or filter." />
        ) : null}

        {searched && total > 0 ? (
          <Pagination
            className="mt-6"
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(next) => void runSearch(next)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              void runSearch(1);
            }}
          />
        ) : null}
      </SessionGate>
    </PageContainer>
  );
}
