import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyOpenwaSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret || !signature.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`, 'utf8');
  const received = Buffer.from(signature, 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export interface OpenwaDelivery {
  event: string;
  idempotencyKey: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

export function parseDelivery(rawBody: Buffer): OpenwaDelivery {
  const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid webhook body');
  const delivery = parsed as Record<string, unknown>;
  if (typeof delivery.event !== 'string' || !delivery.event || typeof delivery.idempotencyKey !== 'string' || !delivery.idempotencyKey || delivery.idempotencyKey.length > 256) {
    throw new Error('Missing signed delivery identity');
  }
  return {
    event: delivery.event,
    idempotencyKey: delivery.idempotencyKey,
    sessionId: typeof delivery.sessionId === 'string' ? delivery.sessionId : undefined,
    data: delivery.data && typeof delivery.data === 'object' ? delivery.data as Record<string, unknown> : undefined
  };
}
