import { AIProvider } from './base';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  ProviderCost,
  VisionRequest,
} from '../types';

/**
 * Gemini AI Provider
 *
 * Target model: gemini-2.5-flash
 * Use case: Cost-effective categorization, simple queries
 *
 * TODO: Implement with @google/generative-ai SDK
 */
export class GeminiProvider extends AIProvider {
  private model: string;

  constructor(config: ProviderConfig) {
    super();
    this.model = config.model ?? 'gemini-2.5-flash';
  }

  get modelName(): string {
    return this.model;
  }

  get costPer1kTokens(): ProviderCost {
    // Gemini 2.5 Flash pricing
    return { input: 0.00015, output: 0.0006 };
  }

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    // TODO: Implement with @google/generative-ai SDK
    // 1. Convert messages to Gemini format
    // 2. Convert tool definitions to Gemini function declarations
    // 3. Call generateContent
    // 4. Parse response into CompletionResponse
    throw new Error(
      `GeminiProvider.complete() not implemented yet. Model: ${this.model}. ` +
        'Install @google/generative-ai and implement the API call.'
    );
  }

  async completeWithVision(_request: VisionRequest): Promise<CompletionResponse> {
    // TODO: Implement with @google/generative-ai SDK
    // 1. Convert image to Gemini inline data format
    // 2. Combine with text content
    // 3. Call generateContent with image
    // 4. Parse response
    throw new Error(
      `GeminiProvider.completeWithVision() not implemented yet. Model: ${this.model}. ` +
        'Install @google/generative-ai and implement the vision API call.'
    );
  }
}
