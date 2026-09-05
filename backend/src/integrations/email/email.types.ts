import { JOB_NAMES } from '../../constants';

export const EMAIL_SEND_JOB = JOB_NAMES.EMAIL_SEND;

export const EMAIL_TEMPLATE_IDS = [
  'welcome',
  'verification',
  'password-reset',
  'otp',
  'notification',
  'report-ready',
  'alert',
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export type EmailProviderName = 'smtp' | 'resend' | 'brevo' | 'mock';

export type EmailTemplateVariables = Record<string, string | number | boolean>;

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType?: string;
  cid?: string;
}

export interface EmailTemplate {
  id: EmailTemplateId;
  subject: string;
  text: string;
  html: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  template?: EmailTemplateId;
  variables?: EmailTemplateVariables;
  attachments?: EmailAttachment[];
  replyTo?: string;
  idempotencyKey?: string;
}

export interface ResolvedSendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  idempotencyKey?: string;
  template?: EmailTemplateId;
}

export interface SentEmail {
  id: string;
  to: string[];
  subject: string;
  provider: EmailProviderName;
}

export interface EmailProvider {
  readonly name: EmailProviderName;
  send(input: ResolvedSendEmailInput): Promise<SentEmail>;
}

export const EMAIL_SECRET_FACT_KEYS = ['otp', 'code', 'password', 'token', 'secret', 'apiKey'] as const;
