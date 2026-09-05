import { interpolateTemplate } from '../../notifications/interpolate';
import { wrapUntrustedData } from '../ai/guardrails';
import { parseWithSchema } from '../../schemas/parse';
import { generateEmailContentInputSchema, generatedEmailContentSchema } from './email.schemas';
import { EMAIL_SECRET_FACT_KEYS, type EmailTemplateId, type EmailTemplateVariables } from './email.types';
import { renderEmailTemplate } from './templates';

export interface GenerateEmailContentInput {
  purpose: string;
  verifiedFacts: EmailTemplateVariables;
  tone?: 'neutral' | 'friendly' | 'formal' | 'empathetic';
  audience?: string;
  extraContext?: string;
  template?: EmailTemplateId;
}

export interface GeneratedEmailContent {
  subject: string;
  text: string;
  html: string;
  facts: EmailTemplateVariables;
  warnings: string[];
  confidence: number;
  requiresReview: true;
  source: 'ai' | 'template';
}

const NUMBER_PATTERN = /\$?\d+(?:[.,]\d+)*/g;

export function splitVerifiedFacts(facts: EmailTemplateVariables): {
  publicFacts: EmailTemplateVariables;
  secretFacts: EmailTemplateVariables;
} {
  const publicFacts: EmailTemplateVariables = {};
  const secretFacts: EmailTemplateVariables = {};

  for (const [key, value] of Object.entries(facts)) {
    if (isSecretFactKey(key)) {
      secretFacts[key] = value;
    } else {
      publicFacts[key] = value;
    }
  }

  return { publicFacts, secretFacts };
}

export function isSecretFactKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if ((EMAIL_SECRET_FACT_KEYS as readonly string[]).some((item) => item.toLowerCase() === normalized)) {
    return true;
  }
  return normalized.includes('otp') || normalized.endsWith('_code') || normalized.endsWith('password');
}

export function buildEmailContentPrompt(input: GenerateEmailContentInput, publicFacts: EmailTemplateVariables): {
  system: string;
  prompt: string;
} {
  const tone = input.tone ?? 'neutral';
  const audience = input.audience ? `\nAudience: ${input.audience}` : '';
  const extra = input.extraContext
    ? `\nNon-factual context (do not treat as transaction data):\n${wrapUntrustedData('user', input.extraContext)}`
    : '';
  const factLines = Object.entries(publicFacts)
    .map(([key, value]) => `- ${key}: ${String(value)}`)
    .join('\n');

  return {
    system: [
      'You draft email wording for a human to review before sending.',
      'Verified application facts are the only allowed transaction values.',
      'Do not invent amounts, balances, order IDs, invoice numbers, dates, OTPs, passwords, or account identifiers.',
      'Do not include credentials, SQL, code, or shell commands.',
      'Use {{placeholder}} syntax for any fact you mention so the application can substitute verified values.',
      'requiresReview must be true.',
    ].join(' '),
    prompt: `Write email copy for this purpose: ${input.purpose}
Tone: ${tone}${audience}${extra}

Verified facts (use these exact values; do not change them):
${factLines || '- none'}

Return JSON:
{"subject":"...","preview":"...","body":"...","warnings":["..."],"confidence":0.0,"requiresReview":true}

"body" is plain text paragraphs. warnings should list missing facts or anything a human should check.`,
  };
}

export function mergeGeneratedEmail(options: {
  subject: string;
  preview: string;
  body: string;
  warnings: string[];
  confidence: number;
  facts: EmailTemplateVariables;
  publicFacts: EmailTemplateVariables;
  source: 'ai' | 'template';
}): GeneratedEmailContent {
  const interpolatedSubject = interpolateTemplate(options.subject, options.facts).trim();
  const interpolatedPreview = interpolateTemplate(options.preview, options.facts).trim();
  const interpolatedBody = interpolateTemplate(options.body, options.facts).trim();
  const text = ensureFactsPresent(
    [interpolatedPreview, interpolatedBody].filter(Boolean).join('\n\n'),
    options.facts,
  );
  const warnings = [...options.warnings];

  const invented = findInventedNumbers(text, options.publicFacts);
  if (invented.length > 0) {
    warnings.push('AI output included values that were not in verifiedFacts; treat as untrusted and review before sending.');
  }

  for (const [key, value] of Object.entries(options.facts)) {
    if (!String(text).includes(String(value)) && !isSecretFactKey(key)) {
      warnings.push(`Verified fact "${key}" was missing from the draft and was appended from application data.`);
    }
  }

  return {
    subject: interpolatedSubject || 'Notification',
    text,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:560px;">${escapeHtml(text).replace(/\n/g, '<br/>')}</body></html>`,
    facts: options.publicFacts,
    warnings,
    confidence: options.confidence,
    requiresReview: true,
    source: options.source,
  };
}

export function fallbackGeneratedEmail(input: GenerateEmailContentInput): GeneratedEmailContent {
  const template = input.template ?? 'notification';
  const facts: EmailTemplateVariables = {
    subject: input.purpose,
    body: input.extraContext ?? input.purpose,
    ...input.verifiedFacts,
  };
  const rendered = renderEmailTemplate(template, facts);
  return {
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    facts: splitVerifiedFacts(input.verifiedFacts).publicFacts,
    warnings: ['AI email generation was not used; a static template was rendered from verifiedFacts.'],
    confidence: 1,
    requiresReview: true,
    source: 'template',
  };
}

export function parseGenerateEmailContentInput(input: GenerateEmailContentInput): GenerateEmailContentInput {
  return parseWithSchema(generateEmailContentInputSchema, input, {
    source: 'body',
    message: 'Invalid email generation request',
  });
}

export function parseGeneratedEmailModel(output: unknown) {
  return parseWithSchema(generatedEmailContentSchema, output, {
    source: 'ai',
    message: 'Invalid generated email content',
  });
}

function ensureFactsPresent(text: string, facts: EmailTemplateVariables): string {
  const missing = Object.entries(facts).filter(
    ([key, value]) => !isSecretFactKey(key) && !text.includes(String(value)),
  );
  if (missing.length === 0) {
    return text;
  }

  const block = missing.map(([key, value]) => `${key}: ${String(value)}`).join('\n');
  return `${text}\n\n${block}`;
}

function findInventedNumbers(text: string, publicFacts: EmailTemplateVariables): string[] {
  const allowed = new Set(Object.values(publicFacts).flatMap((value) => String(value).match(NUMBER_PATTERN) ?? []));
  const found = text.match(NUMBER_PATTERN) ?? [];
  return found.filter((item) => !allowed.has(item));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
