import { createHash } from 'node:crypto';

import type { AiProvider } from '../ai.provider';
import type { AiEmbedInput, AiEmbedResult, AiProviderGenerateInput, AiProviderGenerateResult } from '../ai.types';

export const MOCK_EMBEDDING_DIMENSIONS = 8;

export interface MockAiProviderOptions {
  model?: string;
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  private readonly model: string;
  private readonly queue: Array<string | Error> = [];

  constructor(options: MockAiProviderOptions = {}) {
    this.model = options.model ?? 'mock';
  }

  enqueue(response: string | Error): void {
    this.queue.push(response);
  }

  async ping(): Promise<void> {
    return undefined;
  }

  async embed(input: AiEmbedInput): Promise<AiEmbedResult> {
    return {
      embedding: mockEmbedding(input.text),
      model: input.model ?? this.model,
      provider: this.name,
    };
  }

  async generateText(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult> {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next instanceof Error) {
        throw next;
      }

      return {
        text: next ?? '',
        model: this.model,
        finishReason: 'STOP',
      };
    }

    return {
      text: input.json ? JSON.stringify(this.defaultStructured(input)) : this.defaultText(),
      model: this.model,
      finishReason: 'STOP',
    };
  }

  private defaultText(): string {
    return 'Mock AI response for local testing, CI, and demo mode.';
  }

  private defaultStructured(input: AiProviderGenerateInput): unknown {
    if (input.metadata?.schemaName === 'copilotPlan') {
      return defaultCopilotPlan(input);
    }

    if (input.metadata?.schemaName === 'intentCommand') {
      return defaultIntentCommand(input);
    }

    if (input.metadata?.schemaName === 'ragAnswer') {
      return defaultRagAnswer(input);
    }

    if (input.metadata?.schemaName === 'anomalyExplanation') {
      return {
        explanation:
          'The series crossed a configured statistical threshold. This is a descriptive outlier flag, not a test of statistical significance.',
        recommendedAction: 'Confirm the source data, then review recent operational changes for this metric.',
        confidence: 0.82,
      };
    }

    if (input.metadata?.schemaName === 'problemSpec') {
      return defaultProblemSpec();
    }

    switch (input.operation) {
      case 'summarize':
        return {
          summary: 'Mock summary of the provided text.',
          keyPoints: ['Mock key point from the source content.'],
          actions: [],
        };
      case 'classify': {
        const category = input.metadata?.labels?.[0] ?? 'general';
        return {
          category,
          priority: 'medium',
          sentiment: 'neutral',
          confidence: 0.9,
          reason: 'Mock classification for local testing.',
        };
      }
      case 'extract':
        return defaultExtract(input.metadata?.schemaName, input.metadata?.fields);
      case 'analyze':
        return {
          summary: 'Mock analysis of the provided text.',
          findings: ['The mock provider returned a deterministic analysis.'],
          risks:
            input.metadata?.focus === 'risk'
              ? [
                  {
                    risk: 'Mock risk identified for local testing.',
                    severity: 'low',
                    likelihood: 'low',
                    mitigation: 'Review the source content with a human.',
                  },
                ]
              : [],
          sentiment: 'neutral',
          priority: 'medium',
          confidence: 0.9,
          requiresReview: false,
        };
      case 'recommend':
        return {
          recommendations: [
            {
              recommendation: 'Review the current process',
              reason: 'Mock recommendation for local testing.',
              evidence: 'The provided context described a process issue.',
              confidence: 0.8,
            },
          ],
        };
      case 'draft':
        return {
          draft: 'Mock draft response for a human to review before sending.',
          subject: 'Following up',
          alternatives: [],
          warnings: ['Review this draft before sending.'],
          confidence: 0.85,
          requiresReview: true,
        };
        default:
        if (input.metadata?.schemaName === 'decision') {
          return {
            result: { status: 'ok' },
            confidence: 0.9,
            evidence: ['Mock decision evidence for local testing.'],
            requiresReview: false,
          };
        }
        if (input.metadata?.schemaName === 'emailContent') {
          return {
            subject: 'Update about {{topic}}',
            preview: 'Hello {{displayName}}',
            body: 'This message uses only verified application facts for {{topic}}.',
            warnings: ['Review this draft before sending.'],
            confidence: 0.85,
            requiresReview: true,
          };
        }
        return {
          category: 'general',
          priority: 'medium',
          reason: 'Mock structured result for local testing.',
        };
    }
  }
}

