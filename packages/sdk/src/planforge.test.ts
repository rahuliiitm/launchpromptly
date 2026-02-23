import { PlanForge, PromptNotFoundError } from './planforge';

// Mock fetch globally
const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
  ok: true,
} as Response);

const mockResponse = {
  id: 'chatcmpl-123',
  choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 20,
    total_tokens: 70,
  },
};

function createMockClient() {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue(mockResponse),
      },
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({ data: [] }),
    },
  };
}

describe('PlanForge', () => {
  afterEach(() => {
    fetchSpy.mockClear();
  });

  it('should proxy chat.completions.create and return the original result', async () => {
    const pf = new PlanForge({
      apiKey: 'pf_live_test',
      endpoint: 'http://localhost:3001',
      flushAt: 100,
    });
    const client = createMockClient();
    const wrapped = pf.wrap(client);

    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result).toBe(mockResponse);
    expect(client.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    pf.destroy();
  });

  it('should enqueue an event after a successful call', async () => {
    const pf = new PlanForge({
      apiKey: 'pf_live_test',
      endpoint: 'http://localhost:3001',
      flushAt: 1, // flush immediately
    });
    const client = createMockClient();
    const wrapped = pf.wrap(client, { feature: 'chat' });

    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Wait for the async event capture
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/v1/events/batch',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"model":"gpt-4o"'),
      }),
    );

    pf.destroy();
  });

  it('should include customer info from customer function', async () => {
    const pf = new PlanForge({
      apiKey: 'pf_live_test',
      endpoint: 'http://localhost:3001',
      flushAt: 1,
    });
    const client = createMockClient();
    const wrapped = pf.wrap(client, {
      customer: () => ({ id: 'cust-42', feature: 'search' }),
    });

    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    await new Promise((r) => setTimeout(r, 50));

    const body = fetchSpy.mock.calls[0]?.[1]?.body as string;
    expect(body).toContain('"customerId":"cust-42"');
    expect(body).toContain('"feature":"search"');

    pf.destroy();
  });

  it('should not throw if the original create throws', async () => {
    const pf = new PlanForge({
      apiKey: 'pf_live_test',
      endpoint: 'http://localhost:3001',
    });
    const client = createMockClient();
    client.chat.completions.create.mockRejectedValue(new Error('API error'));
    const wrapped = pf.wrap(client);

    await expect(
      wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    ).rejects.toThrow('API error');

    pf.destroy();
  });

  it('should pass through non-intercepted properties', async () => {
    const pf = new PlanForge({
      apiKey: 'pf_live_test',
      endpoint: 'http://localhost:3001',
    });
    const client = createMockClient();
    const wrapped = pf.wrap(client);

    const result = await wrapped.embeddings.create({} as never);
    expect(result).toEqual({ data: [] });

    pf.destroy();
  });

  it('should flush pending events', async () => {
    const pf = new PlanForge({
      apiKey: 'pf_live_test',
      endpoint: 'http://localhost:3001',
      flushAt: 100, // won't auto-flush
    });
    const client = createMockClient();
    const wrapped = pf.wrap(client);

    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    // Wait for event capture
    await new Promise((r) => setTimeout(r, 50));

    // Manually flush
    await pf.flush();

    expect(fetchSpy).toHaveBeenCalled();

    pf.destroy();
  });

  // ── prompt() tests ──

  describe('prompt()', () => {
    const resolvedPromptData = {
      content: 'You are a customer support agent.',
      managedPromptId: 'mp-1',
      promptVersionId: 'pv-1',
      version: 2,
    };

    function mockResolveResponse(data: any, status = 200) {
      fetchSpy.mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(data),
      } as Response);
    }

    it('should fetch from API and return content', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
      });
      mockResolveResponse(resolvedPromptData);

      const content = await pf.prompt('customer-support');
      expect(content).toBe('You are a customer support agent.');
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/v1/prompts/resolve/customer-support',
        expect.objectContaining({
          headers: { Authorization: 'Bearer pf_live_test' },
        }),
      );
      pf.destroy();
    });

    it('should cache result and reuse on second call', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
        promptCacheTtl: 60000,
      });
      mockResolveResponse(resolvedPromptData);

      const first = await pf.prompt('cached-slug');
      const second = await pf.prompt('cached-slug');

      expect(first).toBe(second);
      // Only one fetch call for the resolve endpoint
      const resolveCalls = fetchSpy.mock.calls.filter((c) =>
        (c[0] as string).includes('/v1/prompts/resolve/'),
      );
      expect(resolveCalls).toHaveLength(1);
      pf.destroy();
    });

    it('should re-fetch after TTL expires', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
        promptCacheTtl: 1, // 1ms TTL
      });
      mockResolveResponse(resolvedPromptData);
      await pf.prompt('ttl-slug');

      await new Promise((r) => setTimeout(r, 10)); // wait for expiry

      mockResolveResponse({ ...resolvedPromptData, content: 'Updated content' });
      const second = await pf.prompt('ttl-slug');
      expect(second).toBe('Updated content');
      pf.destroy();
    });

    it('should return stale cache on network error', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
        promptCacheTtl: 1,
      });
      mockResolveResponse(resolvedPromptData);
      await pf.prompt('stale-slug');

      await new Promise((r) => setTimeout(r, 10));

      fetchSpy.mockRejectedValueOnce(new Error('Network error'));
      const content = await pf.prompt('stale-slug');
      expect(content).toBe('You are a customer support agent.');
      pf.destroy();
    });

    it('should throw PromptNotFoundError on 404', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
      });
      mockResolveResponse({}, 404);

      await expect(pf.prompt('missing')).rejects.toThrow(PromptNotFoundError);
      pf.destroy();
    });

    it('should throw PromptNotFoundError on 404 even with stale cache', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
        promptCacheTtl: 1,
      });
      mockResolveResponse(resolvedPromptData);
      await pf.prompt('deleted-slug');

      await new Promise((r) => setTimeout(r, 10));

      mockResolveResponse({}, 404);
      await expect(pf.prompt('deleted-slug')).rejects.toThrow(PromptNotFoundError);
      pf.destroy();
    });

    it('should pass customerId as query param', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
      });
      mockResolveResponse(resolvedPromptData);

      await pf.prompt('ab-slug', { customerId: 'user-42' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/v1/prompts/resolve/ab-slug?customerId=user-42',
        expect.any(Object),
      );
      pf.destroy();
    });

    it('should include managedPromptId in event after prompt()', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
        flushAt: 1,
      });
      mockResolveResponse(resolvedPromptData);

      const systemPrompt = await pf.prompt('event-test');
      const client = createMockClient();
      const wrapped = pf.wrap(client);

      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Hello' },
        ],
      });

      await new Promise((r) => setTimeout(r, 50));

      const batchCall = fetchSpy.mock.calls.find((c) =>
        (c[0] as string).includes('/v1/events/batch'),
      );
      expect(batchCall).toBeDefined();
      const body = JSON.parse(batchCall![1]!.body as string);
      expect(body.events[0].managedPromptId).toBe('mp-1');
      expect(body.events[0].promptVersionId).toBe('pv-1');
      pf.destroy();
    });

    it('should reject with error when no cache and network fails', async () => {
      const pf = new PlanForge({
        apiKey: 'pf_live_test',
        endpoint: 'http://localhost:3001',
      });
      fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(pf.prompt('no-cache')).rejects.toThrow('Connection refused');
      pf.destroy();
    });
  });
});
