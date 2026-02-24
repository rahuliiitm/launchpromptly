import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { calculatePerRequestCost } from '@aiecon/calculators';
import type { LLMProvider, PlaygroundModelResult } from '@aiecon/types';

@Injectable()
export class LlmGatewayService {
  async callModel(
    provider: LLMProvider,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userMessage: string,
  ): Promise<PlaygroundModelResult> {
    const start = performance.now();
    try {
      if (provider === 'openai') {
        return await this.callOpenAI(apiKey, model, systemPrompt, userMessage, start);
      } else {
        return await this.callAnthropic(apiKey, model, systemPrompt, userMessage, start);
      }
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        model,
        provider,
        response: '',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        latencyMs,
        error: (err as Error).message,
      };
    }
  }

  private async callOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userMessage: string,
    start: number,
  ): Promise<PlaygroundModelResult> {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    const latencyMs = Math.round(performance.now() - start);
    const choice = completion.choices[0];
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    let costUsd = 0;
    try {
      costUsd = calculatePerRequestCost(model, inputTokens, outputTokens);
    } catch { /* unknown model — cost stays 0 */ }

    return {
      model,
      provider: 'openai',
      response: choice?.message?.content ?? '',
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      latencyMs,
    };
  }

  private async callAnthropic(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userMessage: string,
    start: number,
  ): Promise<PlaygroundModelResult> {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const latencyMs = Math.round(performance.now() - start);
    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    let costUsd = 0;
    try {
      costUsd = calculatePerRequestCost(model, inputTokens, outputTokens);
    } catch { /* unknown model — cost stays 0 */ }

    return {
      model,
      provider: 'anthropic',
      response: responseText,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
      latencyMs,
    };
  }
}