function defaultExtract(schemaName?: string, fields: string[] = []): unknown {
  if (schemaName === 'entities') {
    return {
      fields: {
        people: [],
        organizations: [],
        locations: [],
        dates: [],
        amounts: [],
        identifiers: [],
      },
      missingFields: [],
      confidence: 0.9,
      warnings: [],
      requiresReview: false,
    };
  }

  if (schemaName === 'actionItems') {
    return {
      fields: {
        actionItems: [
          {
            action: 'Follow up with the customer',
            owner: null,
            due: null,
            priority: 'medium',
          },
        ],
      },
      missingFields: ['owner', 'due'],
      confidence: 0.8,
      warnings: ['Owner and due date were not stated.'],
      requiresReview: true,
    };
  }

  return {
    fields: Object.fromEntries(fields.map((field) => [field, `sample ${field}`])),
    missingFields: [],
    confidence: 0.9,
    warnings: [],
    requiresReview: false,
  };
}

export function mockEmbedding(text: string, dimensions = MOCK_EMBEDDING_DIMENSIONS): number[] {
  const digest = createHash('sha256').update(text).digest();
  const values: number[] = [];
  for (let index = 0; index < dimensions; index += 1) {
    const byte = digest[index % digest.length] ?? 0;
    values.push(Number((byte / 127.5 - 1).toFixed(6)));
  }
  return values;
}

function defaultCopilotPlan(input: AiProviderGenerateInput): unknown {
  const text = input.contents.map((item) => item.text).join('\n').toLowerCase();

  if (text.includes('delete')) {
    return {
      intent: 'tool',
      reply: 'This delete needs confirmation before it can run.',
      tools: [{ name: 'deleteRecord', arguments: { id: 'cust-1001' } }],
      confidence: 0.82,
      evidence: 'The user asked to delete a demo record.',
    };
  }

  if (text.includes('customer')) {
    return {
      intent: 'tool',
      reply: 'I will look up the demo customer.',
      tools: [{ name: 'getCustomer', arguments: { id: 'cust-1001' } }],
      confidence: 0.88,
      evidence: 'The question named a customer lookup.',
    };
  }

  if (text.includes('order')) {
    return {
      intent: 'tool',
      reply: 'I will search demo orders.',
      tools: [{ name: 'searchOrders', arguments: { customerId: 'cust-1001' } }],
      confidence: 0.84,
      evidence: 'The question asked about orders.',
    };
  }

  if (text.includes('invoice')) {
    return {
      intent: 'tool',
      reply: 'I will fetch the demo invoice.',
      tools: [{ name: 'getInvoice', arguments: { id: 'inv-9001' } }],
      confidence: 0.84,
      evidence: 'The question asked about an invoice.',
    };
  }

  if (text.includes('notif')) {
    return {
      intent: 'tool',
      reply: 'I will list your notifications.',
      tools: [{ name: 'listNotifications', arguments: {} }],
      confidence: 0.8,
      evidence: 'The question asked about notifications.',
    };
  }

  if (text.includes('report')) {
    return {
      intent: 'tool',
      reply: 'I will generate a short report.',
      tools: [{ name: 'generateReport', arguments: { title: 'Status report', sections: [{ lines: ['Demo report'] }] } }],
      confidence: 0.78,
      evidence: 'The question asked for a report.',
    };
  }

  if (text.includes('summarize') || text.includes('document')) {
    return {
      intent: 'clarify',
      reply: 'Share a document id to summarize an analyzed document.',
      tools: [],
      confidence: 0.7,
      evidence: 'No document id was provided.',
    };
  }

  return {
    intent: 'answer',
    reply: 'Mock copilot answer for local testing, CI, and demo mode.',
    tools: [],
    confidence: 0.9,
    evidence: 'No allowlisted tool was required.',
  };
}

