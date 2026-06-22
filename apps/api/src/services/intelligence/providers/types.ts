import type { GeneratedInsight, InsightOutput, SanitizedEvidenceItem } from '@beacon/shared';

export interface LlmCompletionRequest {
  prompt: string;
  maxTokens: number;
  locale: string;
  timeoutMs: number;
}

export interface LlmCompletionResult {
  output: InsightOutput;
  tokensUsed: number;
  provider: string;
}

export interface LlmInsightRequest extends LlmCompletionRequest {
  evidence: SanitizedEvidenceItem[];
  projectName: string;
  riskReason: string;
  riskLevel: string;
}

export interface LlmProvider {
  name: string;
  generateInsight(params: LlmInsightRequest): Promise<LlmCompletionResult>;
}

export function parseJsonInsight(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate) as unknown;
}
