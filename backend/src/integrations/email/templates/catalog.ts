import type { EmailTemplate } from '../email.types';

export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  {
    id: 'welcome',
    subject: 'Welcome to {{appName}}',
    text: 'Hi {{displayName}},\n\nYour account on {{appName}} is ready. You can sign in and start using the application.\n\nIf you did not create this account, ignore this email.\n\n— {{appName}}',
    html: wrapHtml(
      '<p>Hi {{displayName}},</p><p>Your account on <strong>{{appName}}</strong> is ready. You can sign in and start using the application.</p><p>If you did not create this account, ignore this email.</p><p>— {{appName}}</p>',
    ),
  },
  {
    id: 'verification',
    subject: 'Verify your email for {{appName}}',
    text: 'Hi {{displayName}},\n\nConfirm your email address for {{appName}} by opening this link:\n{{verificationUrl}}\n\nThis link expires in {{expiresInMinutes}} minutes.\n\nIf you did not request this, ignore this email.\n\n— {{appName}}',
    html: wrapHtml(
      '<p>Hi {{displayName}},</p><p>Confirm your email address for <strong>{{appName}}</strong> by using the button below.</p><p><a href="{{verificationUrl}}">Verify email</a></p><p>This link expires in {{expiresInMinutes}} minutes. If you did not request this, ignore this email.</p><p>— {{appName}}</p>',
    ),
  },
  {
    id: 'password-reset',
    subject: 'Reset your {{appName}} password',
    text: 'Hi {{displayName}},\n\nA password reset was requested for your {{appName}} account. Open this link to choose a new password:\n{{resetUrl}}\n\nThis link expires in {{expiresInMinutes}} minutes.\n\nIf you did not request a reset, ignore this email. Your password will stay the same.\n\n— {{appName}}',
    html: wrapHtml(
      '<p>Hi {{displayName}},</p><p>A password reset was requested for your <strong>{{appName}}</strong> account.</p><p><a href="{{resetUrl}}">Reset password</a></p><p>This link expires in {{expiresInMinutes}} minutes. If you did not request a reset, ignore this email.</p><p>— {{appName}}</p>',
    ),
  },
  {
    id: 'otp',
    subject: 'Your {{appName}} verification code',
    text: 'Your {{appName}} verification code is {{code}}.\n\nIt expires in {{expiresInMinutes}} minutes. Do not share this code.\n\nIf you did not request a code, ignore this email.\n\n— {{appName}}',
    html: wrapHtml(
      '<p>Your <strong>{{appName}}</strong> verification code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700;">{{code}}</p><p>It expires in {{expiresInMinutes}} minutes. Do not share this code. If you did not request a code, ignore this email.</p><p>— {{appName}}</p>',
    ),
  },
  {
    id: 'notification',
    subject: '{{subject}}',
    text: '{{body}}\n\n— {{appName}}',
    html: wrapHtml('<p>{{body}}</p><p>— {{appName}}</p>'),
  },
  {
    id: 'report-ready',
    subject: 'Report ready: {{title}}',
    text: 'Hi {{displayName}},\n\nYour report "{{title}}" is ready.\n\nDownload: {{downloadUrl}}\n\n— {{appName}}',
    html: wrapHtml(
      '<p>Hi {{displayName}},</p><p>Your report <strong>{{title}}</strong> is ready.</p><p><a href="{{downloadUrl}}">Download report</a></p><p>— {{appName}}</p>',
    ),
  },
  {
    id: 'alert',
    subject: '{{severity}} alert: {{title}}',
    text: '{{title}}\n\n{{body}}\n\nSeverity: {{severity}}\n\n— {{appName}}',
    html: wrapHtml(
      '<p><strong>{{severity}} alert:</strong> {{title}}</p><p>{{body}}</p><p>— {{appName}}</p>',
    ),
  },
];

function wrapHtml(inner: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:560px;">${inner}</body></html>`;
}
