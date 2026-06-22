import { env } from '../env.js';

let initialized = false;

export async function initTelemetry(): Promise<void> {
  if (!env.OTEL_ENABLED || initialized) {
    return;
  }

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import(
    '@opentelemetry/auto-instrumentations-node'
  );

  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  initialized = true;
}
