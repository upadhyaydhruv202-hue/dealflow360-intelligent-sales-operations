import { API_PATHS } from '@hackathon/api-contract';
import type { PublicFeatureState } from '../features/flags';

import { apiGet } from './api';

export function getFeatures() {
  return apiGet<PublicFeatureState>(API_PATHS.features);
}
