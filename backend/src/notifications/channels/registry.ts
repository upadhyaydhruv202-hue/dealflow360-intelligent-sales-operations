import { ValidationError } from '../../errors';
import type { ChannelAdapter } from '../notification.types';

export class ChannelAdapterRegistry {
  private readonly adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter): this {
    if (this.adapters.has(adapter.channel)) {
      throw new ValidationError('Duplicate notification channel', [
        { path: 'channel', message: `Channel "${adapter.channel}" is already registered`, code: 'custom' },
      ]);
    }
    this.adapters.set(adapter.channel, adapter);
    return this;
  }

  get(channel: string): ChannelAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new ValidationError('Unknown notification channel', [
        { path: 'channel', message: `Channel "${channel}" is not registered`, code: 'custom' },
      ]);
    }
    return adapter;
  }

  has(channel: string): boolean {
    return this.adapters.has(channel);
  }

  list(): ChannelAdapter[] {
    return [...this.adapters.values()];
  }
}
