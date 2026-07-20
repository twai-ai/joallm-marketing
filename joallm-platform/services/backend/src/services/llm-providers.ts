import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { llmApiCalls, llmApiDuration, llmTokensTotal } from '../utils/prometheus-metrics.js';

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamResponse {
  content: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface UserApiKeys {
  openai?: string;
  anthropic?: string;
  groq?: string;
  cohere?: string;
  ollama?: string;
}

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || config.openaiApiKey,
    });
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
        top_p: parameters.topP,
        frequency_penalty: parameters.frequencyPenalty,
        presence_penalty: parameters.presencePenalty,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content in OpenAI response');
      }

      return {
        content: choice.message.content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw new Error('OpenAI API request failed');
    }
  }

  async *generateStreamResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
        top_p: parameters.topP,
        frequency_penalty: parameters.frequencyPenalty,
        presence_penalty: parameters.presencePenalty,
        stream: true,
      });

      let fullContent = '';
      let usage: LLMResponse['usage'] | undefined;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield {
            content: delta.content,
            done: false,
          };
        }

        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
          };
        }
      }

      // Send final response with usage
      yield {
        content: '',
        done: true,
        usage,
      };
    } catch (error) {
      logger.error('OpenAI streaming error:', error);
      throw new Error('OpenAI streaming request failed');
    }
  }
}

export class AnthropicProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || config.anthropicApiKey,
    });
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): Promise<LLMResponse> {
    try {
      // Anthropic expects a different message format
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.client.messages.create({
        model,
        system: systemMessage?.content || '',
        messages: conversationMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
        top_p: parameters.topP,
      });

      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw new Error('Anthropic API request failed');
    }
  }

  async *generateStreamResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    try {
      // Anthropic expects a different message format
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const stream = await this.client.messages.create({
        model,
        system: systemMessage?.content || '',
        messages: conversationMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
        top_p: parameters.topP,
        stream: true,
      });

      let promptTokens = 0;
      let completionTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield {
            content: event.delta.text,
            done: false,
          };
        }

        // Capture input tokens from message_start
        if (event.type === 'message_start' && 'message' in event && event.message.usage) {
          promptTokens = event.message.usage.input_tokens;
        }

        // Capture output tokens from message_delta (accurate final count)
        if (event.type === 'message_delta' && 'usage' in event && (event as any).usage) {
          completionTokens = (event as any).usage.output_tokens ?? completionTokens;
        }
      }

      const usage: LLMResponse['usage'] | undefined = promptTokens > 0 || completionTokens > 0
        ? { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
        : undefined;

      // Send final response with usage
      yield {
        content: '',
        done: true,
        usage,
      };
    } catch (error) {
      logger.error('Anthropic streaming error:', error);
      throw new Error('Anthropic streaming request failed');
    }
  }
}

export class MockProvider {
  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): Promise<LLMResponse> {
    logger.info(`[MOCK] Generating response for model: ${model}`);
    
    const userMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    const mockResponse = `This is a mock response to: "${userMessage}"\n\nI'm running in mock mode. To use real LLM providers, please configure valid API keys in your .env file.\n\nMock model: ${model}\nTemperature: ${parameters.temperature}`;
    
    // Simulate token counts
    const promptTokens = messages.reduce((sum, m) => sum + m.content.split(' ').length, 0);
    const completionTokens = mockResponse.split(' ').length;
    
    return {
      content: mockResponse,
      model: model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async *generateStreamResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    logger.info(`[MOCK] Streaming response for model: ${model}`);
    
    const userMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    const mockResponse = `This is a mock streaming response to: "${userMessage}"\n\nI'm running in mock mode. To use real LLM providers, please configure valid API keys in your .env file.\n\nMock model: ${model}\nTemperature: ${parameters.temperature}`;
    
    // Simulate token counts
    const promptTokens = messages.reduce((sum, m) => sum + m.content.split(' ').length, 0);
    const completionTokens = mockResponse.split(' ').length;
    
    // Stream the response word by word with realistic timing
    const words = mockResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay between words
      yield {
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: false,
      };
    }
    
    // Send final message with usage
    yield {
      content: '',
      done: true,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}

export class GroqProvider {
  private client: Groq;

  constructor(apiKey?: string) {
    this.client = new Groq({
      apiKey: apiKey || config.groqApiKey,
    });
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): Promise<LLMResponse> {
    try {
      logger.info(`[GROQ] Generating response with model: ${model}`);
      
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
        top_p: parameters.topP,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content in Groq response');
      }

      return {
        content: choice.message.content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('Groq API error:', error);
      throw new Error('Groq API request failed');
    }
  }

  async *generateStreamResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    try {
      logger.info(`[GROQ] Streaming response with model: ${model}`);
      
      const stream = await this.client.chat.completions.create({
        model,
        messages: messages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
        top_p: parameters.topP,
        stream: true,
      });

      let usage: LLMResponse['usage'] | undefined;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          yield {
            content: delta.content,
            done: false,
          };
        }

        // Groq provides usage in the final chunk
        if ('usage' in chunk && chunk.usage) {
          usage = {
            promptTokens: (chunk.usage as any).prompt_tokens || 0,
            completionTokens: (chunk.usage as any).completion_tokens || 0,
            totalTokens: (chunk.usage as any).total_tokens || 0,
          };
        }
      }

      // Send final response with usage
      yield {
        content: '',
        done: true,
        usage,
      };
    } catch (error) {
      logger.error('Groq streaming error:', error);
      throw new Error('Groq streaming request failed');
    }
  }
}

