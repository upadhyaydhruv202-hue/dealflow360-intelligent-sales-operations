import { ValidationError } from '../../../errors';
import { interpolateTemplate } from '../../../notifications/interpolate';
import type { EmailTemplateId, EmailTemplateVariables, RenderedEmail } from '../email.types';
import { EMAIL_TEMPLATES } from './catalog';

const TEMPLATES = new Map(EMAIL_TEMPLATES.map((template) => [template.id, template]));

export function getEmailTemplate(id: EmailTemplateId) {
  const template = TEMPLATES.get(id);
  if (!template) {
    throw new ValidationError('Unknown email template', [
      { path: 'template', message: `Template "${id}" is not registered`, code: 'custom' },
    ]);
  }
  return template;
}

export function listEmailTemplates() {
  return [...EMAIL_TEMPLATES];
}

export function renderEmailTemplate(
  id: EmailTemplateId,
  variables: EmailTemplateVariables = {},
): RenderedEmail {
  const template = getEmailTemplate(id);
  const data = variables as Record<string, unknown>;
  const htmlData = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, escapeHtml(String(value))]),
  );
  return {
    subject: interpolateTemplate(template.subject, data).trim() || template.id,
    text: interpolateTemplate(template.text, data).trim(),
    html: interpolateTemplate(template.html, htmlData),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
