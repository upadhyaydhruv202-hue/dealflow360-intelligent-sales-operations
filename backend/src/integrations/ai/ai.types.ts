import type { ZodType } from 'zod';

import { JOB_NAMES } from '../../constants';

export const AI_ANALYZE_JOB = JOB_NAMES.AI_ANALYZE;

export const AI_OPERATIONS = [
  'generateText',
  'generateStructured',
  'summarize',
  'classify',
  'extract',
  'analyze',
  'recommend',
  'draft',
  'embed',
] as const;

export type AiOperation = (typeof AI_OPERATIONS)[number];

export type AiProviderName = 'gemini' | 'mock';

export type AiMessageRole = 'system' | 'user' | 'assistant';

export type AiPriority = 'low' | 'medium' | 'high';

export type AiSentiment = 'positive' | 'neutral' | 'negative';

export type AiSummarizeStyle = 'brief' | 'detailed' | 'bullet' | 'executive';

export type AiSummarizeLength = 'short' | 'medium' | 'long';

export type AiExtractSchemaName = 'fields' | 'entities' | 'actionItems';

export type AiAnalyzeFocus = 'general' | 'risk';

export type AiDraftTone = 'neutral' | 'friendly' | 'formal' | 'empathetic';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiGenerationOptions {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

export interface AiDocumentInput extends AiGenerationOptions {
  content?: string;
  text?: string;
}

export interface AiGenerateTextInput extends AiGenerationOptions {
  prompt?: string;
  messages?: AiMessage[];
}

export interface AiTextResult {
  text: string;
  model: string;
  provider: string;
  usage?: AiTokenUsage;
}

export interface AiGenerateStructuredInput<T = unknown> extends AiGenerateTextInput {
  schema: ZodType<T>;
  schemaName?: string;
}

export interface AiStructuredResult<T> {
  data: T;
  rawText: string;
  model: string;
  provider: string;
  usage?: AiTokenUsage;
}

export interface AiSummarizeInput extends AiDocumentInput {
  style?: AiSummarizeStyle;
  length?: AiSummarizeLength;
  language?: string;
  maxSentences?: number;
}

export interface AiSummary {
  summary: string;
  keyPoints: string[];
  actions: string[];
}

export interface AiClassifyInput extends AiDocumentInput {
  labels?: string[];
}

export interface AiClassification {
  category: string;
  priority: AiPriority;
  sentiment: AiSentiment;
  confidence: number;
  reason: string;
}

export interface AiExtractInput extends AiDocumentInput {
  schemaName?: AiExtractSchemaName;
  fields?: string[];
  attachments?: AiMediaAttachment[];
}

export interface AiActionItem {
  action: string;
  owner?: string | null;
  due?: string | null;
  priority?: AiPriority;
}

export interface AiEntityFields {
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  amounts: string[];
  identifiers: string[];
}

export interface AiActionItemFields {
  actionItems: AiActionItem[];
}

export interface AiExtraction {
  fields: Record<string, unknown>;
  missingFields: string[];
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
}

export interface AiAnalyzeInput extends AiDocumentInput {
  focus?: AiAnalyzeFocus;
}

export interface AiRiskItem {
  risk: string;
  severity: AiPriority;
  likelihood?: AiPriority;
  mitigation?: string;
}

export interface AiAnalysis {
  summary: string;
  findings: string[];
  risks: AiRiskItem[];
  sentiment: AiSentiment;
  priority: AiPriority;
  confidence: number;
  requiresReview: boolean;
}

export interface AiRecommendInput extends AiGenerationOptions {
  context?: string;
  content?: string;
  goal?: string;
  limit?: number;
}

export interface AiRecommendationItem {
  recommendation: string;
  reason: string;
  evidence?: string;
  confidence: number;
}

export interface AiRecommendation {
  recommendations: AiRecommendationItem[];
}

export interface AiInsight {
  category: string;
  priority: AiPriority;
  reason: string;
}

export interface AiDraftInput extends AiDocumentInput {
  purpose?: string;
  tone?: AiDraftTone;
  audience?: string;
  language?: string;
}

export interface AiDraft {
  draft: string;
  subject?: string;
  alternatives: string[];
  warnings: string[];
  confidence: number;
  requiresReview: boolean;
}

export interface AiEmbedInput {
  text: string;
  model?: string;
}

export interface AiEmbedResult {
  embedding: number[];
  model: string;
  provider: string;
}

export interface AiMediaAttachment {
  mimeType: string;
  data: Buffer;
  filename?: string;
}

export interface AiProviderContent {
  role: 'user' | 'model';
  text: string;
}

export interface AiProviderGenerateInput {
  operation: AiOperation;
  system?: string;
  contents: AiProviderContent[];
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  attachments?: AiMediaAttachment[];
  metadata?: {
    labels?: string[];
    fields?: string[];
    schemaName?: string;
    focus?: AiAnalyzeFocus;
    promptId?: string;
    promptVersion?: string;
    documentType?: string;
    attachmentCount?: number;
    injectionSignals?: string[];
  };
}

export interface AiProviderGenerateResult {
  text: string;
  model: string;
  finishReason?: string;
  usage?: AiTokenUsage;
}

export type AiFetch = (input: string, init: RequestInit) => Promise<Response>;
export type AiSleeper = (ms: number) => Promise<void>;
