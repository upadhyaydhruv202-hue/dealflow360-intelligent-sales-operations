import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export type AnomalySeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type AnomalyExplanationStatus = 'generated' | 'skipped' | 'failed' | 'unavailable';

export interface AnomalyEvidence {
  sampleSize: number;
  latest: number;
  baseline: number | null;
  change: number | null;
  fired: string[];
  skipped: Array<{ name: string; reason: string }>;
  sufficientSample: boolean;
  claimsStatisticalSignificance: false;
  insufficientData: boolean;
}

export interface AnomalyInsight {
  id: string;
  metric: string;
  anomaly: boolean;
  severity: AnomalySeverity;
  change: number | null;
  evidence: AnomalyEvidence;
  explanation: string;
  recommendedAction: string;
  explanationStatus: AnomalyExplanationStatus;
  series?: Array<{ t?: string; value: number }>;
  status?: 'evaluated' | 'processing';
  jobId?: string;
}

export function evaluateAnomaly(
  input: {
    metric: string;
    points: number[];
    explain?: boolean;
    notify?: boolean;
    detectors?: {
      threshold?: { enabled?: boolean };
      percentChange?: { enabled?: boolean };
      movingAverage?: { enabled?: boolean };
      frequency?: { enabled?: boolean };
      trend?: { enabled?: boolean };
      zScore?: { enabled?: boolean };
    };
  },
  token: string,
): Promise<AnomalyInsight> {
  return apiRequest<AnomalyInsight>(API_PATHS.anomalies.evaluate, {
    method: 'POST',
    token,
    body: input,
  });
}

export function listAnomalies(token: string): Promise<{ items: AnomalyInsight[] }> {
  return apiRequest(API_PATHS.anomalies.root, { token });
}

export function getAnomaly(id: string, token: string): Promise<AnomalyInsight> {
  return apiRequest(API_PATHS.anomalies.byId(id), { token });
}
