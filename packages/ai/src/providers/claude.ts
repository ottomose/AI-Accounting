import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { AIProvider } from './base';
import type {
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  ProviderCost,
  ToolCall,
  ToolDefinition,
  VisionRequest,
  AgentMessage,
} from '../types';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export class ClaudeProvider extends AIProvider {
  private client: Anthropic;
  private model: string;
  private maxRetries: number;

  constructor(config: ProviderConfig) {
    super();
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.maxRetries = config.maxRetries ?? 3;
  }

  get modelName(): string {
    return this.model;
  }

  get costPer1kTokens(): ProviderCost {
    if (this.model.includes('opus')) {
      return { input: 0.015, output: 0.075 };
    }
    if (this.model.includes('haiku')) {
      return { input: 0.00025, output: 0.00125 };
    }
    return { input: 0.003, output: 0.015 };
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    const response = await this.withRetry(async () => {
      return this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0,
        system: request.systemPrompt ?? '',
        messages: this.toAnthropicMessages(request.messages),
        tools: request.tools ? this.toAnthropicTools(request.tools) : undefined,
      });
    }, this.maxRetries);

    return this.parseResponse(response, startTime);
  }

  async completeWithVision(request: VisionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    const imageBlock: ContentBlockParam = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: request.image.mediaType as ImageMediaType,
        data: request.image.data,
      },
    };

    const messages = this.toAnthropicMessages(request.messages);

    if (messages.length > 0 && messages[0].role === 'user') {
      const firstMsg = messages[0];
      if (typeof firstMsg.content === 'string') {
        firstMsg.content = [imageBlock, { type: 'text', text: firstMsg.content }];
      } else {
        (firstMsg.content as ContentBlockParam[]).unshift(imageBlock);
      }
    } else {
      messages.unshift({ role: 'user', content: [imageBlock] });
    }

    const response = await this.withRetry(async () => {
      return this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0,
        system: request.systemPrompt ?? '',
        messages,
        tools: request.tools ? this.toAnthropicTools(request.tools) : undefined,
      });
    }, this.maxRetries);

    return this.parseResponse(response, startTime);
  }

  private toAnthropicMessages(messages: AgentMessage[]): MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m): MessageParam => ({
        role: m.role as 'user' | 'assistant',
        content: m.content.map((c): ContentBlockParam => {
          switch (c.type) {
            case 'text':
              return { type: 'text', text: c.text };
            case 'image':
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: c.source.mediaType as ImageMediaType,
                  data: c.source.data,
                },
              };
            case 'tool_use':
              return {
                type: 'tool_use',
                id: c.toolCall.id,
                name: c.toolCall.name,
                input: c.toolCall.arguments,
              };
            case 'tool_result':
              return {
                type: 'tool_result',
                tool_use_id: c.toolResult.callId,
                content: JSON.stringify(c.toolResult.data),
              };
          }
        }),
      }));
  }

  private toAnthropicTools(tools: ToolDefinition[]): Tool[] {
    return tools.map((t): Tool => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        ...t.parametersJsonSchema,
      },
    }));
  }

  private parseResponse(
    response: Anthropic.Message,
    startTime: number
  ): CompletionResponse {
    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      model: response.model,
      tokens: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      rawResponse: response,
      latencyMs: Date.now() - startTime,
    };
  }
}
