import {
  buildInsightPrompt,
  validateInsightOutput,
  type SanitizedEvidenceItem,
} from '@beacon/shared';
import { env } from '../../../env.js';
import { parseJsonInsight, type LlmInsightRequest, type LlmProvider } from './types.js';

export class OpenAiProvider implements LlmProvider {
  name = 'openai';

  async generateInsight(params: LlmInsightRequest) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          temperature: 0,
          max_tokens: params.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Return JSON only. Never invent evidence beyond what is provided.',
            },
            {
              role: 'user',
              content: buildInsightPrompt({
                projectName: params.projectName,
                riskReason: params.riskReason,
                riskLevel: params.riskLevel,
                evidence: params.evidence,
                locale: params.locale,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        usage?: { total_tokens?: number };
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned empty content');

      const parsed = validateInsightOutput(parseJsonInsight(content), params.evidence);
      return {
        output: parsed,
        tokensUsed: payload.usage?.total_tokens ?? params.maxTokens,
        provider: this.name,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class AnthropicProvider implements LlmProvider {
  name = 'anthropic';

  async generateInsight(params: LlmInsightRequest) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.ANTHROPIC_MODEL,
          max_tokens: params.maxTokens,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: buildInsightPrompt({
                projectName: params.projectName,
                riskReason: params.riskReason,
                riskLevel: params.riskLevel,
                evidence: params.evidence,
                locale: params.locale,
              }),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Anthropic request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        usage?: { input_tokens?: number; output_tokens?: number };
        content?: Array<{ type?: string; text?: string }>;
      };
      const content = payload.content?.find((block) => block.type === 'text')?.text;
      if (!content) throw new Error('Anthropic returned empty content');

      const parsed = validateInsightOutput(parseJsonInsight(content), params.evidence);
      const tokensUsed =
        (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0) || params.maxTokens;
      return { output: parsed, tokensUsed, provider: this.name };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class MockLlmProvider implements LlmProvider {
  name = 'mock';

  async generateInsight(params: LlmInsightRequest) {
    const primary = params.evidence[0];
    const output = validateInsightOutput(
      {
        root_cause: `${params.riskReason}. Supporting signal: ${primary?.description ?? 'Operational evidence detected.'}`,
        recommended_action: 'Review linked evidence and assign the next corrective action with a named owner.',
        suggested_owner: 'Delivery lead',
        escalation_path: 'Escalate to executive sponsor if unresolved within one week.',
        confidence: 72,
        evidence_ids: params.evidence.slice(0, Math.min(3, params.evidence.length)).map((item) => item.id),
      },
      params.evidence,
    );

    return {
      output,
      tokensUsed: 120,
      provider: this.name,
    };
  }
}

export function createLlmProvider(provider: 'openai' | 'anthropic' | 'mock'): LlmProvider {
  if (provider === 'openai') return new OpenAiProvider();
  if (provider === 'anthropic') return new AnthropicProvider();
  return new MockLlmProvider();
}
