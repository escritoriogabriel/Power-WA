import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../server/lib/store.js';
import { processIncomingMessage } from '../server/services/triage.js';

describe('deterministic triage flow', () => {
  it('creates a lead and moves it to human review after the configured answers', async () => {
    const data = createEmptyData();
    await processIncomingMessage(data, { chatId: '5511999999999@c.us', phone: '5511999999999', displayName: 'Lead de teste', body: 'Olá' });
    const lead = data.leads[0];
    expect(lead.status).toBe('triage');
    expect(lead.messages.at(-1)?.direction).toBe('outbound');

    await processIncomingMessage(data, { chatId: lead.chatId, phone: lead.phone, displayName: lead.displayName, body: '1' });
    await processIncomingMessage(data, { chatId: lead.chatId, phone: lead.phone, displayName: lead.displayName, body: '2' });

    expect(lead.status).toBe('human_review');
    expect(lead.label).toBe('aguardando-humano');
    expect(lead.answers).toEqual({ area: 'Trabalhista', urgency: 'Não há prazo conhecido' });
  });
});
