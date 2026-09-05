import { isFeatureEnabled } from '../features';
import type { AppConfig } from '../types/config';

export function isRealtimeEnabled(config: Pick<AppConfig, 'features'>): boolean {
  return isFeatureEnabled(config, 'realtime');
}
