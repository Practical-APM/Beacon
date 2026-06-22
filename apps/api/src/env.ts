import { apiEnvSchema, parseEnv } from '@beacon/shared/env';
import { loadRootEnv } from './load-root-env.js';

loadRootEnv();

export const env = parseEnv(apiEnvSchema, process.env);
