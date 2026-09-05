import { parsePagination, toPaginatedResult } from '../../repositories/query';
import type { AnomalyInsight, AnomalyStore, AnomalyStoreListQuery } from '../anomaly.types';

export class MemoryAnomalyStore implements AnomalyStore {
  private readonly findings = new Map<string, AnomalyInsight>();

  async save(finding: AnomalyInsight): Promise<AnomalyInsight> {
    this.findings.set(finding.id, finding);
    return finding;
  }

  async get(id: string): Promise<AnomalyInsight | null> {
    return this.findings.get(id) ?? null;
  }

  async list(query: AnomalyStoreListQuery) {
    const pagination = parsePagination(query);
    const filtered = [...this.findings.values()]
      .filter((item) => (query.metric ? item.metric === query.metric : true))
      .filter((item) => (query.anomaly === undefined ? true : item.anomaly === query.anomaly))
      .filter((item) => (query.createdBy ? item.createdBy === query.createdBy : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const page = filtered.slice(pagination.skip, pagination.skip + pagination.take);
    return toPaginatedResult(page, pagination, filtered.length);
  }
}

export function createMemoryAnomalyStore(): MemoryAnomalyStore {
  return new MemoryAnomalyStore();
}
