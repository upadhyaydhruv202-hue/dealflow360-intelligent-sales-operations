import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getFeatures } from '../services/features';
import {
  DISABLED_FEATURE_STATE,
  isDemoMode as demoModeFromState,
  isFeatureEnabled as featureEnabledFromState,
  type PublicFeatureState,
} from './flags';

interface FeatureContextValue extends PublicFeatureState {
  ready: boolean;
  isEnabled: (name: string) => boolean;
  isDemo: () => boolean;
}

const FeatureContext = createContext<FeatureContextValue | null>(null);

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PublicFeatureState>(DISABLED_FEATURE_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getFeatures()
      .then((data) => {
        if (!cancelled) {
          setState({
            demoMode: data.demoMode === true,
            features: data.features ?? {},
          });
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(DISABLED_FEATURE_STATE);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<FeatureContextValue>(
    () => ({
      ...state,
      ready,
      isEnabled: (name: string) => featureEnabledFromState(state, name),
      isDemo: () => demoModeFromState(state),
    }),
    [state, ready],
  );

  return createElement(FeatureContext.Provider, { value }, children);
}

export function useFeatures(): FeatureContextValue {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeatures must be used inside FeatureProvider');
  }
  return context;
}

export function useOptionalFeatures(): FeatureContextValue | null {
  return useContext(FeatureContext);
}
