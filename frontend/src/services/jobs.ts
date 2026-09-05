import { API_PATHS } from '@hackathon/api-contract';

import { apiGet } from './api';

export interface JobStatus {
  jobId: string;
  type: string;
  status: string;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  progress: number;
}

export function getJob(jobId: string, token: string) {
  return apiGet<JobStatus>(API_PATHS.jobs.byId(jobId), token);
}
