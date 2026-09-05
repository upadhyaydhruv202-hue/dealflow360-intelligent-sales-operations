import { ValidationError } from '../errors';
import { interpolateTemplate } from './interpolate';
import type { NotificationCategory, NotificationTemplate, RenderedNotification } from './notification.types';

const BUILTIN_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'generic',
    category: 'system',
    title: '{{title}}',
    body: '{{body}}',
    emailSubject: '{{subject}}',
    sms: '{{body}}',
  },
  {
    id: 'welcome',
    category: 'system',
    title: 'Welcome to {{appName}}',
    body: 'Hi {{displayName}}, your account is ready.',
    emailSubject: 'Welcome to {{appName}}',
    sms: 'Welcome to {{appName}}. Your account is ready.',
  },
  {
    id: 'document-analyzed',
    category: 'reports',
    title: 'Document analysis finished',
    body: 'Your {{documentType}} document is {{status}}.',
    emailSubject: 'Document analysis finished',
    sms: 'Your {{documentType}} document is {{status}}.',
    type: 'success',
  },
  {
    id: 'order-updated',
    category: 'order_updates',
    title: 'Order {{orderId}} updated',
    body: 'Order {{orderId}} is now {{status}}.',
    emailSubject: 'Order {{orderId}} updated',
    sms: 'Order {{orderId}} is now {{status}}.',
  },
  {
    id: 'invoice-reminder',
    category: 'order_updates',
    title: 'Invoice reminder',
    body: 'An invoice is overdue by {{daysOverdue}} days.',
    emailSubject: 'Invoice reminder',
    sms: 'Invoice overdue by {{daysOverdue}} days.',
    type: 'warning',
  },
  {
    id: 'security-alert',
    category: 'security_alerts',
    title: 'Security alert',
    body: '{{body}}',
    emailSubject: 'Security alert',
    sms: 'Security alert: {{body}}',
    type: 'warning',
  },
  {
    id: 'report-ready',
    category: 'reports',
    title: 'Report ready',
    body: 'Your report {{title}} is ready.',
    emailSubject: 'Report ready: {{title}}',
    sms: 'Your report {{title}} is ready.',
  },
  {
    id: 'marketing',
    category: 'marketing',
    title: '{{title}}',
    body: '{{body}}',
    emailSubject: '{{title}}',
    sms: '{{body}}',
  },
];

export class NotificationTemplateRegistry {
  private readonly templates = new Map<string, NotificationTemplate>();

  constructor(initial: readonly NotificationTemplate[] = BUILTIN_TEMPLATES) {
    for (const template of initial) {
      this.templates.set(template.id, template);
    }
  }

  register(template: NotificationTemplate): this {
    if (!/^[a-z][a-z0-9._-]*$/.test(template.id)) {
      throw new ValidationError('Invalid notification template id', [
        { path: 'template', message: `Template "${template.id}" is not allowed`, code: 'custom' },
      ]);
    }
    if (this.templates.has(template.id)) {
      throw new ValidationError('Duplicate notification template', [
        { path: 'template', message: `Template "${template.id}" is already registered`, code: 'custom' },
      ]);
    }
    this.templates.set(template.id, template);
    return this;
  }

  get(id: string): NotificationTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new ValidationError('Unknown notification template', [
        { path: 'template', message: `Template "${id}" is not registered`, code: 'custom' },
      ]);
    }
    return template;
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }

  list(): NotificationTemplate[] {
    return [...this.templates.values()];
  }
}

export function createDefaultTemplateRegistry(): NotificationTemplateRegistry {
  return new NotificationTemplateRegistry();
}

export function renderNotificationTemplate(
  template: NotificationTemplate,
  data: Record<string, unknown>,
): RenderedNotification {
  const title = interpolateTemplate(template.title, data).trim() || 'Notification';
  const body = interpolateTemplate(template.body, data).trim() || title;
  const subjectSource = template.emailSubject ?? template.title;
  const subject = interpolateTemplate(subjectSource, data).trim() || title;
  const html = template.emailHtml ? interpolateTemplate(template.emailHtml, data) : undefined;
  const sms = interpolateTemplate(template.sms ?? template.body, data).trim() || title;
  const type = template.type ?? (typeof data.type === 'string' ? (data.type as RenderedNotification['type']) : 'info');

  return {
    title,
    body,
    subject,
    html,
    sms,
    type: ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info',
  };
}

export function categoryForTemplate(template: NotificationTemplate, override?: NotificationCategory): NotificationCategory {
  return override ?? template.category;
}
