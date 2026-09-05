import { API_PATHS } from '@hackathon/api-contract';

import { apiGet, apiRequest } from './api';
import type { NotificationItem } from '../components/NotificationList';
import type { NotificationPreference } from '../components/NotificationPreferences';

export interface NotificationListResult {
  items: NotificationItem[];
}

export interface NotificationPreferenceResult {
  categories: string[];
  channels: string[];
  mandatoryCategories: string[];
  preferences: NotificationPreference[];
}

export function listNotifications(token: string, query: { unreadOnly?: boolean } = {}) {
  const search = query.unreadOnly ? '?unreadOnly=true' : '';
  return apiGet<NotificationListResult>(`${API_PATHS.notifications.root}${search}`, token);
}

export function getUnreadCount(token: string) {
  return apiGet<{ count: number }>(API_PATHS.notifications.unreadCount, token);
}

export function markNotificationRead(id: string, token: string) {
  return apiRequest<NotificationItem>(API_PATHS.notifications.read(id), { method: 'POST', token });
}

export function markAllNotificationsRead(token: string) {
  return apiRequest<{ count: number }>(API_PATHS.notifications.readAll, { method: 'POST', token });
}

export function getNotificationPreferences(token: string) {
  return apiGet<NotificationPreferenceResult>(API_PATHS.notifications.preferences, token);
}

export function updateNotificationPreferences(preferences: NotificationPreference[], token: string) {
  return apiRequest<NotificationPreferenceResult>(API_PATHS.notifications.preferences, {
    method: 'PUT',
    token,
    body: { preferences },
  });
}
