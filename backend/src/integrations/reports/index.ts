export { createReportService, ReportService, isQueuedReport } from './report.service';
export type { ReportServiceOptions, ReportGeneratedEvent } from './report.service';
export { createDefaultReportRegistry, ReportRegistry } from './report.registry';
export { createBuiltinTemplates } from './report.templates';
export {
  generateReportInputSchema,
  generateReportBodySchema,
  reportGenerateJobPayloadSchema,
} from './report.schemas';
export { REPORT_GENERATE_JOB, REPORT_TYPES } from './report.types';
export type {
  GenerateReportInput,
  GenerateReportResult,
  GeneratedReport,
  QueuedReport,
  ReportDataset,
  ReportTemplate,
  ReportDataProvider,
  ReportTypeInfo,
} from './report.types';
export { parseInlineDataset, splitReportData, mergeVerifiedFacts } from './report.integrity';
