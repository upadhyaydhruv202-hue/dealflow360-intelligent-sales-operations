import { SEARCH } from '../../constants';
import { ValidationError } from '../../errors';
import { searchIndexNameSchema } from './search.schemas';
import type { SearchIndexDefinition, SearchIndexSummary } from './search.types';

const BUILTIN_SORT_FIELDS = new Set(['_score', 'createdAt', 'updatedAt', 'title']);

export class SearchIndexRegistry {
  private readonly indexes = new Map<string, SearchIndexDefinition>();

  register(definition: SearchIndexDefinition): void {
    const name = searchIndexNameSchema.parse(definition.name);
    if (this.indexes.has(name)) {
      throw new ValidationError('Search index is already registered', { index: name });
    }
    if (Object.keys(definition.fields).length === 0) {
      throw new ValidationError('Search index must declare fields', { index: name });
    }
    this.indexes.set(name, { ...definition, name });
  }

  get(name: string): SearchIndexDefinition {
    const index = this.indexes.get(name);
    if (!index) {
      throw new ValidationError('Unknown search index', { index: name });
    }
    return index;
  }

  has(name: string): boolean {
    return this.indexes.has(name);
  }

  list(): SearchIndexDefinition[] {
    return [...this.indexes.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  summarize(definition: SearchIndexDefinition): SearchIndexSummary {
    return {
      name: definition.name,
      summary: definition.summary,
      ownerScoped: definition.ownerScoped === true,
      httpWritable: definition.httpWritable === true,
      filterableFields: Object.entries(definition.fields)
        .filter(([, field]) => field.filterable)
        .map(([name]) => name),
      sortableFields: [
        ...BUILTIN_SORT_FIELDS,
        ...Object.entries(definition.fields)
          .filter(([, field]) => field.sortable)
          .map(([name]) => name),
      ],
    };
  }
}

export function createSearchIndexRegistry(
  definitions: readonly SearchIndexDefinition[] = [],
): SearchIndexRegistry {
  const registry = new SearchIndexRegistry();
  for (const definition of definitions) {
    registry.register(definition);
  }
  return registry;
}

export const DEMO_SEARCH_INDEX: SearchIndexDefinition = {
  name: SEARCH.DEMO_INDEX,
  summary: 'Shared demo catalog for keyword, full-text, filter, sort, and fuzzy search.',
  permission: 'search.use',
  writePermission: 'search.write',
  ownerScoped: false,
  httpWritable: true,
  fields: {
    title: { type: 'text', searchable: true, sortable: true, boost: 2, role: 'title' },
    body: { type: 'text', searchable: true, role: 'body' },
    status: { type: 'keyword', filterable: true, sortable: true, role: 'filter' },
    category: { type: 'keyword', filterable: true, sortable: true, role: 'filter' },
  },
  defaultSort: { field: '_score', order: 'desc' },
};
