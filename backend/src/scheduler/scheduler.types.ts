export interface ScheduleDefinition {
  name: string;
  intervalMs?: number;
  cron?: string;
  trigger?: string;
  payload?: Record<string, unknown>;
  buildPayload?: (now: Date) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface RegisteredSchedule {
  name: string;
  intervalMs?: number;
  cron?: string;
  trigger: string;
  payload: Record<string, unknown>;
  buildPayload?: ScheduleDefinition['buildPayload'];
}
