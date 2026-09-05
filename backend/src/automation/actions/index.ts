import { EMAIL_SEND_JOB } from '../../integrations/email';
import { PDF_GENERATE_JOB, REPORT_GENERATE_JOB } from '../../integrations/pdf';
import { AI_ANALYZE_JOB } from '../../integrations/ai';
import { DOCUMENT_ANALYZE_JOB, DOCUMENT_PROCESS_JOB } from '../../integrations/documents';
import { ODOO_SYNC_JOB } from '../../integrations/odoo';
import { JOB_NAMES } from '../../constants';
import { NOTIFICATION_DISPATCH_JOB } from '../../notifications';
import type { AutomationRegistries } from '../automation.registry';
import { registerBuiltinActions, type BuiltinAutomationActionDeps } from './builtin';
import { registerBuiltinTriggers } from '../triggers/builtin';

export function registerDefaultAutomation(
  registries: AutomationRegistries,
  deps: BuiltinAutomationActionDeps,
): void {
  registerBuiltinTriggers(registries.triggers);
  registries.allowedJobs.allow(EMAIL_SEND_JOB);
  registries.allowedJobs.allow(PDF_GENERATE_JOB);
  registries.allowedJobs.allow(REPORT_GENERATE_JOB);
  registries.allowedJobs.allow(AI_ANALYZE_JOB);
  registries.allowedJobs.allow(DOCUMENT_ANALYZE_JOB);
  registries.allowedJobs.allow(DOCUMENT_PROCESS_JOB);
  registries.allowedJobs.allow(ODOO_SYNC_JOB);
  registries.allowedJobs.allow(JOB_NAMES.CLEANUP);
  registries.allowedJobs.allow(NOTIFICATION_DISPATCH_JOB);
  registries.allowedJobs.allow(JOB_NAMES.SMS_SEND);
  registries.allowedJobs.allow(JOB_NAMES.ANOMALY_EVALUATE);
  registerBuiltinActions(registries.actions, {
    ...deps,
    recordUpdaters: registries.recordUpdaters,
    allowedJobs: registries.allowedJobs,
  });
}

export { registerBuiltinActions } from './builtin';
export type { BuiltinAutomationActionDeps } from './builtin';
