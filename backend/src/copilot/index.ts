export { createCopilotService, CopilotService, isCopilotEnabled } from './copilot.service';
export type { CopilotServiceOptions } from './copilot.service';
export {
  createCopilotConfirmations,
  createMemoryCopilotConfirmations,
  KvCopilotConfirmationStore,
} from './copilot.pending';
export type { CopilotConfirmationStore, PendingCopilotCommand } from './copilot.pending';
export { createCopilotToolRegistry, CopilotToolRegistry, describeSchema } from './copilot.registry';
export { defineCopilotTool } from './copilot.types';
export { createMemoryCopilotConversations } from './copilot.memory';
export { copilotChatBodySchema, copilotConversationParamsSchema, copilotPlanSchema } from './copilot.schemas';
export { createDefaultCopilotRegistry, registerBuiltinCopilotTools, registerDemoCopilotTools } from './tools';
export type {
  CopilotChatInput,
  CopilotChatResult,
  CopilotToolContext,
  CopilotToolDefinition,
  CopilotToolDescriptor,
  CopilotToolExecution,
} from './copilot.types';
