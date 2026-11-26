import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseDelivery, verifyOpenwaSignature } from '../server/lib/openwa-signature.js';
import { createEmptyData } from '../server/lib/store.js';

describe('OpenWA webhook security', () => {
  it('accepts the exact raw body with a valid HMAC', () => {
    const body = Buffer.from('{"event":"message.received","idempotencyKey":"evt-1"}');
    const secret = 'test-only-secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyOpenwaSignature(body, signature, secret)).toBe(true);
    expect(parseDelivery(body).idempotencyKey).toBe('evt-1');
  });

  it('rejects altered bytes and missing signatures', () => {
    const body = Buffer.from('{"event":"message.received","idempotencyKey":"evt-1"}');
    expect(verifyOpenwaSignature(Buffer.from(`${body.toString()} `), undefined, 'secret')).toBe(false);
    expect(verifyOpenwaSignature(body, 'sha256=not-the-signature', 'secret')).toBe(false);
  });
});

describe('triage configuration', () => {
  it('starts with deterministic questions and no leads', () => {
    const data = createEmptyData();
    expect(data.leads).toHaveLength(0);
    expect(data.triage.questions.length).toBeGreaterThan(0);
    expect(data.triage.questions[0].options.length).toBeGreaterThan(1);
  });
});