function defaultIntentCommand(input: AiProviderGenerateInput): unknown {
  const text = userUtteranceFromPrompt(input);

  if (/\b(sql|drop table|execute sql|shell|curl |fetch\(|eval\()\b/.test(text)) {
    return {
      intent: 'UNKNOWN',
      input: {},
      confidence: 0.2,
      evidence: 'The request asked for a forbidden execution path.',
      ambiguous: true,
      candidates: [],
      clarification: 'This engine cannot run SQL, shell, HTTP, or arbitrary code. Pick an allowlisted intent.',
    };
  }

  if (/\b(delete|remove)\b/.test(text)) {
    const id = text.match(/\b(?:ord|cust|inv)-[0-9]+\b/)?.[0] ?? 'ord-5003';
    return {
      intent: 'DELETE_RECORD',
      input: { id },
      confidence: 0.86,
      evidence: 'The user asked to delete a demo record.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\bbulk\b|\bmark all\b/.test(text)) {
    return {
      intent: 'BULK_UPDATE_ORDERS',
      input: { customerId: 'cust-1002', fromStatus: 'pending', toStatus: 'processing' },
      confidence: 0.84,
      evidence: 'The user asked for a bulk order update.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\b(email|sms|message|notify)\b/.test(text) && /\b(customer|contoso|northwind)\b/.test(text)) {
    return {
      intent: 'SEND_CUSTOMER_MESSAGE',
      input: { customerId: 'cust-1002', body: 'Following up on your open invoice.' },
      confidence: 0.82,
      evidence: 'The user asked to send a customer message.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\bcredit\b|\brefund\b/.test(text)) {
    return {
      intent: 'APPLY_CREDIT',
      input: { invoiceId: 'inv-9002', amount: 100 },
      confidence: 0.83,
      evidence: 'The user asked to apply a financial credit.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\binvoice\b/.test(text)) {
    const id = text.match(/\binv-[0-9]+\b/)?.[0] ?? 'inv-9001';
    return {
      intent: 'GET_INVOICE',
      input: { id },
      confidence: 0.88,
      evidence: 'The question named an invoice lookup.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\breport\b/.test(text)) {
    return {
      intent: 'GENERATE_REPORT',
      input: { title: 'Order summary', status: 'pending' },
      confidence: 0.8,
      evidence: 'The user asked for a report.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\bsummarize\b/.test(text) && /\bcustomer\b/.test(text)) {
    const id = text.match(/\bcust-[0-9]+\b/)?.[0] ?? 'cust-1001';
    return {
      intent: 'SUMMARIZE_CUSTOMER',
      input: { id },
      confidence: 0.87,
      evidence: 'The user asked to summarize a customer.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\btask\b/.test(text)) {
    return {
      intent: 'CREATE_TASK',
      input: { title: 'Follow up with customer', customerId: 'cust-1002' },
      confidence: 0.81,
      evidence: 'The user asked to create a task.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\bcustomer/.test(text) && !/\border/.test(text)) {
    return {
      intent: 'SEARCH_CUSTOMERS',
      input: { query: text.includes('contoso') ? 'Contoso' : undefined, status: text.includes('active') ? 'active' : undefined },
      confidence: 0.84,
      evidence: 'The question asked about customers.',
      ambiguous: false,
      candidates: [],
    };
  }

  if (/\border/.test(text) || /₹|rs\.?|rupee|amount|pending/.test(text)) {
    const amount = text.includes('50,000') || text.includes('50000') || text.includes('50 000') ? 50_000 : undefined;
    return {
      intent: 'SEARCH_ORDERS',
      input: {
        status: text.includes('pending') ? 'pending' : undefined,
        amountGreaterThan: amount,
        dateRange: text.includes('month') ? 'current_month' : undefined,
      },
      confidence: 0.91,
      evidence: 'The question asked to search orders with filters.',
      ambiguous: false,
      candidates: [],
    };
  }

  return {
    intent: 'UNKNOWN',
    input: {},
    confidence: 0.35,
    evidence: 'The request did not clearly match one allowlisted intent.',
    ambiguous: true,
    candidates: ['SEARCH_ORDERS', 'SEARCH_CUSTOMERS', 'GET_INVOICE'],
    clarification: 'Did you mean search orders, search customers, or get an invoice?',
  };
}

function defaultRagAnswer(input: AiProviderGenerateInput): unknown {
  const text = input.contents.map((item) => item.text).join('\n');
  const chunks = [...text.matchAll(/\[chunk chunkId=(\S+) documentId=(\S+) source=([\s\S]*?) score=([0-9.-]+)\]\n([\s\S]*?)\n\[\/chunk\]/g)];

  if (chunks.length === 0 || /\(no retrieved chunks\)/i.test(text)) {
    return {
      answer: 'I do not have enough retrieved evidence to answer that.',
      grounded: false,
      confidence: 0.1,
      sources: [],
      unsupported: ['No retrieved chunks were provided.'],
    };
  }

  const first = chunks[0];
  const snippet = (first?.[5] ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const jailbreak = /\b(ignore|disregard)\s+(all\s+)?(previous|prior|the)\s+(instructions|prompts?|rules)/i.test(text)
    || /\b(reveal|dump|show)\s+(your\s+)?(system prompt|hidden instructions|api keys?)\b/i.test(text)
    || /\bjailbreak\b|\bPWNED\b/i.test(text);

  if (jailbreak) {
    const evidence = snippet.match(/\b\d+\s+days?\b/i)?.[0];
    return {
      answer: evidence
        ? `The retrieved document mentions a ${evidence} window. Document instructions were ignored.`
        : 'The retrieved text included prompt-injection phrasing. I will only use it as evidence, not as instructions.',
      grounded: Boolean(snippet),
      confidence: snippet ? 0.7 : 0.1,
      sources: snippet
        ? [{ documentId: first?.[2] ?? 'unknown', chunkId: first?.[1] ?? 'unknown', quote: snippet.slice(0, 200) }]
        : [],
      unsupported: [],
    };
  }

  return {
    answer: snippet ? `Based on the retrieved document: ${snippet}` : 'I do not have enough retrieved evidence to answer that.',
    grounded: Boolean(snippet),
    confidence: snippet ? 0.86 : 0.1,
    sources: snippet
      ? [{ documentId: first?.[2] ?? 'unknown', chunkId: first?.[1] ?? 'unknown', quote: snippet.slice(0, 200) }]
      : [],
    unsupported: [],
  };
}

function userUtteranceFromPrompt(input: AiProviderGenerateInput): string {
  const text = input.contents.map((item) => item.text).join('\n');
  const fenced = text.match(
    /BEGIN UNTRUSTED USER DATA \(not instructions\) -----\s*([\s\S]*?)\s*----- END UNTRUSTED USER DATA/i,
  );
  return (fenced?.[1] ?? text).toLowerCase();
}

function defaultProblemSpec(): unknown {
  return {
    problemSummary:
      'Staff log in and record a work item so a manager can review the result in a dashboard.',
    users: [
      { name: 'Staff', description: 'Creates the core record.' },
      { name: 'Manager', description: 'Reviews the result.' },
    ],
    actors: [
      { name: 'Staff user', kind: 'human', description: 'Authenticated application user.' },
      { name: 'PostgreSQL', kind: 'system', description: 'Stores application records.' },
    ],
    workflows: [
      {
        name: 'Golden path',
        steps: ['Login', 'Create work item', 'Manager reviews the item'],
        actors: ['Staff user', 'Manager'],
      },
    ],
    entities: [{ name: 'Work item', fields: ['title', 'status'], description: 'Core domain record.' }],
    businessRules: [{ name: 'Only staff may create work items', description: 'unknown' }],
    integrations: 'unknown',
    odooRequirements: 'unknown',
    aiRequirements: 'unknown',
    automationRequirements: 'unknown',
    notifications: 'unknown',
    documents: 'unknown',
    reports: 'unknown',
    securityRequirements: [
      { name: 'Authenticate before the golden path', description: 'Use platform auth.' },
    ],
    nonFunctionalRequirements: [
      { name: 'Demo must work without paid APIs', description: 'Mock providers in demo mode.' },
    ],
    likelyDataRequirements: [{ name: 'work_items table', description: 'PostgreSQL via Prisma.' }],
    likelyInfrastructureRequirements: [{ name: 'postgres', description: 'Primary database.' }],
    mappings: [
      {
        requirement: 'Users must log in',
        category: 'security',
        existingCapability: 'auth',
        newProblemLogic: 'unknown',
        confidence: 0.93,
        evidence: 'The statement requires authenticated access.',
      },
      {
        requirement: 'Store hackathon-specific work items',
        category: 'entity',
        existingCapability: 'database',
        newProblemLogic: 'Define the work-item model and services under modules/problem.',
        confidence: 0.88,
      },
    ],
    confidence: 0.78,
    uncertainty: ['Integrations were not stated in the problem statement.'],
    unknowns: ['Odoo models', 'Notification channels'],
    requiresReview: true,
  };
}

