import type { ReactNode } from 'react';

import { EmptyState, LoadingState } from '../ui';
import { useFeatures } from './FeatureProvider';

export function FeatureGate({
  feature,
  children,
  title = 'This capability is turned off',
  description = 'Enable it with the matching FEATURE_* variable on the API, then restart.',
}: {
  feature: string;
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { ready, isEnabled } = useFeatures();

  if (!ready) {
    return <LoadingState label="Loading feature flags…" />;
  }

  if (!isEnabled(feature)) {
    return <EmptyState title={title} description={description} />;
  }

  return children;
}
