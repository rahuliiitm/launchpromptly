import { PlanForge } from './planforge';

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
});
