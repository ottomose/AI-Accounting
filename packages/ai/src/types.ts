import { z } from 'zod';

// ==================== Tool Types ====================

export enum ToolCategory {
  JOURNAL = 'journal',
  QUERY = 'query',
  REPORT = 'report',
  OCR = 'ocr',
  REVIEW = 'review',
  TAX = 'tax',
}

export interface ToolDefinition {
  name: string;
  description: string;
  descriptionKa: string;
  category: ToolCategory;
  parameters: z.ZodType;
  parametersJsonSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  success: boolean;
  data: unknown;
  error?: string;
}

// ==================== Message Types ====================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: ImageSource;
}

export interface ImageSource {
  type: 'base64' | 'url';
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  toolCall: ToolCall;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolResult: ToolResult;
}

export type MessageContent =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent;

export interface AgentMessage {
  role: MessageRole;
  content: MessageContent[];
}

// ==================== Completion Types ====================

export interface CompletionRequest {
  messages: AgentMessage[];
  tools?: ToolDefinition[];
  systemPrompt?: string;
  modelPreference?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VisionRequest extends CompletionRequest {
  image: ImageSource;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface CompletionResponse {
  content: string;
  toolCalls: ToolCall[];
  model: string;
  tokens: TokenUsage;
  rawResponse: unknown;
  latencyMs: number;
}

// ==================== Confidence Types ====================

export enum ConfidenceLevel {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  reasoning: string;
}

// ==================== Task & Provider Types ====================

export enum TaskType {
  DOCUMENT_OCR = 'DOCUMENT_OCR',
  CATEGORIZATION = 'CATEGORIZATION',
  CHAT = 'CHAT',
  COMPLEX_ANALYSIS = 'COMPLEX_ANALYSIS',
  JOURNAL_ENTRY = 'JOURNAL_ENTRY',
}

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface ProviderCost {
  input: number;
  output: number;
}

export interface RouteLog {
  taskType: TaskType;
  provider: string;
  model: string;
  tokens: TokenUsage;
  latencyMs: number;
  timestamp: Date;
}

// ==================== Confidence Context ====================

export interface ConfidenceContext {
  isKnownCounterparty: boolean;
  isTypicalAmount: boolean;
  amountRatio: number;
  ocrFieldsRecognized: number;
  ocrFieldsTotal: number;
  ocrConfidence: number;
  accountIsSpecific: boolean;
}
