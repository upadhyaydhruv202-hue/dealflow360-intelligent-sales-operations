import { ValidationError } from '../../errors';
import { parseInlineDataset, requireFactKeys, NARRATIVE_KEYS } from './report.integrity';
import { createBuiltinTemplates } from './report.templates';
import type {
  ReportDataProvider,
  ReportDataset,
  ReportTemplate,
  ReportTypeInfo,
} from './report.types';

export class ReportRegistry {
  private readonly templates = new Map<string, ReportTemplate>();
  private readonly providers = new Map<string, ReportDataProvider>();

  constructor(templates: readonly ReportTemplate[] = createBuiltinTemplates()) {
    for (const template of templates) {
      this.templates.set(template.type, template);
    }
  }

  registerTemplate(template: ReportTemplate): this {
    assertTypeId(template.type);
    if (this.templates.has(template.type)) {
      throw new ValidationError('Duplicate report template', [
        { path: 'type', message: `Template "${template.type}" is already registered`, code: 'custom' },
      ]);
    }
    this.templates.set(template.type, template);
    return this;
  }

  registerDataProvider(type: string, provider: ReportDataProvider): this {
    assertTypeId(type);
    if (this.providers.has(type)) {
      throw new ValidationError('Duplicate report data provider', [
        { path: 'type', message: `Data provider "${type}" is already registered`, code: 'custom' },
      ]);
    }
    this.providers.set(type, provider);
    return this;
  }

  getTemplate(type: string): ReportTemplate {
    const template = this.templates.get(type);
    if (!template) {
      throw new ValidationError('Unknown report type', [
        { path: 'type', message: `Report type "${type}" is not registered`, code: 'custom' },
      ]);
    }
    return template;
  }

  async resolveDataset(type: string, data: Record<string, unknown>, userId?: string): Promise<ReportDataset> {
    const template = this.getTemplate(type);
    const provider = this.providers.get(type);
    const dataset = provider ? await provider({ type, data, userId }) : parseInlineDataset(data);
    const sanitized = sanitizeDataset(dataset);
    requireFactKeys(sanitized, template.requiredFactKeys, type);
    return sanitized;
  }

  list(): ReportTypeInfo[] {
    return [...this.templates.values()].map((template) => ({
      type: template.type,
      description: template.description,
      requiredFactKeys: [...template.requiredFactKeys],
      hasDataProvider: this.providers.has(template.type),
    }));
  }
}

export function createDefaultReportRegistry(): ReportRegistry {
  return new ReportRegistry();
}

function assertTypeId(type: string): void {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(type)) {
    throw new ValidationError('Invalid report type id', [
      { path: 'type', message: `Report type "${type}" is not allowed`, code: 'custom' },
    ]);
  }
}

function sanitizeDataset(dataset: ReportDataset): ReportDataset {
  const facts = { ...dataset.facts };
  for (const key of NARRATIVE_KEYS) {
    delete facts[key];
  }
  return { ...dataset, facts };
}
