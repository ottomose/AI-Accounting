import { describe, it, expect, vi } from 'vitest';
import { AIRouter } from '../src/router';
import { AIProvider } from '../src/providers/base';
import { TaskType } from '../src/types';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderCost,
  VisionRequest,
} from '../src/types';

class MockProvider extends AIProvider {
  private name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  get modelName(): string {
    return `mock-${this.name}`;
  }

  get costPer1kTokens(): ProviderCost {
    return { input: 0.001, output: 0.002 };
  }

  async complete(_request: CompletionRequest): Promise<CompletionResponse> {
    return {
      content: `Response from ${this.name}`,
      toolCalls: [],
      model: this.modelName,
      tokens: { input: 100, output: 50, total: 150 },
      rawResponse: {},
      latencyMs: 200,
    };
  }

  async completeWithVision(_request: VisionRequest): Promise<CompletionResponse> {
    return {
      content: `Vision response from ${this.name}`,
      toolCalls: [],
      model: this.modelName,
      tokens: { input: 200, output: 100, total: 300 },
      rawResponse: {},
      latencyMs: 500,
    };
  }
}

describe('AIRouter', () => {
  const primaryProvider = new MockProvider('primary');
  const cheapProvider = new MockProvider('cheap');
  const premiumProvider = new MockProvider('premium');

  const router = new AIRouter({
    primary: primaryProvider,
    cheap: cheapProvider,
    premium: premiumProvider,
  });

  const baseRequest: CompletionRequest = {
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
  };

  it('should route DOCUMENT_OCR to primary provider', async () => {
    const response = await router.route(TaskType.DOCUMENT_OCR, baseRequest);
    expect(response.model).toBe('mock-primary');
  });

  it('should route CATEGORIZATION to cheap provider', async () => {
    const response = await router.route(TaskType.CATEGORIZATION, baseRequest);
    expect(response.model).toBe('mock-cheap');
  });

  it('should route CHAT to primary provider', async () => {
    const response = await router.route(TaskType.CHAT, baseRequest);
    expect(response.model).toBe('mock-primary');
  });

  it('should route COMPLEX_ANALYSIS to premium provider', async () => {
    const response = await router.route(TaskType.COMPLEX_ANALYSIS, baseRequest);
    expect(response.model).toBe('mock-premium');
  });

  it('should route JOURNAL_ENTRY to primary provider', async () => {
    const response = await router.route(TaskType.JOURNAL_ENTRY, baseRequest);
    expect(response.model).toBe('mock-primary');
  });

  it('should fall back to primary if cheap is not configured', async () => {
    const simpleRouter = new AIRouter({ primary: primaryProvider });
    const response = await simpleRouter.route(TaskType.CATEGORIZATION, baseRequest);
    expect(response.model).toBe('mock-primary');
  });

  it('should fall back to primary if premium is not configured', async () => {
    const simpleRouter = new AIRouter({ primary: primaryProvider });
    const response = await simpleRouter.route(TaskType.COMPLEX_ANALYSIS, baseRequest);
    expect(response.model).toBe('mock-primary');
  });

  it('should log each route call', async () => {
    const logRouter = new AIRouter({ primary: primaryProvider });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await logRouter.route(TaskType.CHAT, baseRequest);
    await logRouter.route(TaskType.JOURNAL_ENTRY, baseRequest);

    const logs = logRouter.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].taskType).toBe(TaskType.CHAT);
    expect(logs[1].taskType).toBe(TaskType.JOURNAL_ENTRY);

    vi.restoreAllMocks();
  });

  it('should include token and latency info in logs', async () => {
    const logRouter = new AIRouter({ primary: primaryProvider });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await logRouter.route(TaskType.CHAT, baseRequest);

    const logs = logRouter.getLogs();
    expect(logs[0].tokens.total).toBe(150);
    expect(logs[0].latencyMs).toBe(200);
    expect(logs[0].model).toBe('mock-primary');

    vi.restoreAllMocks();
  });

  it('should route vision requests', async () => {
    const visionRequest: VisionRequest = {
      ...baseRequest,
      image: {
        type: 'base64',
        mediaType: 'image/jpeg',
        data: 'base64data',
      },
    };

    vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await router.routeVision(TaskType.DOCUMENT_OCR, visionRequest);
    expect(response.content).toContain('Vision response');
    vi.restoreAllMocks();
  });

  it('should expose provider for a given task type', () => {
    const provider = router.getProviderForTask(TaskType.CATEGORIZATION);
    expect(provider.modelName).toBe('mock-cheap');
  });
});
