import { describe, expect, it } from 'vitest';

import { ANOMALY_EVALUATE_JOB } from '../anomaly';
import { AI_ANALYZE_JOB } from '../integrations/ai';
import { DOCUMENT_ANALYZE_JOB, DOCUMENT_PROCESS_JOB } from '../integrations/documents';
import { EMAIL_SEND_JOB } from '../integrations/email';
import { ODOO_SYNC_JOB } from '../integrations/odoo';
import { PDF_GENERATE_JOB, REPORT_GENERATE_JOB } from '../integrations/pdf';
import { RAG_INDEX_JOB } from '../integrations/rag';
import { SMS_SEND_JOB } from '../integrations/sms';
import { NOTIFICATION_DISPATCH_JOB } from '../notifications';
import { AUTOMATION, JOB_NAMES, NOTIFICATIONS } from './index';

describe('JOB_NAMES', () => {
  it('is the single source for registered job contracts', () => {
    expect(EMAIL_SEND_JOB).toBe(JOB_NAMES.EMAIL_SEND);
    expect(SMS_SEND_JOB).toBe(JOB_NAMES.SMS_SEND);
    expect(PDF_GENERATE_JOB).toBe(JOB_NAMES.PDF_GENERATE);
    expect(REPORT_GENERATE_JOB).toBe(JOB_NAMES.REPORT_GENERATE);
    expect(AI_ANALYZE_JOB).toBe(JOB_NAMES.AI_ANALYZE);
    expect(DOCUMENT_ANALYZE_JOB).toBe(JOB_NAMES.DOCUMENT_ANALYZE);
    expect(DOCUMENT_PROCESS_JOB).toBe(JOB_NAMES.DOCUMENT_PROCESS);
    expect(RAG_INDEX_JOB).toBe(JOB_NAMES.RAG_INDEX);
    expect(ANOMALY_EVALUATE_JOB).toBe(JOB_NAMES.ANOMALY_EVALUATE);
    expect(ODOO_SYNC_JOB).toBe(JOB_NAMES.ODOO_SYNC);
    expect(NOTIFICATION_DISPATCH_JOB).toBe(JOB_NAMES.NOTIFICATION_DISPATCH);
    expect(NOTIFICATIONS.DISPATCH_JOB).toBe(JOB_NAMES.NOTIFICATION_DISPATCH);
    expect(AUTOMATION.EXECUTE_JOB).toBe(JOB_NAMES.AUTOMATION_EXECUTE);
  });
});