export type WorkspaceConnector = 'gmail' | 'googlecalendar' | 'googledrive';

export interface WorkspaceQueryOptions {
  model: string;
  prompt: string;
  connectors: WorkspaceConnector[];
  accessToken: string;
  groqApiKey?: string;
}

export interface WorkspaceQueryResult {
  content: string;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Query Groq's Responses API with Google Workspace connectors injected.
 * Uses raw fetch — the Groq SDK does not yet expose the Responses API.
 * Connectors are read-only (Gmail, Calendar, Drive) and require a valid
 * Google OAuth access token scoped to those services.
 */
export async function groqWorkspaceQuery(opts: WorkspaceQueryOptions): Promise<WorkspaceQueryResult> {
  const apiKey = opts.groqApiKey || config.groqApiKey;

  const tools = opts.connectors.map((connector) => ({
    type: `connector_${connector}`,
    authorization: `Bearer ${opts.accessToken}`,
  }));

  const response = await fetch('https://api.groq.com/openai/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      input: opts.prompt,
      tools,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error(`Groq Responses API error ${response.status}: ${errText}`);
    throw new Error(`Groq Workspace query failed: ${response.status}`);
  }

  const data = await response.json() as any;

  // Responses API returns output as an array of content blocks
  const content: string = Array.isArray(data.output)
    ? data.output
        .filter((block: any) => block.type === 'message')
        .flatMap((block: any) =>
          Array.isArray(block.content)
            ? block.content.filter((c: any) => c.type === 'output_text').map((c: any) => c.text)
            : [],
        )
        .join('')
    : (data.output_text ?? '');

  return {
    content,
    model: data.model ?? opts.model,
    usage: {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

export class OllamaProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.baseUrl = config.ollamaBaseUrl;
    this.apiKey = apiKey || config.ollamaApiKey;
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): Promise<LLMResponse> {
    try {
      logger.info(`[OLLAMA] Generating response with model: ${model}`);
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: false,
          options: {
            temperature: parameters.temperature,
            num_predict: parameters.maxTokens,
            top_p: parameters.topP,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Ollama response format: { message: { role, content }, done, ... }
      const content = data.message?.content || '';
      
      // Estimate token usage (Ollama doesn't always provide this)
      const promptTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      const completionTokens = Math.ceil(content.length / 4);

      return {
        content,
        model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      logger.error('Ollama API error:', error);
      throw new Error(`Ollama API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async *generateStreamResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    try {
      logger.info(`[OLLAMA] Streaming response with model: ${model}`);
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          stream: true,
          options: {
            temperature: parameters.temperature,
            num_predict: parameters.maxTokens,
            top_p: parameters.topP,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.message?.content) {
                fullContent += data.message.content;
                yield {
                  content: data.message.content,
                  done: false,
                };
              }

              if (data.done) {
                // Estimate token usage
                const promptTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
                const completionTokens = Math.ceil(fullContent.length / 4);

                yield {
                  content: '',
                  done: true,
                  usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                  },
                };
                return;
              }
            } catch (e) {
              logger.error('Failed to parse Ollama response:', e);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Ollama streaming error:', error);
      throw new Error(`Ollama streaming request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class LLMService {
  private openaiProvider: OpenAIProvider;
  private anthropicProvider: AnthropicProvider;
  private groqProvider: GroqProvider;
  private ollamaProvider: OllamaProvider;
  private mockProvider: MockProvider;
  private useMock: boolean;
  private resolvedKeys: {
    openai: string;
    anthropic: string;
    groq: string;
    ollama: string;
  };

  constructor(userApiKeys?: UserApiKeys) {
    // Check if we're in mock mode based on API key values
    // We're in mock mode only if ALL keys are placeholder values
    const isPlaceholder = (key: string) => {
      return key.includes('PLACEHOLDER') || 
             key.includes('dev-key-not-set') ||
             key.includes('your-') || 
             key.includes('sk-your-') ||
             key.includes('gsk-your-') ||
             key.includes('sk-ant-your-') ||
             key.includes('cohere-your-') ||
             key.includes('ollama-your-');
    };
    
    // Use user API keys if provided, otherwise fall back to config
    const openaiKey = userApiKeys?.openai || config.openaiApiKey;
    const anthropicKey = userApiKeys?.anthropic || config.anthropicApiKey;
    const groqKey = userApiKeys?.groq || config.groqApiKey;
    const ollamaKey = userApiKeys?.ollama || config.ollamaApiKey;
    
    // Debug logging
    logger.info('LLMService constructor debug:', {
      hasUserApiKeys: !!userApiKeys,
      userApiKeys: userApiKeys,
      resolvedKeys: {
        openai: openaiKey.substring(0, 10) + '...',
        anthropic: anthropicKey.substring(0, 10) + '...',
        groq: groqKey.substring(0, 10) + '...',
        ollama: ollamaKey.substring(0, 10) + '...'
      }
    });
    
    // Store resolved keys for use in getProvider
    this.resolvedKeys = {
      openai: openaiKey,
      anthropic: anthropicKey,
      groq: groqKey,
      ollama: ollamaKey
    };
    
    this.useMock = isPlaceholder(openaiKey) && 
                   isPlaceholder(anthropicKey) &&
                   isPlaceholder(groqKey) &&
                   isPlaceholder(ollamaKey);
    
    if (this.useMock) {
      logger.info('🎭 Running in MOCK mode - no real API calls will be made');
    } else {
      logger.info('🚀 Running with REAL LLM providers (at least one provider configured)');
      if (!isPlaceholder(groqKey)) {
        logger.info('  ✅ Groq provider enabled');
      }
      if (!isPlaceholder(openaiKey)) {
        logger.info('  ✅ OpenAI provider enabled');
      }
      if (!isPlaceholder(anthropicKey)) {
        logger.info('  ✅ Anthropic provider enabled');
      }
      if (!isPlaceholder(ollamaKey)) {
        logger.info('  ✅ Ollama provider enabled');
      }
    }
    
    this.openaiProvider = new OpenAIProvider(openaiKey);
    this.anthropicProvider = new AnthropicProvider(anthropicKey);
    this.groqProvider = new GroqProvider(groqKey);
    this.ollamaProvider = new OllamaProvider(ollamaKey);
    this.mockProvider = new MockProvider();
  }

  public getProvider(model: string) {
    // Use mock provider if in mock mode
    if (this.useMock) {
      return this.mockProvider;
    }
    
    // OpenAI models
    if (model.startsWith('gpt-') || model.startsWith('o1-')) {
      if (this.resolvedKeys.openai.includes('mock')) {
        logger.warn('OpenAI model requested but key is mock, using mock provider');
        return this.mockProvider;
      }
      return this.openaiProvider;
    } 
    // Anthropic models
    else if (model.startsWith('claude-')) {
      if (this.resolvedKeys.anthropic.includes('mock')) {
        logger.warn('Anthropic model requested but key is mock, using mock provider');
        return this.mockProvider;
      }
      return this.anthropicProvider;
    } 
    // Ollama models (local open-source models)
    else if (
      model.startsWith('ollama/') ||
      model.startsWith('codellama') ||
      model.startsWith('phi') ||
      model.startsWith('neural-chat') ||
      model.startsWith('starling') ||
      model.startsWith('orca') ||
      model.startsWith('vicuna') ||
      model.startsWith('wizardlm') ||
      (model.startsWith('llama') && !model.startsWith('llama-3.1') && !model.startsWith('llama-3.3')) ||
      (model.startsWith('mistral') && !model.startsWith('mixtral'))
    ) {
      // Ollama supports: Llama, Mistral, CodeLlama, Phi, Neural Chat, 
      // Starling, Orca, Vicuna, WizardLM, and many more local models
      if (this.resolvedKeys.ollama.includes('mock')) {
        logger.warn('Ollama model requested but key is mock, using mock provider');
        return this.mockProvider;
      }
      return this.ollamaProvider;
    }
    // Groq models - for cloud-hosted Llama/Mixtral/etc
    else if (
      model.startsWith('llama-') ||
      model.startsWith('mixtral') || 
      model.startsWith('gemma') ||
      model.startsWith('meta-llama/') ||
      model.startsWith('openai/') ||
      model.startsWith('groq/') ||
      model.startsWith('moonshotai/') ||
      model.startsWith('qwen/')
    ) {
      // Groq supports: Mixtral, Gemma, Meta Llama 4, OpenAI Open models, 
      // Groq Compound, Moonshot Kimi, Qwen
      if (this.resolvedKeys.groq.includes('mock')) {
        logger.warn('Groq model requested but key is mock, using mock provider');
        return this.mockProvider;
      }
      return this.groqProvider;
    } 
    else {
      throw new Error(`Unsupported model: ${model}`);
    }
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters,
    userApiKeys?: UserApiKeys
  ): Promise<LLMResponse> {
    const providerSource = userApiKeys ? _getCachedUserService(userApiKeys) : this;
    const provider = providerSource.getProvider(model);
    const providerName = getProviderLabel(provider, model);
    const startedAt = Date.now();

    try {
      const response = await provider.generateResponse(messages, model, parameters);
      observeLlmSuccess(providerName, response.model || model, response.usage, startedAt);
      return response;
    } catch (error) {
      observeLlmFailure(providerName, model, startedAt);
      throw error;
    }
  }

  async *generateStreamResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    parameters: LLMParameters,
    userApiKeys?: UserApiKeys
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    const providerSource = userApiKeys ? _getCachedUserService(userApiKeys) : this;
    const provider = providerSource.getProvider(model);
    const providerName = getProviderLabel(provider, model);
    const startedAt = Date.now();
    let finalUsage: LLMResponse['usage'] | undefined;

    try {
      for await (const chunk of provider.generateStreamResponse(messages, model, parameters)) {
        if (chunk.done && chunk.usage) {
          finalUsage = chunk.usage;
        }
        yield chunk;
      }

      observeLlmSuccess(providerName, model, finalUsage, startedAt);
    } catch (error) {
      observeLlmFailure(providerName, model, startedAt);
      throw error;
    }
  }

  async generateRAGResponse(
    query: string,
    context: string,
    model: string,
    parameters: LLMParameters,
    userApiKeys?: UserApiKeys
  ): Promise<LLMResponse> {
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context. Use the context to provide accurate, relevant answers. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${context}

Please answer the following question based on the context above.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];

    return this.generateResponse(messages, model, parameters, userApiKeys);
  }

  async *generateRAGStreamResponse(
    query: string,
    context: string,
    model: string,
    parameters: LLMParameters,
    userApiKeys?: UserApiKeys
  ): AsyncGenerator<LLMStreamResponse, void, unknown> {
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context. Use the context to provide accurate, relevant answers. If the context doesn't contain enough information to answer the question, say so clearly.

Context:
${context}

Please answer the following question based on the context above.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];

    yield* this.generateStreamResponse(messages, model, parameters, userApiKeys);
  }
}

export const llmService = new LLMService();

// Per-user LLM service cache — avoids re-instantiating SDK clients on every request
const _userServiceCache = new Map<string, LLMService>();
function _getCachedUserService(userApiKeys: UserApiKeys): LLMService {
  const cacheKey = [
    userApiKeys.openai ?? '',
    userApiKeys.anthropic ?? '',
    userApiKeys.groq ?? '',
    userApiKeys.cohere ?? '',
    userApiKeys.ollama ?? '',
  ].join('|');
  let svc = _userServiceCache.get(cacheKey);
  if (!svc) {
    svc = new LLMService(userApiKeys);
    _userServiceCache.set(cacheKey, svc);
  }
  return svc;
}

function getProviderLabel(provider: unknown, model: string): string {
  if (provider instanceof OpenAIProvider) return 'openai';
  if (provider instanceof AnthropicProvider) return 'anthropic';
  if (provider instanceof GroqProvider) return 'groq';
  if (provider instanceof OllamaProvider) return 'ollama';
  if (provider instanceof MockProvider) return 'mock';

  if (model.startsWith('gpt-') || model.startsWith('o1-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('groq/') || model.startsWith('llama-') || model.startsWith('mixtral')) return 'groq';
  if (model.startsWith('ollama/')) return 'ollama';
  return 'unknown';
}

function observeLlmSuccess(
  provider: string,
  model: string,
  usage: LLMResponse['usage'] | undefined,
  startedAt: number
): void {
  llmApiCalls.inc({ provider, model, status: 'success' });
  llmApiDuration.observe({ provider, model }, (Date.now() - startedAt) / 1000);

  if (usage) {
    llmTokensTotal.inc({ provider, model, type: 'prompt' }, usage.promptTokens);
    llmTokensTotal.inc({ provider, model, type: 'completion' }, usage.completionTokens);
    llmTokensTotal.inc({ provider, model, type: 'total' }, usage.totalTokens);
  }
}

function observeLlmFailure(provider: string, model: string, startedAt: number): void {
  llmApiCalls.inc({ provider, model, status: 'error' });
  llmApiDuration.observe({ provider, model }, (Date.now() - startedAt) / 1000);
}
