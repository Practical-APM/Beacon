const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|credential|api[_-]?key)/i;

export function scrubLogContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return context;

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      scrubbed[key] = '[redacted]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      scrubbed[key] = scrubLogContext(value as Record<string, unknown>);
      continue;
    }
    scrubbed[key] = value;
  }
  return scrubbed;
}
