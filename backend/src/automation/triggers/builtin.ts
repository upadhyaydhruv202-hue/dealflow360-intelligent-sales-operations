import { AUTOMATION_BUILTIN_TRIGGERS } from '../../constants';
import type { AutomationTriggerRegistry } from '../automation.registry';

const DESCRIPTIONS: Record<(typeof AUTOMATION_BUILTIN_TRIGGERS)[number], string> = {
  'user.created': 'A new application user was registered.',
  'order.created': 'An order was created. Emit from problem modules.',
  'order.updated': 'An order was updated. Emit from problem modules.',
  'invoice.overdue': 'An invoice crossed an overdue threshold. Emit from problem modules or a scheduler.',
  'document.uploaded': 'A document was uploaded for analysis.',
  'report.completed': 'A PDF or report finished generating.',
  scheduled: 'A scheduled tick from the built-in scheduler (payload.schedule, default tick).',
  'webhook.received': 'An inbound webhook was accepted by the automation API.',
  'anomaly.detected': 'A statistical anomaly was detected on a metric series.',
};

export function registerBuiltinTriggers(registry: AutomationTriggerRegistry): void {
  for (const name of AUTOMATION_BUILTIN_TRIGGERS) {
    registry.register({ name, description: DESCRIPTIONS[name] });
  }
}
