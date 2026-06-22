import { describe, expect, it } from 'vitest';
import { businessDaysBetween } from './risk.js';
import {
  computeSlackChannelSignals,
  customerWaitingDaysFromSignals,
  detectEscalation,
  isCustomerParticipant,
  isInternalParticipant,
  suggestChannelMappings,
} from './slack.js';

describe('slack participant detection', () => {
  it('classifies internal vs customer by email domain', () => {
    expect(isInternalParticipant('alex@acme-demo.test', ['acme-demo.test'])).toBe(true);
    expect(isCustomerParticipant('buyer@customer.com', ['customer.com'], ['acme-demo.test'])).toBe(
      true,
    );
    expect(
      isCustomerParticipant('agency@acme-demo.test', ['customer.com'], ['acme-demo.test'], [
        'acme-demo.test',
      ]),
    ).toBe(true);
  });
});

describe('slack escalation detection', () => {
  it('requires keyword plus executive mention', () => {
    expect(
      detectEscalation({
        ts: '1710000000.000001',
        userId: 'U1',
        textPreview: 'Need escalation on this rollout',
        mentionsExec: true,
      }),
    ).toBe(true);
    expect(
      detectEscalation({
        ts: '1710000000.000001',
        userId: 'U1',
        textPreview: 'urgent but casual chat',
        mentionsExec: false,
      }),
    ).toBe(false);
  });
});

describe('slack channel signals', () => {
  it('computes last customer and internal timestamps', () => {
    const signals = computeSlackChannelSignals({
      botPresent: true,
      internalDomains: ['acme-demo.test'],
      customerDomains: ['customer.com'],
      messages: [
        {
          ts: '1710000000.000001',
          userId: 'U1',
          userEmail: 'buyer@customer.com',
        },
        {
          ts: '1711000000.000001',
          userId: 'U2',
          userEmail: 'alex@acme-demo.test',
          textPreview: 'Following up on security review',
        },
      ],
    });

    expect(signals.lastCustomerMessageAt).toBeTruthy();
    expect(signals.lastInternalResponseAt).toBeTruthy();
    expect(signals.lastActivityAt).toBeTruthy();
  });

  it('derives customer waiting days from signals', () => {
    const internalAt = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString();
    const customerAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const waitingDays = customerWaitingDaysFromSignals(
      {
        lastCustomerMessageAt: customerAt,
        lastInternalResponseAt: internalAt,
        lastActivityAt: internalAt,
      },
      'UTC',
      businessDaysBetween,
    );
    expect(waitingDays).toBeGreaterThanOrEqual(10);
  });
});

describe('slack channel mapping suggestions', () => {
  it('suggests projects by channel name similarity', () => {
    const suggestions = suggestChannelMappings(
      [
        { id: 'C1', name: 'acme-implementation', isPrivate: false, botPresent: true },
        { id: 'C2', name: 'random-chat', isPrivate: false, botPresent: false, botAccessError: 'not_in_channel' },
      ],
      [{ id: 'p1', name: 'Acme Corp Implementation' }],
    );

    expect(suggestions[0]?.suggestedProjectId).toBe('p1');
    expect(suggestions[0]?.botPresent).toBe(true);
    expect(suggestions[1]?.botAccessError).toBe('not_in_channel');
  });
});
