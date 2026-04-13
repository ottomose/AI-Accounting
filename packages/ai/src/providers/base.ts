import type {
  CompletionRequest,
  CompletionResponse,
  ProviderCost,
  ToolCall,
  ToolDefinition,
  VisionRequest,
} from '../types';

export abstract class AIProvider {
  abstract get modelName(): string;
  abstract get costPer1kTokens(): ProviderCost;

  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  abstract completeWithVision(request: VisionRequest): Promise<CompletionResponse>;

  extractToolCalls(response: CompletionResponse): ToolCall[] {
    return response.toolCalls;
  }

  protected toProviderTools(
    _tools: ToolDefinition[]
  ): unknown[] {
    return [];
  }

  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries && this.isRetryable(lastError)) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError;
  }

  protected isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('overloaded') ||
      message.includes('timeout') ||
      message.includes('503')
    );
  }
}
