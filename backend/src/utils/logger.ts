import pino, { type DestinationStream, type Logger } from 'pino';

import type { AppConfig } from '../types/config';
import { getRequestContext } from './request-context';

export type AppLogger = Logger;

export function loggerBindings(): Record<string, string> {
  const ctx = getRequestContext();
  const bindings: Record<string, string> = {};
  if (ctx?.requestId) {
    bindings.requestId = ctx.requestId;
  }
  if (ctx?.jobId) {
    bindings.jobId = ctx.jobId;
  }
  return bindings;
}

export function createLogger(config: AppConfig, destination?: DestinationStream): AppLogger {
  return pino(
    {
      name: config.app.name,
      level: config.logLevel,
      mixin() {
        return loggerBindings();
      },
      redact: {
        paths: [
          'password',
          'passwordHash',
          'refreshToken',
          'accessToken',
          'secret',
          'token',
          'authorization',
          'apiKey',
          'api_key',
          'accessSecret',
          'refreshSecret',
          'jwt.accessSecret',
          'jwt.refreshSecret',
          'odoo.apiKey',
          'ai.geminiApiKey',
          'geminiApiKey',
          'GEMINI_API_KEY',
          'email.smtp.password',
          'email.resend.apiKey',
          'email.brevo.apiKey',
          'otp.hashSecret',
          'otp',
          'otpCode',
          'codeHash',
          'sms.apiKey',
          'storage.aws.accessKeyId',
          'storage.aws.secretAccessKey',
          '*.password',
          '*.passwordHash',
          '*.refreshToken',
          '*.accessToken',
          '*.secret',
          '*.token',
          '*.apiKey',
        ],
        censor: '[Redacted]',
      },
    },
    destination,
  );
}
