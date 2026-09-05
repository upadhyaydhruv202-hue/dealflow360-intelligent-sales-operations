import type { MetricTags, MetricsSink } from './types';

export class NoopMetrics implements MetricsSink {
  increment(_name: string, _value?: number, _tags?: MetricTags): void {}
  timing(_name: string, _durationMs: number, _tags?: MetricTags): void {}
  gauge(_name: string, _value: number, _tags?: MetricTags): void {}
}

export interface MetricSample {
  kind: 'increment' | 'timing' | 'gauge';
  name: string;
  value: number;
  tags: MetricTags;
}

export class MemoryMetrics implements MetricsSink {
  readonly samples: MetricSample[] = [];

  increment(name: string, value = 1, tags: MetricTags = {}): void {
    this.samples.push({ kind: 'increment', name, value, tags });
  }

  timing(name: string, durationMs: number, tags: MetricTags = {}): void {
    this.samples.push({ kind: 'timing', name, value: durationMs, tags });
  }

  gauge(name: string, value: number, tags: MetricTags = {}): void {
    this.samples.push({ kind: 'gauge', name, value, tags });
  }
}

export function createMetrics(sink?: MetricsSink | null): MetricsSink {
  return sink ?? new NoopMetrics();
}
