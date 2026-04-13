import type { AIProvider } from './providers/base';
import type {
  CompletionRequest,
  CompletionResponse,
  RouteLog,
  VisionRequest,
} from './types';
import { TaskType } from './types';

interface RouterConfig {
  primary: AIProvider;
  cheap?: AIProvider;
  premium?: AIProvider;
}

export class AIRouter {
  private providers: RouterConfig;
  private logs: RouteLog[] = [];

  constructor(providers: RouterConfig) {
    this.providers = providers;
  }

  async route(
    taskType: TaskType,
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const provider = this.selectProvider(taskType);
    const response = await provider.complete(request);

    this.log(taskType, provider, response);
    return response;
  }

  async routeVision(
    taskType: TaskType,
    request: VisionRequest
  ): Promise<CompletionResponse> {
    const provider = this.selectProvider(taskType);
    const response = await provider.completeWithVision(request);

    this.log(taskType, provider, response);
    return response;
  }

  private selectProvider(taskType: TaskType): AIProvider {
    switch (taskType) {
      case TaskType.DOCUMENT_OCR:
        // Vision requires primary (Claude) in MVP
        return this.providers.primary;

      case TaskType.CATEGORIZATION:
        // Use cheap provider if available (Gemini Flash in future)
        return this.providers.cheap ?? this.providers.primary;

      case TaskType.CHAT:
        return this.providers.primary;

      case TaskType.COMPLEX_ANALYSIS:
        // Use premium provider if available (Claude Opus)
        return this.providers.premium ?? this.providers.primary;

      case TaskType.JOURNAL_ENTRY:
        return this.providers.primary;

      default:
        return this.providers.primary;
    }
  }

  private log(
    taskType: TaskType,
    provider: AIProvider,
    response: CompletionResponse
  ): void {
    const entry: RouteLog = {
      taskType,
      provider: provider.constructor.name,
      model: response.model,
      tokens: response.tokens,
      latencyMs: response.latencyMs,
      timestamp: new Date(),
    };

    this.logs.push(entry);

    console.log(
      `[AIRouter] ${taskType} → ${entry.provider}/${entry.model} ` +
        `(${entry.tokens.total} tokens, ${entry.latencyMs}ms)`
    );
  }

  getLogs(): RouteLog[] {
    return [...this.logs];
  }

  getProviderForTask(taskType: TaskType): AIProvider {
    return this.selectProvider(taskType);
  }
}
