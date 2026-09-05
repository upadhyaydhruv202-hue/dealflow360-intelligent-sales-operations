import { ANALYZE_PROMPT } from './analyze';
import { CLASSIFY_PROMPT } from './classify';
import { DRAFT_PROMPT } from './draft';
import { EXTRACT_PROMPT } from './extract';
import { RECOMMEND_PROMPT } from './recommend';
import { SUMMARIZE_PROMPT } from './summarize';

export { ANALYZE_PROMPT, buildAnalyzePrompt } from './analyze';
export { CLASSIFY_PROMPT, buildClassifyPrompt } from './classify';
export { DRAFT_PROMPT, buildDraftPrompt } from './draft';
export { EXTRACT_PROMPT, buildExtractPrompt } from './extract';
export { RECOMMEND_PROMPT, buildRecommendPrompt } from './recommend';
export { SUMMARIZE_PROMPT, buildSummarizePrompt } from './summarize';
export {
  AI_JSON_INSTRUCTION,
  AI_SAFETY_CLOSING,
  AI_SAFETY_PREAMBLE,
  stripSafetyDecorations,
  withSafetySystem,
} from './safety';
export { PROMPT_VERSION } from './types';
export type { BuiltPrompt, PromptVersion, VersionedPromptTemplate } from './types';

export const AI_PROMPT_CATALOG = {
  summarize: SUMMARIZE_PROMPT,
  classify: CLASSIFY_PROMPT,
  extract: EXTRACT_PROMPT,
  analyze: ANALYZE_PROMPT,
  recommend: RECOMMEND_PROMPT,
  draft: DRAFT_PROMPT,
} as const;
