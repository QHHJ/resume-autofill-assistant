import { afterEach, expect, it, vi } from 'vitest';
import { ChatOpenAICompletions } from '@langchain/openai';
import type { OpenAIClient } from '@langchain/openai';
import { createChatModel } from './helper';

vi.mock('@extension/storage', () => ({
  ProviderTypeEnum: { Llama: 'llama', AzureOpenAI: 'azure_openai' },
}));

afterEach(() => vi.restoreAllMocks());

function llamaModel() {
  return createChatModel({ apiKey: 'test-key' }, { provider: 'llama', modelName: 'test-model' }) as ChatOpenAICompletions;
}

function parentResponse(response: unknown) {
  // The SDK spy exposes its last overload. Fixtures also exercise streaming and vendor-only response shapes.
  return vi
    .spyOn(ChatOpenAICompletions.prototype, 'completionWithRetry')
    .mockResolvedValueOnce(response as OpenAIClient.Chat.Completions.ChatCompletion);
}

it('converts Llama completion text and token metrics to an OpenAI response', async () => {
  parentResponse({
    id: 'vendor-response',
    completion_message: { content: { text: '填写结果' }, stop_reason: 'stop' },
    metrics: [
      { metric: 'num_prompt_tokens', value: 10 },
      { metric: 'num_completion_tokens', value: 4 },
      { metric: 'num_total_tokens', value: 14 },
    ],
  });
  const result = await llamaModel().completionWithRetry({ model: 'test-model', messages: [] });
  expect(result).toMatchObject({
    id: 'vendor-response',
    object: 'chat.completion',
    model: 'test-model',
    choices: [{ message: { role: 'assistant', content: '填写结果' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
  });
});

it('passes through an ordinary OpenAI response unchanged', async () => {
  const response: OpenAIClient.Chat.Completions.ChatCompletion = {
    id: 'standard-response',
    object: 'chat.completion',
    created: 1,
    model: 'test-model',
    choices: [],
  };
  parentResponse(response);
  expect(await llamaModel().completionWithRetry({ model: 'test-model', messages: [] })).toBe(response);
});

it('passes through a streaming response and its request options unchanged', async () => {
  const stream = (async function* () {
    yield { id: 'chunk', object: 'chat.completion.chunk', created: 1, model: 'test-model', choices: [] };
  })();
  const parent = parentResponse(stream);
  const request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming = {
    model: 'test-model',
    messages: [],
    stream: true,
  };
  const options = { signal: new AbortController().signal };
  expect(await llamaModel().completionWithRetry(request, options)).toBe(stream);
  expect(parent).toHaveBeenCalledWith(request, options);
});
