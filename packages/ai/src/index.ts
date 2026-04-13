// Types
export {
  ToolCategory,
  ConfidenceLevel,
  TaskType,
} from './types';
export type {
  ToolDefinition,
  ToolCall,
  ToolResult,
  AgentMessage,
  MessageContent,
  TextContent,
  ImageContent,
  ImageSource,
  ToolUseContent,
  ToolResultContent,
  CompletionRequest,
  CompletionResponse,
  VisionRequest,
  TokenUsage,
  ConfidenceResult,
  ConfidenceContext,
  ProviderConfig,
  ProviderCost,
  RouteLog,
} from './types';

// Providers
export { AIProvider } from './providers/base';
export { ClaudeProvider } from './providers/claude';
export { GeminiProvider } from './providers/gemini';

// Router
export { AIRouter } from './router';

// Confidence
export { assessConfidence, scoreToLevel } from './confidence';

// Tools
export {
  tools,
  getToolByName,
  getToolsByCategory,
  createJournalEntryParams,
  categorizeTransactionParams,
  getAccountBalanceParams,
  listPayablesParams,
  listReceivablesParams,
  generateReportParams,
  lookupCounterpartyParams,
  calculateTaxParams,
  flagForReviewParams,
  processDocumentParams,
} from './tools';

// Prompts
export { SYSTEM_PROMPT } from './prompts/system';
export {
  OCR_RECEIPT,
  OCR_INVOICE,
  OCR_BANK_STATEMENT,
  CATEGORIZE,
  CHAT_CLIENT,
  CHAT_OPERATOR,
} from './prompts/templates';
