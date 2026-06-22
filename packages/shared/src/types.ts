import type { IntegrationSource, IntegrationStatus, ProjectStatus, RiskLevel, UserRole } from './constants.js';
import type { RiskEvidence } from './risk.js';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
}

export interface ReadyResponse extends HealthResponse {
  checks: {
    database: 'ok' | 'error' | 'skipped';
    redis: 'ok' | 'error' | 'skipped';
  };
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  reason: string;
  confidence: number;
  evidence: RiskEvidence[];
}

export interface ProjectSummary {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  status: ProjectStatus;
  targetGoLiveDate: string | null;
  arrAmount: number | null;
  arrCurrency: string | null;
  ownerName: string | null;
  riskScore: number | null;
  riskLevel: RiskLevel | null;
  integrationStatus: IntegrationStatus;
}
