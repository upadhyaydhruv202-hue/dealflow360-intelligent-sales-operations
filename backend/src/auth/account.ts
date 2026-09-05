import { AuthorizationError } from '../errors';
import type { UserStatus } from './types';

export function assertAccountActive(status: UserStatus): void {
  if (status === 'disabled') {
    throw new AuthorizationError('Account is disabled');
  }

  if (status !== 'active') {
    throw new AuthorizationError('Account is not active');
  }
}
