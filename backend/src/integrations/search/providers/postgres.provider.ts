import type { SearchRepository } from '../../../repositories/search.repository';
import type { ProviderSearchQuery, ProviderSearchResult, SearchProvider, StoredSearchDocument } from '../search.types';

export class PostgresSearchProvider implements SearchProvider {
  readonly name = 'postgres' as const;

  constructor(private readonly documents: SearchRepository) {}

  async index(document: StoredSearchDocument): Promise<void> {
    await this.documents.upsert(document);
  }

  async delete(indexName: string, documentId: string): Promise<void> {
    await this.documents.delete(indexName, documentId);
  }

  search(query: ProviderSearchQuery): Promise<ProviderSearchResult> {
    return this.documents.search(query);
  }
}

export function createPostgresSearchProvider(documents: SearchRepository): PostgresSearchProvider {
  return new PostgresSearchProvider(documents);
}
