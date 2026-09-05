export const NOTIFICATION_CATEGORIES = [
  'order_updates',
  'security_alerts',
  'reports',
  'marketing',
  'system',
] as const;

export const NOTIFICATION_CHANNELS = ['email', 'in_app', 'sms', 'push', 'webhook'] as const;

export interface NotificationPreference {
  category: (typeof NOTIFICATION_CATEGORIES)[number];
  channel: (typeof NOTIFICATION_CHANNELS)[number];
  enabled: boolean;
}

export function NotificationPreferences({
  preferences,
  mandatoryCategories = ['security_alerts'],
  onChange,
}: {
  preferences: NotificationPreference[];
  mandatoryCategories?: string[];
  onChange?: (preference: NotificationPreference) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-edge bg-surface-elevated">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-edge bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Category</th>
            {NOTIFICATION_CHANNELS.map((channel) => (
              <th key={channel} className="px-4 py-3 font-medium">
                {channel.replace('_', '-')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_CATEGORIES.map((category) => (
            <tr key={category} className="border-b border-edge last:border-0">
              <td className="px-4 py-3 font-medium text-foreground">{category.replace(/_/g, ' ')}</td>
              {NOTIFICATION_CHANNELS.map((channel) => {
                const current = preferences.find((item) => item.category === category && item.channel === channel);
                const enabled = current?.enabled ?? true;
                const locked = mandatoryCategories.includes(category);
                return (
                  <td key={channel} className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`${category} ${channel}`}
                      checked={locked ? true : enabled}
                      disabled={locked || !onChange}
                      onChange={(event) =>
                        onChange?.({ category, channel, enabled: event.target.checked })
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
