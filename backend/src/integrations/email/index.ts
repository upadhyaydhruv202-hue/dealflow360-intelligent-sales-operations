export { createEmailService, EmailService, createEmailProvider } from './email.service';
export { EMAIL_SEND_JOB, EMAIL_TEMPLATE_IDS } from './email.types';
export {
  sendEmailInputSchema,
  emailSendJobPayloadSchema,
  generateEmailContentInputSchema,
} from './email.schemas';
export { MockEmailProvider } from './providers/mock.provider';
export { SmtpEmailProvider } from './providers/smtp.provider';
export { ResendEmailProvider } from './providers/resend.provider';
export { BrevoEmailProvider } from './providers/brevo.provider';
export { renderEmailTemplate, listEmailTemplates, getEmailTemplate } from './templates';
export type {
  EmailProvider,
  EmailProviderName,
  EmailTemplateId,
  SendEmailInput,
  SentEmail,
  EmailAttachment,
} from './email.types';
export type { GenerateEmailContentInput, GeneratedEmailContent } from './email.generate';
