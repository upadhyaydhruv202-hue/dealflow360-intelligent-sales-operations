import { ValidationError } from '../../../errors';
import { isLowConfidence } from '../ai.review';
import {
  HIGH_RISK_ACTION_KINDS,
  type AiActionKind,
  type AiRiskLevel,
  type HighRiskActionKind,
} from './types';

export function isHighRiskActionKind(kind: AiActionKind | undefined): kind is HighRiskActionKind {
  return Boolean(kind && (HIGH_RISK_ACTION_KINDS as readonly string[]).includes(kind));
}

export function confirmationRequired(input: {
  riskLevel: AiRiskLevel;
  actionKind?: AiActionKind;
  needsConfirmation?: boolean;
  plannerConfidence?: number;
}): boolean {
  if (input.needsConfirmation) {
    return true;
  }

  if (input.riskLevel === 'high' || isHighRiskActionKind(input.actionKind)) {
    return true;
  }

  if (
    input.plannerConfidence !== undefined &&
    isLowConfidence(input.plannerConfidence) &&
    input.riskLevel !== 'low'
  ) {
    return true;
  }

  return false;
}

export function assertActionConfirmed(input: {
  required: boolean;
  confirmed: boolean;
  toolName?: string;
}): void {
  if (!input.required || input.confirmed) {
    return;
  }

  throw new ValidationError('This action requires explicit confirmation', [
    {
      path: 'confirmed',
      message: input.toolName
        ? `Confirm "${input.toolName}" before it can run`
        : 'High-risk AI actions require an explicit confirmed=true flag',
      code: 'custom',
    },
  ]);
}

export function trustExplicitConfirmation(confirmed: boolean): boolean {
  return confirmed === true;
}
