import { OPERATIONAL_PATHS } from '@hackathon/api-contract';

import { apiGet } from './api';
import type { HealthData, ReadinessData } from '../types/api';

export function getHealth() {
  return apiGet<HealthData>(OPERATIONAL_PATHS.health);
}

export function getReadiness() {
  return apiGet<ReadinessData>(OPERATIONAL_PATHS.ready);
}
